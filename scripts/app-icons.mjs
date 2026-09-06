import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

// Anchored to the repo, not to wherever this was run from.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Build the app icons from the shop's logo.
 *
 * The supplied artwork cannot be shipped as-is, for three reasons that would
 * each fail review or look wrong on a home screen.
 *
 * **It has an alpha channel.** App Store Connect rejects an icon with
 * transparency outright - not a warning, a failed upload. Everything here is
 * flattened onto an opaque background.
 *
 * **It has its own rounded corners.** Apple applies the corner mask itself, so
 * a pre-rounded icon gets rounded twice: the artwork's own corners sit inside
 * Apple's, leaving four dark notches and a mark that looks shrunken. The icon
 * must be a full-bleed square and let the platform do the rounding.
 *
 * **The mark touches the edges.** Anything in the outer eighth of the square
 * disappears under the mask on iOS, and under a more aggressive mask on
 * Android. So the logo is inset deliberately rather than filled to the edge -
 * which is the "breathing space" that stops it looking wonky.
 *
 * Android is a separate problem: an adaptive icon is two layers, and the system
 * can mask the foreground to a circle, a squircle, a teardrop or a rounded
 * square depending on the handset. Only the central 66% is guaranteed to
 * survive, so the foreground logo is drawn smaller than the iOS one.
 */

const SRC = join(ROOT, "docs", "App icon.png");
const OUT = join(ROOT, "config", "farm-pizza", "assets", "app");

/** The shop's red. Same value as brand.primary in client.json. */
const RED = "#C82323";

/**
 * How much of the square the mark occupies.
 *
 * iOS: 78%. Comfortably inside the corner mask with room to breathe, and still
 * large enough to read at 60px on a home screen.
 *
 * Android: 62%. Below the 66% guaranteed-visible circle, because a teardrop
 * mask on some handsets cuts closer than the guidance implies.
 */
const IOS_SCALE = 0.78;
const ANDROID_SCALE = 0.62;

/**
 * A soft light from above.
 *
 * The reference artwork had a glass highlight across the top - a 2010 iOS
 * look that dates an icon immediately. This keeps the sense of depth that made
 * it appealing without the gloss: a gentle lift at the top and a shadow at the
 * bottom, invisible as an effect but the icon reads as an object rather than a
 * flat swatch.
 */
const backdrop = (size) => Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lift" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="45%"  stop-color="#ffffff" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.14"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#lift)"/>
</svg>`);

async function mark(size) {
  // Trimmed first so the inset is measured from the artwork, not from whatever
  // empty margin the export happened to leave around it.
  return sharp(SRC)
    .trim({ threshold: 1 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // ── iOS / App Store: 1024, opaque, square, no alpha ──────────────────────
  const size = 1024;
  const logo = await mark(Math.round(size * IOS_SCALE));
  await sharp({ create: { width: size, height: size, channels: 3, background: RED } })
    .composite([
      { input: backdrop(size), blend: "over" },
      { input: logo, gravity: "centre" },
    ])
    // Both, and in this order. `flatten` paints the transparency onto the red
    // but sharp still writes four channels, so the file stays "transparent"
    // as far as App Store Connect is concerned. `removeAlpha` drops the
    // channel itself. Checked at the end of this script rather than assumed -
    // an icon that merely looks opaque still fails the upload.
    .flatten({ background: RED })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "icon.png"));

  // ── Android adaptive: foreground keeps its alpha, background is flat ─────
  const fg = await mark(Math.round(size * ANDROID_SCALE));
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fg, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "adaptive-icon.png"));

  await sharp({ create: { width: size, height: size, channels: 3, background: RED } })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "adaptive-background.png"));

  // ── Splash: the mark alone, transparent, sat on the red by the app ───────
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await mark(Math.round(size * 0.55)), gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "splash-icon.png"));

  // ── Favicon ─────────────────────────────────────────────────────────────
  await sharp(join(OUT, "icon.png")).resize(48, 48).png().toFile(join(OUT, "favicon.png"));

  for (const f of ["icon.png", "adaptive-icon.png", "adaptive-background.png", "splash-icon.png", "favicon.png"]) {
    const m = await sharp(join(OUT, f)).metadata();
    console.log(`${f.padEnd(26)} ${m.width}x${m.height}  alpha:${m.hasAlpha}  channels:${m.channels}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
