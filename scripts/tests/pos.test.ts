import { test } from "node:test";
import assert from "node:assert/strict";
import { changeDue, isFullyPaid, manualDiscountPence, outstandingPence, paidPence, remainingPence } from "../../apps/web/src/lib/pos-money";

test("manual discount: percent rounds to the penny, amount is taken as pence", () => {
  assert.equal(manualDiscountPence(2599, 0, { kind: "percent", value: 10 }), 260);
  assert.equal(manualDiscountPence(2599, 0, { kind: "amount", value: 500 }), 500);
  assert.equal(manualDiscountPence(2599, 0, null), 0);
  assert.equal(manualDiscountPence(2599, 0, { kind: "amount", value: 0 }), 0);
});

test("manual discount is capped at what is left after a promo, never below zero", () => {
  assert.equal(manualDiscountPence(1000, 0, { kind: "amount", value: 5000 }), 1000);
  assert.equal(manualDiscountPence(1000, 0, { kind: "percent", value: 150 }), 1000);
  assert.equal(manualDiscountPence(1000, 300, { kind: "amount", value: 900 }), 700);
  assert.equal(manualDiscountPence(1000, 1200, { kind: "percent", value: 50 }), 0);
});

const pay = (status: string, amount: number) => ({ status, amount });

test("split payments: only money actually in counts towards the total", () => {
  const ps = [pay("cash_collected", 1000), pay("succeeded", 1500), pay("failed", 2500), pay("cash_pending", 2500), pay("processing", 500)];
  assert.equal(paidPence(ps), 2500);
  assert.equal(isFullyPaid(2500, ps), true);
  assert.equal(isFullyPaid(2501, ps), false);
  assert.equal(remainingPence(3000, ps), 500);
  assert.equal(remainingPence(2000, ps), 0, "overpaid never goes negative");
  assert.equal(isFullyPaid(0, []), true, "a free order is paid");
});

test("outstanding holds back a reader payment still in flight", () => {
  assert.equal(outstandingPence(3000, [pay("cash_collected", 1000), pay("processing", 1500)]), 500);
  assert.equal(outstandingPence(3000, [pay("cash_collected", 1000), pay("failed", 1500)]), 2000);
  assert.equal(outstandingPence(3000, [pay("cash_pending", 3000)]), 3000, "a pay-later placeholder is not money");
});

test("change due", () => {
  assert.equal(changeDue(1850, 2000), 150);
  assert.equal(changeDue(1850, 1850), 0);
  assert.equal(changeDue(1850, 1000), null);
  assert.equal(changeDue(0, 1000), null);
  assert.equal(changeDue(18.5, 20), null, "pence only");
});
