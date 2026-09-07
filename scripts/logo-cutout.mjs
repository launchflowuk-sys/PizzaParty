/**
 * Knock the flat background out of a logo, leaving the mark on transparency.
 *
 * Not a colour key: the mark itself is mostly the same red as the background,
 * so replacing "every red pixel" punches holes through the lettering. This
 * flood-fills inward from the border instead, so only red that is actually
 * connected to the outside is removed and the red inside the white outlines is
 * left alone.
 *
 *   node scripts/logo-cutout.mjs <in.png> <out.png> [tolerance]
 */
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)("sharp");

const [IN, OUT, TOL = "60"] = process.argv.slice(2);
const tol = Number(TOL);

const { data, info } = await sharp(IN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels: ch } = info;
const at = (x, y) => (y * w + x) * ch;

// The background is whatever colour the corners are.
const bg = [data[at(0, 0)], data[at(0, 0) + 1], data[at(0, 0) + 2]];
const near = (i) =>
  Math.abs(data[i] - bg[0]) <= tol &&
  Math.abs(data[i + 1] - bg[1]) <= tol &&
  Math.abs(data[i + 2] - bg[2]) <= tol;

const seen = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) { stack.push([x, 0], [x, h - 1]); }
for (let y = 0; y < h; y++) { stack.push([0, y], [w - 1, y]); }

let cleared = 0;
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= w || y >= h) continue;
  const p = y * w + x;
  if (seen[p]) continue;
  const i = at(x, y);
  if (!near(i)) continue;
  seen[p] = 1;
  data[i + 3] = 0;
  cleared++;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

await sharp(data, { raw: { width: w, height: h, channels: ch } })
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const pct = ((cleared / (w * h)) * 100).toFixed(1);
console.log(`background rgb(${bg.join(",")}) removed — ${cleared} px (${pct}%) → ${OUT}`);
