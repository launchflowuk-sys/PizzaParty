import { test } from "node:test";
import assert from "node:assert/strict";
import { isOpenAt, nextOpening, preorderSlots, zonedParts } from "../../apps/web/src/lib/availability";
import { matchLocation, matchBand, deliveryTermsFor, normalisePostcode, outwardCode } from "../../apps/web/src/lib/postcode";
import { toE164 } from "../../apps/web/src/lib/phone";

const tz = "Europe/London";
const hours = [
  { dayOfWeek: 5, opens: "16:00", closes: "23:30" }, // Fri
  { dayOfWeek: 6, opens: "17:00", closes: "01:00" }, // Sat, past midnight
];
// 2026-09-04 is a Friday. BST = UTC+1.
const fri2000 = new Date("2026-09-04T19:00:00Z"); // 20:00 local
const fri1200 = new Date("2026-09-04T11:00:00Z");
const sun0030 = new Date("2026-09-05T23:30:00Z"); // Sun 00:30 local

test("zonedParts converts to local wall clock", () => {
  const p = zonedParts(fri2000, tz);
  assert.equal(p.dow, 5); assert.equal(p.minutes, 20 * 60);
});

test("isOpenAt handles same-day and past-midnight ranges", () => {
  assert.equal(isOpenAt(hours, fri2000, tz).open, true);
  assert.equal(isOpenAt(hours, fri1200, tz).open, false);
  assert.equal(isOpenAt(hours, sun0030, tz).open, true, "Saturday's 17:00–01:00 range covers Sunday 00:30");
});

test("nextOpening finds the next slot", () => {
  const n = nextOpening(hours, fri1200, tz)!;
  assert.equal(n.toISOString(), "2026-09-04T15:00:00.000Z"); // 16:00 BST
});

test("preorderSlots respects lead time and closing buffer", () => {
  const slots = preorderSlots([{ dayOfWeek: 5, opens: "16:00", closes: "18:00" }], fri1200, tz, 30, 1);
  assert.equal(slots[0]!.toISOString(), "2026-09-04T15:00:00.000Z");
  assert.equal(slots.at(-1)!.toISOString(), "2026-09-04T16:45:00.000Z");
});

test("postcode helpers", () => {
  assert.equal(normalisePostcode("ss141ab"), "SS14 1AB");
  assert.equal(outwardCode("SS14 1AB"), "SS14");
  assert.equal(outwardCode("rm16"), "RM16");
  const locs = [
    { id: "1", key: "basildon", name: "Basildon", postcodePrefixes: ["SS13", "SS14"], active: true, deliveryFee: 250, minOrder: 1200 },
    { id: "2", key: "grays", name: "Grays", postcodePrefixes: ["RM"], active: true, deliveryFee: 250, minOrder: 1200 },
  ];
  assert.equal(matchLocation("SS14 1AB", locs)?.key, "basildon");
  assert.equal(matchLocation("SS1 1AB", locs), null, "SS1 must not match SS13/SS14");
  assert.equal(matchLocation("RM20 3AA", locs)?.key, "grays", "area-level prefix");
});

test("toE164 normalises UK numbers", () => {
  assert.equal(toE164("07700 900123"), "+447700900123");
  assert.equal(toE164("+44 7700 900123"), "+447700900123");
  assert.equal(toE164("447700900123"), "+447700900123");
  assert.equal(toE164("123"), null);
});

/* ── Banded delivery ──────────────────────────────────────────────────────── */

const band = (name: string, prefixes: string[], fee: number, minOrder = 0, extraMinutes = 0, sortOrder = 0) =>
  ({ name, prefixes, fee, minOrder, extraMinutes, sortOrder });

test("a district band beats an area band that also covers it", () => {
  // The far district is listed precisely because it costs more, so a broad
  // catch-all must not undercut it.
  const bands = [band("All Essex", ["RM"], 199, 0, 0, 0), band("Chafford", ["RM20"], 349, 0, 15, 1)];
  assert.equal(matchBand("RM20 4XX", bands)?.name, "Chafford");
  assert.equal(matchBand("RM17 5AA", bands)?.name, "All Essex");
});

test("band order decides between two equally specific area bands", () => {
  const bands = [band("Second", ["RM"], 299, 0, 0, 1), band("First", ["RM"], 199, 0, 0, 0)];
  assert.equal(matchBand("RM17 5AA", bands)?.name, "First");
});

test("no band means the shop's own fee and minimum", () => {
  const t = deliveryTermsFor("SS99 9ZZ", { deliveryFee: 199, minOrder: 999 }, [band("Town", ["SS13"], 149)]);
  assert.deepEqual(t, { fee: 199, minOrder: 999, extraMinutes: 0, bandName: "" });
});

test("a band with no minimum of its own inherits the shop's", () => {
  const t = deliveryTermsFor("SS13 1AA", { deliveryFee: 199, minOrder: 999 }, [band("Town", ["SS13"], 149, 0, 5)]);
  assert.equal(t.fee, 149);
  assert.equal(t.minOrder, 999, "0 must inherit, not remove the minimum");
  assert.equal(t.extraMinutes, 5);
});

test("a band's own minimum wins when it sets one", () => {
  const t = deliveryTermsFor("RM20 3AA", { deliveryFee: 199, minOrder: 999 }, [band("Far", ["RM20"], 349, 1499, 15)]);
  assert.equal(t.minOrder, 1499);
});

test("bands are matched on the outward code, whatever the customer types", () => {
  const bands = [band("Town", ["SS14"], 149)];
  for (const typed of ["SS14 2AB", "ss142ab", "SS14  2AB"]) {
    assert.equal(matchBand(normalisePostcode(typed), bands)?.name, "Town", typed);
  }
});

test("a shop with no bands at all is unaffected", () => {
  const t = deliveryTermsFor("RM17 5AA", { deliveryFee: 250, minOrder: 1200 }, []);
  assert.deepEqual(t, { fee: 250, minOrder: 1200, extraMinutes: 0, bandName: "" });
});
