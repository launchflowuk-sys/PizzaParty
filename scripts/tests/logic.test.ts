import { test } from "node:test";
import assert from "node:assert/strict";
import { isOpenAt, nextOpening, preorderSlots, zonedParts } from "../../apps/web/src/lib/availability";
import { matchLocation, normalisePostcode, outwardCode } from "../../apps/web/src/lib/postcode";
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
