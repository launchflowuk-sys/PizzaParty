import { test } from "node:test";
import assert from "node:assert/strict";
import { goodwillPence, orderMoney, outstandingPence, paidPence, repriceAfterEdit, startOfDayIn } from "../../apps/web/src/lib/pos-money";
import { printUrl } from "../../apps/web/src/lib/pos-queue-types";

const pay = (status: string, amount: number, refundedAmount = 0) => ({ status, amount, refundedAmount });

test("partial refunds come off what a payment counts for; a full refund counts nothing", () => {
  assert.equal(paidPence([pay("succeeded", 2000, 500), pay("cash_collected", 1000)]), 2500);
  assert.equal(paidPence([pay("refunded", 2000, 2000)]), 0);
  assert.equal(outstandingPence(3000, [pay("succeeded", 2000, 500), pay("processing", 500)]), 1000);
});

test("order money: unpaid, part, paid, refund due", () => {
  assert.deepEqual(orderMoney(2000, 0, []), { paid: 0, due: 2000, balance: 2000, refundDue: 0, state: "unpaid" });
  assert.equal(orderMoney(2000, 0, [pay("cash_collected", 500)]).state, "part");
  assert.equal(orderMoney(2000, 0, [pay("succeeded", 2000)]).state, "paid");
  const over = orderMoney(1500, 0, [pay("succeeded", 2000)]);
  assert.equal(over.state, "refund_due");
  assert.equal(over.refundDue, 500);
  assert.equal(orderMoney(1500, 0, [pay("succeeded", 2000, 500)]).state, "paid", "overpayment handed back");
  assert.equal(orderMoney(2000, 0, [pay("cash_pending", 2000)]).state, "unpaid", "pay-later placeholder is not money");
});

test("goodwill refunds are written off, so they never show as owed", () => {
  // Paid 20, total 20, £5 back for a cold pizza.
  const g = goodwillPence(500, orderMoney(2000, 0, [pay("succeeded", 2000)]).refundDue);
  assert.equal(g, 500);
  assert.equal(orderMoney(2000, g, [pay("succeeded", 2000, 500)]).state, "paid");
  // Overpaid by 5 after an edit, refund 8: 5 is the overpayment, 3 is goodwill.
  assert.equal(goodwillPence(800, 500), 300);
  assert.equal(goodwillPence(400, 500), 0);
  // Full refund on a completed order: nothing owed, nothing due back.
  const m = orderMoney(2000, 2000, [pay("refunded", 2000, 2000)]);
  assert.equal(m.balance, 0);
  assert.equal(m.refundDue, 0);
  // Written off more than an edit left: clamps, never negative.
  assert.equal(orderMoney(1200, 2000, []).balance, 0);
});

const base = { subtotal: 2000, deliveryFee: 250, discount: 0, promo: null, manual: null, manualPence: 0 };

test("edit reprice: adds and voids move the subtotal; delivery fee stays", () => {
  assert.deepEqual(repriceAfterEdit(base, 0, 450), { subtotal: 2450, discount: 0, manualPence: 0, total: 2700 });
  assert.deepEqual(repriceAfterEdit(base, 800, 0), { subtotal: 1200, discount: 0, manualPence: 0, total: 1450 });
});

test("edit reprice: percent promo follows the subtotal, fixed promo is capped", () => {
  const pct = { ...base, discount: 200, promo: { type: "percent" as const, value: 10 } };
  assert.equal(repriceAfterEdit(pct, 1000, 0).discount, 100);
  const fixed = { ...base, discount: 500, promo: { type: "fixed" as const, value: 500 } };
  assert.equal(repriceAfterEdit(fixed, 1700, 0).discount, 300, "never more than the subtotal");
  const free = { ...base, discount: 250, promo: { type: "free_delivery" as const, value: 0 } };
  assert.equal(repriceAfterEdit(free, 500, 0).total, 1500);
  const referral = { ...base, discount: 500 };
  assert.equal(repriceAfterEdit(referral, 1800, 0).discount, 200, "unknown promo keeps its pence, capped");
});

test("edit reprice: manager discount percent follows, amount stays, after the promo", () => {
  const pct = { ...base, discount: 200, manual: { kind: "percent" as const, value: 10 }, manualPence: 200 };
  const r = repriceAfterEdit(pct, 0, 1000);
  assert.equal(r.manualPence, 300);
  assert.equal(r.total, 3000 + 250 - 300);
  const amt = { ...base, discount: 1500, promo: { type: "fixed" as const, value: 500 }, manual: { kind: "amount" as const, value: 1000 }, manualPence: 1000 };
  const a = repriceAfterEdit(amt, 1000, 0);
  assert.equal(a.discount, 1000, "£5 promo + £10 manual capped at the £10 subtotal");
  assert.equal(a.total, 250);
});

test("start of day in the shop's timezone", () => {
  // 30 Jun 2026 09:15:30 BST = 08:15:30Z → midnight BST = 29 Jun 23:00Z.
  assert.equal(startOfDayIn("Europe/London", new Date("2026-06-30T08:15:30.250Z")).toISOString(), "2026-06-29T23:00:00.000Z");
  assert.equal(startOfDayIn("Europe/London", new Date("2026-01-15T00:30:00Z")).toISOString(), "2026-01-15T00:00:00.000Z");
  assert.equal(startOfDayIn("UTC", new Date("2026-01-15T23:59:59Z")).toISOString(), "2026-01-15T00:00:00.000Z");
});

test("print urls", () => {
  assert.equal(printUrl("abc", "customer"), "/kitchen/print/abc?copy=customer");
  assert.equal(printUrl("abc", "changes", "ev1"), "/kitchen/print/abc?copy=changes&event=ev1");
});
