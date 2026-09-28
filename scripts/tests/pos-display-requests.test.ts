import { test } from "node:test";
import assert from "node:assert/strict";
import {
  basketPending, categoryRole, checkDisplayRequest, rankUpsell, rateLimited, DISPLAY_MAX_ADDS,
  type DisplayRequest, type TillHandoff, type UpsellCandidate,
} from "../../apps/web/src/lib/pos-display-requests";

const c = (slug: string, category: string, ordersCount = 0, featured = false): UpsellCandidate =>
  ({ slug, name: slug, category, categoryName: category, price: 100, featured, ordersCount });
const pool = [
  c("garlic-bread", "sides", 50), c("chips", "sides", 90), c("wedges", "sides", 10), c("onion-rings", "sides", 5),
  c("garlic-dip", "dips", 40), c("bbq-dip", "dips", 30),
  c("coke", "drinks", 80), c("diet-coke", "drinks", 70), c("fanta", "drinks", 60),
  c("cookie-dough", "desserts", 20), c("cheesecake", "desserts", 25),
  c("kids-nuggets", "kids-meals", 999), c("penne", "pasta", 999),
];
const pizza = [{ slug: "margherita", category: "pizzas", categoryName: "Pizzas", name: "Margherita" }];

test("roles come from the tenant's own category names", () => {
  assert.equal(categoryRole("pizzas"), "main");
  assert.equal(categoryRole("grilled-chicken"), "main");
  assert.equal(categoryRole("kids-meals"), "main");
  assert.equal(categoryRole("boxes"), "side");
  assert.equal(categoryRole("starters"), "side");
  assert.equal(categoryRole("dips"), "dip");
  assert.equal(categoryRole("drinks"), "drink");
  assert.equal(categoryRole("desserts"), "dessert");
  assert.equal(categoryRole("misc", "Soft Drinks"), "drink");
});

test("pizza with no drink: drinks first, then dips/sides; never a main; at most two per category; six max", () => {
  const out = rankUpsell(pool, pizza).map((x) => x.slug);
  assert.equal(out.length, 6);
  assert.deepEqual(out.slice(0, 2), ["coke", "diet-coke"]);
  assert.ok(!out.includes("fanta"), "third drink is capped");
  assert.ok(!out.includes("kids-nuggets") && !out.includes("penne"), "mains never suggested");
  assert.ok(out.includes("garlic-dip") && out.includes("chips"));
});

test("items already in the basket, and a role already covered, drop back", () => {
  const basket = [...pizza, { slug: "coke", category: "drinks", categoryName: "Drinks", name: "Coke" }];
  const out = rankUpsell(pool, basket).map((x) => x.slug);
  assert.ok(!out.includes("coke"));
  assert.ok(out.indexOf("garlic-dip") < out.indexOf("diet-coke") || !out.includes("diet-coke"));
});

test("burger/chicken leans to chips and a drink; popularity breaks ties", () => {
  const out = rankUpsell(pool, [{ slug: "quarter", category: "grilled-chicken", categoryName: "Grilled Chicken", name: "Quarter Chicken" }]).map((x) => x.slug);
  assert.deepEqual(out.slice(0, 4), ["coke", "diet-coke", "chips", "garlic-bread"]);
});

const h: TillHandoff = { id: "handoff-1", added: { "add-req-1": "line1" }, adds: 1 };
const ctx = { tillId: "till-0001", methods: ["card", "cash"] as ("card" | "cash")[], total: 1500, pending: false };
const req = (r: Partial<DisplayRequest> & { type: DisplayRequest["type"] }) => ({ tillId: "till-0001", id: "req-00001", handoff: "handoff-1", ...r }) as DisplayRequest;

test("the till ignores other tills, stale hand-overs and anything outside one", () => {
  assert.equal(checkDisplayRequest(h, req({ type: "ready", tillId: "till-0002" }), ctx), "another till");
  assert.equal(checkDisplayRequest(h, req({ type: "ready", handoff: "old-handoff" } as never), ctx), "not handed over");
  assert.equal(checkDisplayRequest(null, req({ type: "add", slug: "chips" } as never), ctx), "not handed over");
  assert.equal(checkDisplayRequest(null, req({ type: "hello" }), ctx), null, "hello needs no hand-over");
  assert.equal(checkDisplayRequest(h, req({ type: "more" }), ctx), null);
});

test("adds are capped and not applied twice; removes only the display's own lines", () => {
  assert.equal(checkDisplayRequest(h, req({ type: "add", slug: "chips" } as never), ctx), null);
  assert.equal(checkDisplayRequest(h, req({ type: "add", slug: "chips", id: "add-req-1" } as never), ctx), "duplicate");
  assert.equal(checkDisplayRequest({ ...h, adds: DISPLAY_MAX_ADDS }, req({ type: "add", slug: "chips" } as never), ctx), "too many adds");
  assert.equal(checkDisplayRequest(h, req({ type: "remove", ref: "add-req-1" } as never), ctx), null);
  assert.equal(checkDisplayRequest(h, req({ type: "remove", ref: "staff-line" } as never), ctx), "not added by the display");
});

test("pay only by an offered method, for the total the customer saw, once priced", () => {
  assert.equal(checkDisplayRequest(h, req({ type: "pay", method: "card", total: 1500 } as never), ctx), null);
  assert.equal(checkDisplayRequest(h, req({ type: "pay", method: "card", total: 1500 } as never), { ...ctx, methods: ["cash"] }), "method not offered");
  assert.equal(checkDisplayRequest(h, req({ type: "pay", method: "cash", total: 1400 } as never), ctx), "total changed");
  assert.equal(checkDisplayRequest(h, req({ type: "pay", method: "cash", total: 1500 } as never), { ...ctx, pending: true }), "total changed");
});

test("pending until the server has priced every line at its current qty", () => {
  const lines = [{ key: "a", qty: 1 }, { key: "b", qty: 2 }];
  assert.equal(basketPending(lines, { lines: [{ key: "a", qty: 1 }, { key: "b", qty: 2 }] }, false), false);
  assert.equal(basketPending(lines, { lines: [{ key: "a", qty: 1 }, { key: "b", qty: 1 }] }, false), true);
  assert.equal(basketPending(lines, { lines: [{ key: "a", qty: 1 }] }, false), true);
  assert.equal(basketPending(lines, null, false), true);
  assert.equal(basketPending(lines, { lines }, true), true);
});

test("rate limit: 20 a minute per sign-in, then refused until the window slides", () => {
  const hits = new Map<string, number[]>();
  for (let i = 0; i < 20; i++) assert.equal(rateLimited(hits, "k", 20, 60_000, 1000 + i), false);
  assert.equal(rateLimited(hits, "k", 20, 60_000, 2000), true);
  assert.equal(rateLimited(hits, "other", 20, 60_000, 2000), false);
  assert.equal(rateLimited(hits, "k", 20, 60_000, 62_000), false);
});
