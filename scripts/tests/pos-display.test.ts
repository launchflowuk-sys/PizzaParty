import { test } from "node:test";
import assert from "node:assert/strict";
import { fitForNotify, mergeTill, pickTill, TILL_ACTIVE_MS } from "../../apps/web/src/lib/pos-display";
import type { PosDisplayEnvelope } from "../../apps/web/src/lib/pos-phase4-types";

const wrap = (e: PosDisplayEnvelope) => ({ kind: "display", clientId: "c1", ...e });
const basket = (n: number): PosDisplayEnvelope => ({
  tillId: "t1", tillName: "Till 1", at: 1,
  msg: { type: "basket", shopName: "Shop", subtotal: 100 * n, discount: 0, deliveryFee: 0, total: 100 * n,
    lines: Array.from({ length: n }, (_, i) => ({ name: `Large pizza ${i}`, detail: "Extra cheese, jalapenos, red onion, ".repeat(3), qty: 1, lineTotal: 100, image: `/uploads/products/pizza-${i}.jpg` })) },
});

test("a small basket travels whole", () => {
  const out = JSON.parse(fitForNotify(basket(3), wrap));
  assert.equal(out.msg.lines.length, 3);
  assert.equal(out.msg.truncated, undefined);
});

test("a huge basket keeps its first lines under the limit, marked truncated, totals intact", () => {
  const json = fitForNotify(basket(200), wrap);
  assert.ok(new TextEncoder().encode(json).length < 7000);
  const out = JSON.parse(json);
  assert.equal(out.msg.truncated, true);
  assert.ok(out.msg.lines.length > 5 && out.msg.lines.length < 200);
  assert.equal(out.msg.lines[0].name, "Large pizza 0");
  assert.equal(out.msg.total, 20000);
  assert.equal(out.clientId, "c1");
});

test("pairing: one live till is followed, several ask, a remembered live one wins", () => {
  const now = 10 * TILL_ACTIVE_MS;
  const a = { tillId: "a", at: now - 1000 };
  const b = { tillId: "b", at: now - 2000 };
  const stale = { tillId: "old", at: now - TILL_ACTIVE_MS - 1 };
  assert.deepEqual(pickTill([a, stale], null, now), { follow: "a" });
  assert.deepEqual(pickTill([a, b], null, now), { pick: true });
  assert.deepEqual(pickTill([a, b], "b", now), { follow: "b" });
  assert.deepEqual(pickTill([a, b], "old", now), { pick: true });
  assert.deepEqual(pickTill([a], "old", now), { follow: "a" });
  assert.deepEqual(pickTill([], "old", now), { follow: "old" });
  assert.deepEqual(pickTill([stale], null, now), { wait: true });
});

test("merge: later wins, a repeat is ignored, paying keeps the last basket, idle clears it", () => {
  const b1 = mergeTill(undefined, basket(2));
  assert.equal(mergeTill(b1, { ...basket(5), at: 1 }), b1);
  const paying = mergeTill(b1, { tillId: "t1", tillName: "Till 1", at: 2, msg: { type: "paying", total: 200, method: "cash" } });
  assert.equal(paying.basket?.lines.length, 2);
  const idle = mergeTill(paying, { tillId: "t1", tillName: "Till 1", at: 3, msg: { type: "idle", shopName: "Shop" } });
  assert.equal(idle.basket, undefined);
});
