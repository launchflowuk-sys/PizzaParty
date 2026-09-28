/**
 * Push offers: who may receive one, how the sends are batched, and the codes
 * minted for a hand-picked list. Marketing consent is the part that must never
 * regress, so it is tested on the rows the send actually groups.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupEligible, chunk, mintCodes, validateCustomOffer, parseOffer, parseAudience, audienceSegment,
  offerUrl, fillPush, pushCustomerWhere, APP_MENU, EXPO_BATCH, type DeviceRow,
} from "../../apps/web/src/lib/push-offers";

const row = (token: string, customerId: string | null, over: Partial<DeviceRow> = {}): DeviceRow => ({
  token, customerId, disabledAt: null, customer: customerId ? { marketingOptIn: true, deletedAt: null } : null, ...over,
});

test("only opted-in, live, non-deleted customers with a device are reachable", () => {
  const g = groupEligible([
    row("t1", "a"),
    row("t2", "a"), // second phone, same person
    row("t1", "a"), // same token twice is one device
    row("t3", null), // guest device: nobody consented
    row("t4", "b", { customer: { marketingOptIn: false, deletedAt: null } }),
    row("t5", "c", { disabledAt: new Date() }),
    row("t6", "d", { customer: { marketingOptIn: true, deletedAt: new Date() } }),
  ]);
  assert.deepEqual([...g.keys()], ["a"]);
  assert.deepEqual(g.get("a"), ["t1", "t2"]);
});

test("the database filter asks for consent, a live account and a live device", () => {
  assert.deepEqual(pushCustomerWhere("c1"), {
    clientId: "c1", marketingOptIn: true, deletedAt: null, pushDevices: { some: { disabledAt: null } },
  });
});

test("sends are batched at Expo's limit of 100", () => {
  const items = Array.from({ length: 250 }, (_, i) => i);
  const batches = chunk(items);
  assert.equal(EXPO_BATCH, 100);
  assert.deepEqual(batches.map((b) => b.length), [100, 100, 50]);
  assert.deepEqual(batches.flat(), items);
  assert.deepEqual(chunk([]), []);
});

test("each picked customer gets a distinct code under the shop's name", () => {
  // A generator that repeats itself forces the collision path.
  const seq = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5];
  let i = 0;
  const codes = mintCodes("friday 20!", ["a", "b"], () => seq[i++ % seq.length]!);
  const a = codes.get("a")!, b = codes.get("b")!;
  assert.match(a, /^FRIDAY20-[A-Z2-9]{5}$/);
  assert.notEqual(a, b);
  assert.equal(mintCodes("", ["x"]).get("x")!.startsWith("OFFER-"), true);
  const many = mintCodes("X", Array.from({ length: 500 }, (_, n) => `c${n}`));
  assert.equal(new Set(many.values()).size, 500);
});

test("custom offers are checked the way checkout reads them", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const ok = validateCustomOffer({ code: "fri20", type: "percent", value: 20, minOrderPounds: 15, days: 7 }, now);
  assert.ok("offer" in ok);
  assert.deepEqual(ok.offer, { code: "FRI20", type: "percent", value: 20, minOrder: 1500, endsAt: new Date("2026-10-05T12:00:00Z") });

  const fixed = validateCustomOffer({ code: "FIVER", type: "fixed", value: 5, minOrderPounds: 20, days: 3 }, now);
  assert.ok("offer" in fixed && fixed.offer.value === 500);

  const free = validateCustomOffer({ code: "FREEDEL", type: "free_delivery", value: 0, minOrderPounds: 0, days: 1 }, now);
  assert.ok("offer" in free && free.offer.value === 0);

  assert.ok("error" in validateCustomOffer({ code: "AB", type: "percent", value: 10, minOrderPounds: 0, days: 7 }, now));
  assert.ok("error" in validateCustomOffer({ code: "BIG", type: "percent", value: 150, minOrderPounds: 0, days: 7 }, now));
  assert.ok("error" in validateCustomOffer({ code: "FREE", type: "fixed", value: 20, minOrderPounds: 20, days: 7 }, now));
  assert.ok("error" in validateCustomOffer({ code: "LONG", type: "percent", value: 10, minOrderPounds: 0, days: 365 }, now));
});

test("the form's offer and audience values parse, and junk falls back safely", () => {
  assert.deepEqual(parseOffer("promo:fri20"), { kind: "promo", code: "FRI20" });
  assert.deepEqual(parseOffer("deal:abc"), { kind: "deal", id: "abc" });
  assert.deepEqual(parseOffer("deal:"), { kind: "none" });
  assert.deepEqual(parseOffer("whatever"), { kind: "none" });

  assert.deepEqual(parseAudience("picked", "a, b,,a"), { kind: "picked", ids: ["a", "b"] });
  assert.deepEqual(parseAudience("segment:regulars", ""), { kind: "segment", key: "regulars" });
  assert.deepEqual(parseAudience("segment:", ""), { kind: "all" });
  assert.equal(audienceSegment({ kind: "picked", ids: [] }), "custom");
  assert.equal(audienceSegment({ kind: "all" }), "all_optin");
});

test("a tap opens the deal, or the menu when there is nothing more specific", () => {
  assert.equal(offerUrl({ dealSlug: "meal for two" }), "/deal/meal%20for%20two");
  assert.equal(offerUrl({ slotTarget: " " }), APP_MENU);
  assert.equal(offerUrl({}), APP_MENU);
});

test("merge fields fill the way the SMS composer's do", () => {
  assert.equal(fillPush("{name}, use {CODE} at {shop}", "Sam Jones", "FRI20", "Pizza Party"), "Sam, use FRI20 at Pizza Party");
  assert.equal(fillPush("Hi {name}", "", "", "X"), "Hi there");
});
