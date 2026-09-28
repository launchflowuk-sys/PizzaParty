import { test } from "node:test";
import assert from "node:assert/strict";
import { priceOffline } from "../../apps/web/src/components/pos/offline-pricing";
import type { PosCategory, PosDeal } from "../../apps/web/src/components/pos/pos-client-types";

const categories: PosCategory[] = [
  {
    key: "pizza",
    name: "Pizza",
    products: [
      {
        slug: "margherita", name: "Margherita", soldOut: false, description: "", tags: [], minPrice: 899, categoryKey: "pizza",
        sizes: [{ key: "small", name: "10\"", price: 899, soldOut: false }, { key: "large", name: "12\"", price: 1199, soldOut: false }],
        groups: [{ key: "extra-toppings", name: "Extra toppings", minSelect: 0, maxSelect: 3, modifiers: [{ key: "mushroom", name: "Mushroom", price: 100, soldOut: false }] }],
      },
    ],
  },
];

const deals: PosDeal[] = [
  {
    slug: "meal-deal", name: "Meal Deal", price: 1999, description: "",
    slots: [{ name: "Pizza", qty: 1, sizeKeys: ["large"], options: [{ slug: "margherita", name: "Margherita", soldOut: false, description: "", tags: [], sizes: [], groups: [], extra: 200 }] }],
  },
];

test("product line: size price plus modifier prices, times qty", () => {
  const out = priceOffline(
    [{ key: "a", kind: "product", product: "margherita", size: "large", modifiers: [{ group: "extra-toppings", modifier: "mushroom" }], qty: 2 }],
    categories, deals,
  );
  assert.equal(out.lines[0]?.unitPrice, 1299); // 1199 + 100
  assert.equal(out.lines[0]?.lineTotal, 2598);
  assert.equal(out.subtotal, 2598);
  assert.equal(out.total, 2598); // no delivery fee offline
});

test("deal line: fixed price plus the chosen slot's supplement", () => {
  const out = priceOffline(
    [{ key: "b", kind: "deal", deal: "meal-deal", qty: 1, components: [{ slot: 0, product: "margherita", size: "large", modifiers: [] }] }],
    categories, deals,
  );
  assert.equal(out.lines[0]?.unitPrice, 2199); // 1999 + 200
  assert.equal(out.subtotal, 2199);
});

test("an unknown product/deal falls back to the basket line's own cached price rather than throwing", () => {
  const out = priceOffline([{ key: "c", kind: "product", product: "ghost", qty: 1, unitPrice: 500 }], categories, deals);
  assert.equal(out.lines[0]?.unitPrice, 500);
});
