import { test } from "node:test";
import assert from "node:assert/strict";
import { loadClientConfig, loadMenuConfig, parseCsv, productsFromCsv } from "@launchflow/config";

test("farm-pizza config loads and cross-validates", () => {
  const c = loadClientConfig("farm-pizza");
  const m = loadMenuConfig("farm-pizza");
  assert.equal(c.slug, "farm-pizza");
  // One shop: Grays. Basildon is supplied by someone else for now.
  assert.equal(c.locations.length, 1);
  assert.equal(c.locations[0]!.id, "grays");
  assert.ok(c.locations[0]!.deliveryBands.length >= 2, "banded delivery configured");
  assert.ok(m.products.length >= 10);
  assert.ok(m.products.every((p) => p.sizes.length > 0), "price shorthand normalised to sizes");
});

test("csv parser handles quotes and CRLF", () => {
  const rows = parseCsv('name,desc\r\n"Margherita","Tomato, ""fresh"" basil"\r\n');
  assert.deepEqual(rows, [{ name: "Margherita", desc: 'Tomato, "fresh" basil' }]);
});

test("productsFromCsv groups sizes and reports bad prices", () => {
  const csv = `category,name,size,price\nPizzas,Margherita,Small,7.50\nPizzas,Margherita,Large,£13.50\nSides,Wedges,,abc\n`;
  const r = productsFromCsv(csv);
  assert.equal(r.products.length, 1);
  assert.equal(r.products[0]!.sizes.length, 2);
  assert.equal(r.products[0]!.sizes[1]!.price, 13.5);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0]!, /bad price/);
});
