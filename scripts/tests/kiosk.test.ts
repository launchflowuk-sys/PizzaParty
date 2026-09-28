import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addKioskLine, kioskCount, kioskFulfilments, kioskName, kioskOrderPayment, kioskPayments, kioskTotal,
  pickUpsell, rateLimited, setKioskQty, KIOSK_MAX_QTY,
} from "../../apps/web/src/lib/kiosk-rules";
import { can, landingFor, screenForPath } from "../../apps/web/src/lib/permissions";
import { fulfilmentLabel } from "../../apps/web/src/lib/fulfilment";
import type { BasketLine } from "../../apps/web/src/lib/basket-types";

const coke: BasketLine = { key: "a", kind: "product", product: "coke", size: "can", modifiers: [], qty: 1, unitPrice: 130, lineTotal: 130 };
const pizza: BasketLine = { key: "b", kind: "product", product: "marg", size: "12", modifiers: [{ group: "top", modifier: "ham" }, { group: "top", modifier: "olive" }], qty: 1, unitPrice: 1400, lineTotal: 1400 };

test("the kiosk offers eat in only when the shop allows it, and never delivery", () => {
  assert.deepEqual(kioskFulfilments({ eatIn: true, fulfilment: ["delivery", "collection"] }), ["eat_in", "collection"]);
  assert.deepEqual(kioskFulfilments({ eatIn: false, fulfilment: ["delivery", "collection"] }), ["collection"]);
  assert.deepEqual(kioskFulfilments({ eatIn: false, fulfilment: ["delivery"] }), []);
});

test("card needs the shop's switch, Stripe and a reader on this kiosk", () => {
  assert.deepEqual(kioskPayments({ card: true, payAtCounter: true, stripe: true, readerChosen: true }), ["card", "counter"]);
  assert.deepEqual(kioskPayments({ card: true, payAtCounter: true, stripe: true, readerChosen: false }), ["counter"]);
  assert.deepEqual(kioskPayments({ card: true, payAtCounter: false, stripe: false, readerChosen: true }), []);
});

test("pay at the counter goes to the kitchen owing cash; card waits for the reader", () => {
  const counter = kioskOrderPayment("counter", 2450);
  assert.equal(counter.placeNow, true);
  assert.equal(counter.paymentMethod, "cash");
  assert.deepEqual(counter.payment, { provider: "cash", status: "cash_pending", amount: 2450 });
  const card = kioskOrderPayment("card", 2450);
  assert.equal(card.placeNow, false);
  assert.equal(card.payment, undefined);
  assert.equal(kioskOrderPayment("card", 0).placeNow, true);
});

test("an identical item tops up the qty; a different build is its own line", () => {
  let lines = addKioskLine([coke], { ...coke, key: "c" });
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.qty, 2);
  assert.equal(lines[0]!.lineTotal, 260);
  // Same toppings in another order is still the same pizza.
  lines = addKioskLine(lines, { ...pizza, key: "d", modifiers: [...pizza.modifiers!].reverse() });
  lines = addKioskLine(lines, pizza);
  assert.equal(lines.length, 2);
  assert.equal(lines[1]!.qty, 2);
  lines = addKioskLine(lines, { ...pizza, key: "e", modifiers: [] });
  assert.equal(lines.length, 3);
  assert.equal(kioskCount(lines), 5);
  assert.equal(kioskTotal(lines), 260 + 2800 + 1400);
});

test("qty is capped, and zero removes the line", () => {
  let lines = setKioskQty([coke, pizza], "a", 99);
  assert.equal(lines[0]!.qty, KIOSK_MAX_QTY);
  lines = setKioskQty(lines, "a", 0);
  assert.deepEqual(lines.map((l) => l.key), ["b"]);
});

test("names are cleaned for the kitchen to call out", () => {
  assert.equal(kioskName("  sam   o'neil!! "), "Sam O'neil");
  assert.equal(kioskName("<script>alert(1)</script>"), "Scriptalertscript");
  assert.equal(kioskName("mary-jane"), "Mary-Jane");
  assert.equal(kioskName("12345"), "");
  assert.ok(kioskName("a".repeat(50)).length <= 20);
});

test("upsell skips the category just added and what is already in the basket, one per category first", () => {
  const pool = [
    { slug: "p2", category: "pizza" }, { slug: "wings", category: "sides" }, { slug: "chips", category: "sides" },
    { slug: "cake", category: "desserts" }, { slug: "coke", category: "drinks" },
  ];
  assert.deepEqual(pickUpsell(pool, "pizza", new Set(["cake"])).map((p) => p.slug), ["wings", "coke", "chips"]);
  assert.deepEqual(pickUpsell(pool, "pizza", new Set()).map((p) => p.slug), ["wings", "cake", "coke"]);
});

test("the rate limit counts inside the window only", () => {
  const hits = new Map<string, number[]>();
  for (let i = 0; i < 3; i++) assert.equal(rateLimited(hits, "k", 3, 1000, 10_000 + i), false);
  assert.equal(rateLimited(hits, "k", 3, 1000, 10_500), true);
  assert.equal(rateLimited(hits, "other", 3, 1000, 10_500), false);
  assert.equal(rateLimited(hits, "k", 3, 1000, 11_500), false);
});

test("a kiosk PIN opens the kiosk and nothing else; a manager can open it too", () => {
  assert.equal(can("kiosk", "kiosk"), true);
  for (const s of ["pos", "orders", "kitchen", "reports", "dashboard", "staff", "menu", "dispatch"] as const) assert.equal(can("kiosk", s), false, s);
  assert.equal(can("manager", "kiosk"), true);
  assert.equal(can("front_of_house", "kiosk"), false);
  assert.equal(landingFor("kiosk"), "/kiosk");
  assert.equal(screenForPath("/kiosk"), "kiosk");
});

test("kiosk orders are labelled for the kitchen", () => {
  assert.equal(fulfilmentLabel({ fulfilment: "collection", source: "kiosk" }), "KIOSK · TAKEAWAY");
  assert.equal(fulfilmentLabel({ fulfilment: "eat_in", source: "kiosk", tableNumber: null }), "KIOSK · EAT IN");
  assert.equal(fulfilmentLabel({ fulfilment: "collection", source: "pos" }), "COLLECTION");
});
