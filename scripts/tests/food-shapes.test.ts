/**
 * The food icons, checked against the shops that actually exist.
 *
 * Two things can quietly break this system and neither shows up in a build:
 *
 *   1. A shop adds a category nobody has drawn for. The icon silently falls
 *      back to a pizza, which looks deliberate and so nobody reports it.
 *   2. The app's copy of `food-shapes.ts` and the website's drift apart, and a
 *      wrap starts looking like two different wraps depending on the device.
 *
 * Both are caught here rather than by somebody noticing months later.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { hasOwnShape, shapesFor, FOOD_SHAPES } from "../../apps/web/src/theme/food-shapes.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const CONFIG = join(ROOT, "config");

function shopSlugs(): string[] {
  return readdirSync(CONFIG, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);
}

function categoriesOf(shop: string): string[] {
  const p = join(CONFIG, shop, "menu.json");
  if (!existsSync(p)) return [];
  const menu = JSON.parse(readFileSync(p, "utf8")) as { categories?: { slug: string }[] };
  return (menu.categories ?? []).map((c) => c.slug);
}

test("every category in every shop has a drawing of its own", () => {
  const missing: string[] = [];
  for (const shop of shopSlugs()) {
    for (const slug of categoriesOf(shop)) {
      if (!hasOwnShape(slug)) missing.push(`${shop}/${slug}`);
    }
  }
  assert.deepEqual(
    missing,
    [],
    `These categories fall back to a pizza. Draw them in food-shapes.ts, or add an alias: ${missing.join(", ")}`,
  );
});

test("an unknown slug still returns a usable drawing", () => {
  // A hole in a row of icons looks broken; a slightly wrong icon looks
  // intentional. The fallback must never be empty.
  const shapes = shapesFor("something-no-shop-has-ever-sold");
  assert.ok(shapes.length > 0);
});

test("aliases resolve to a real shape rather than the fallback", () => {
  assert.deepEqual(shapesFor("fried-chicken"), FOOD_SHAPES.chicken);
  assert.deepEqual(shapesFor("soft-drinks"), FOOD_SHAPES.drinks);
});

test("every drawing has at least one solid shape, so its silhouette is not blank", () => {
  const blank = Object.entries(FOOD_SHAPES)
    .filter(([, shapes]) => !shapes.some((s) => s.tone === "solid"))
    .map(([k]) => k);
  assert.deepEqual(blank, [], `These would tile as nothing in the background: ${blank.join(", ")}`);
});

test("the app's copy of the shapes has not drifted from the website's", () => {
  // The app is a sibling repo and is not present in CI, so this only runs
  // where it exists. Skipping is correct: a missing repo is not a failure,
  // whereas a *different* repo is.
  const appCopy = join(ROOT, "..", "farm-pizza-app", "src", "theme", "food-shapes.ts");
  if (!existsSync(appCopy)) return;

  const strip = (s: string) => s.replace(/\/\*\*[\s\S]*?\*\//, "").replace(/\s+/g, " ").trim();
  const web = strip(readFileSync(join(ROOT, "apps/web/src/theme/food-shapes.ts"), "utf8"));
  const app = strip(readFileSync(appCopy, "utf8"));

  assert.equal(web, app, "food-shapes.ts differs between the website and the app - copy one over the other");
});
