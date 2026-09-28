import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays, buildDayReport, dateIn, dayBounds, dayReportCsv, drawerFigures, driverOwed, isDate, managerPence, matchStripe,
  type ReportInput, type ReportOrder,
} from "../../apps/web/src/lib/pos-report-math";

test("day bounds follow the shop's clock, clock changes included", () => {
  const plain = dayBounds("Europe/London", "2026-09-28");
  assert.equal(plain.start.toISOString(), "2026-09-27T23:00:00.000Z");
  assert.equal(plain.end.toISOString(), "2026-09-28T23:00:00.000Z");
  const spring = dayBounds("Europe/London", "2026-03-29");
  assert.equal(spring.start.toISOString(), "2026-03-29T00:00:00.000Z");
  assert.equal(spring.end.getTime() - spring.start.getTime(), 23 * 3600_000, "clocks go forward: a 23 hour day");
  const autumn = dayBounds("Europe/London", "2026-10-25");
  assert.equal(autumn.start.toISOString(), "2026-10-24T23:00:00.000Z");
  assert.equal(autumn.end.getTime() - autumn.start.getTime(), 25 * 3600_000, "clocks go back: a 25 hour day");
  assert.equal(dateIn("Europe/London", new Date("2026-09-27T23:30:00Z")), "2026-09-28", "half eleven UTC is half twelve BST, the next day");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.ok(isDate("2026-02-28"));
  assert.ok(!isDate("2026-02-30"));
  assert.ok(!isDate("28/09/2026"));
});

test("drawer: expected is float + counter cash - cash refunds + pay-ins + driver hand-ins - pay-outs", () => {
  const f = drawerFigures(10000, [
    { kind: "pay_out", amount: 2000, driverId: null },
    { kind: "pay_in", amount: 500, driverId: null },
    { kind: "pay_in", amount: 1850, driverId: "d1" },
  ], 4250, 1200);
  assert.deepEqual(f, { float: 10000, cashSales: 4250, cashRefunds: 1200, payIns: 500, driverHandIns: 1850, payOuts: 2000, expected: 10000 + 4250 - 1200 + 500 + 1850 - 2000 });
  assert.equal(driverOwed(3000, 1850), 1150);
  assert.equal(driverOwed(1000, 1500), 0);
});

test("manager discount comes from the last discount or edit event", () => {
  assert.equal(managerPence([]), 0);
  assert.equal(managerPence([{ type: "discount", data: { pence: 300 } }]), 300);
  assert.equal(managerPence([{ type: "discount", data: { pence: 300 } }, { type: "amended", data: { manual: { pence: 450 } } }]), 450, "an edit recomputed a percent discount");
  assert.equal(managerPence([{ type: "amended", data: { manual: null } }]), 0);
});

const order = (o: Partial<ReportOrder>): ReportOrder => ({
  id: "o", number: 1, source: "pos", takenBy: "Amy", status: "completed", customerName: "Walk-in",
  subtotal: 1000, deliveryFee: 0, discount: 0, total: 1000, writtenOff: 0, placedAt: new Date("2026-09-28T12:00:00Z"),
  managerDiscount: 0, items: [], payments: [{ status: "cash_collected", amount: 1000 }], ...o,
});

const input = (o: Partial<ReportInput>): ReportInput => ({
  date: "2026-09-28", timezone: "Europe/London",
  from: new Date("2026-09-27T23:00:00Z"), to: new Date("2026-09-28T23:00:00Z"), now: new Date("2026-09-28T22:00:00Z"),
  orders: [], payments: [], refunds: [], voids: [], drawers: [], driverCash: { collected: 0, handedIn: 0, owed: 0 }, ...o,
});

test("Z report: sales split, discounts, channels, staff, outstanding and top sellers add up", () => {
  const r = buildDayReport(input({
    orders: [
      order({ id: "a", number: 1, source: "web", takenBy: null, subtotal: 2000, deliveryFee: 250, discount: 200, total: 2050, items: [{ name: "Margherita", qty: 2, lineTotal: 2000 }], payments: [{ status: "succeeded", amount: 2050 }] }),
      order({ id: "b", number: 2, source: "pos", takenBy: "Amy", subtotal: 1500, discount: 500, managerDiscount: 300, total: 1000, items: [{ name: "Margherita", qty: 1, lineTotal: 1000 }, { name: "Coke", qty: 3, lineTotal: 500 }] }),
      order({ id: "c", number: 3, source: "phone", takenBy: "Ben", subtotal: 1800, total: 1800, items: [{ name: "Garlic bread", qty: 1, lineTotal: 1800 }], payments: [{ status: "cash_pending", amount: 1800 }] }),
      order({ id: "d", number: 4, status: "cancelled", total: 900 }),
    ],
    payments: [{ provider: "stripe", amount: 2050 }, { provider: "cash", amount: 1000 }, { provider: "stripe_terminal", amount: 700 }],
    refunds: [
      { id: "r1", orderId: "a", orderNumber: 1, orderPlacedAt: new Date("2026-09-28T12:00:00Z"), provider: "stripe", amount: 300, reason: "cold", goodwill: 300, at: new Date("2026-09-28T13:00:00Z") },
      { id: "r2", orderId: "z", orderNumber: 99, orderPlacedAt: new Date("2026-09-27T19:00:00Z"), provider: "cash", amount: 400, reason: "late", goodwill: 0, at: new Date("2026-09-28T13:00:00Z") },
    ],
    voids: [{ orderId: "b", orderNumber: 2, qty: 2, name: "Chips", value: 600, reason: "changed mind", by: "Amy", approvedBy: "", at: "2026-09-28T12:10:00.000Z" }],
  }));
  assert.equal(r.sales.orders, 3, "cancelled is not a sale");
  assert.equal(r.sales.total, 2050 + 1000 + 1800);
  assert.equal(r.sales.subtotal + r.sales.deliveryFees - r.sales.promoDiscounts - r.sales.managerDiscounts, r.sales.total);
  assert.equal(r.sales.managerDiscounts, 300);
  assert.equal(r.sales.promoDiscounts, 400);
  assert.equal(r.sales.averageOrder, Math.round(4850 / 3));
  assert.deepEqual(r.byChannel.map((c) => [c.channel, c.count, c.amount]), [["web", 1, 2050], ["app", 0, 0], ["pos", 1, 1000], ["phone", 1, 1800]]);
  assert.deepEqual(r.byStaff.map((s) => s.name), ["Online", "Ben", "Amy"]);
  assert.deepEqual(r.takings.map((t) => t.amount), [2050, 700, 1000]);
  assert.deepEqual(r.refunds.map((t) => t.amount), [300, 0, 400]);
  assert.equal(r.netTakings, 3750 - 700);
  assert.equal(r.goodwill, 300);
  assert.deepEqual(r.voids, { count: 2, amount: 600, lines: r.voids.lines });
  assert.deepEqual(r.cancelled, { count: 1, amount: 900 });
  assert.equal(r.outstanding.amount, 1800, "the phone order is still owed");
  assert.equal(r.outstanding.orders[0]?.number, 3);
  assert.deepEqual(r.topProducts[0], { name: "Margherita", qty: 3, revenue: 3000 });
  assert.equal(r.adjustments.length, 1, "a refund on yesterday's order is an adjustment");
  assert.equal(r.adjustments[0]?.orderDate, "2026-09-27");
  assert.equal(r.cashExpected, null, "no drawer used");
  assert.equal(r.tips, 0);
});

test("CSV is one row per figure and cannot smuggle in a formula", () => {
  const r = buildDayReport(input({ orders: [order({ takenBy: "=HYPERLINK(\"x\")", customerName: "A, B" })] }));
  const csv = dayReportCsv(r);
  assert.ok(csv.startsWith("section,item,count,amount_gbp\r\n"));
  assert.ok(csv.includes(`staff,"'=HYPERLINK(""x"")",1,10\r\n`), csv);
  assert.ok(csv.includes("sales,orders,1,10\r\n"));
});

test("Stripe match: ok, missing either side, amount mismatch, refunds by id, payouts apart", () => {
  const at = new Date("2026-09-28T12:00:00Z");
  const m = matchStripe(
    [
      { paymentId: "p1", orderId: "o1", orderNumber: 1, kind: "card", amount: 1000, paymentIntent: "pi_1", at },
      { paymentId: "p2", orderId: "o2", orderNumber: 2, kind: "reader", amount: 500, paymentIntent: "pi_2", at },
      { paymentId: "p3", orderId: "o3", orderNumber: 3, kind: "card", amount: 700, paymentIntent: "pi_3", at },
    ],
    [{ refundId: "r1", orderId: "o1", orderNumber: 1, kind: "card", amount: 200, stripeRefundId: "re_1", paymentIntent: "pi_1", at }],
    [
      { id: "t1", type: "charge", amount: 1000, fee: 35, net: 965, paymentIntent: "pi_1", refundId: "", created: at },
      { id: "t2", type: "charge", amount: 450, fee: 10, net: 440, paymentIntent: "pi_2", refundId: "", created: at },
      { id: "t4", type: "charge", amount: 900, fee: 20, net: 880, paymentIntent: "pi_9", refundId: "", created: at },
      { id: "t5", type: "refund", amount: -200, fee: 0, net: -200, paymentIntent: "pi_1", refundId: "re_1", created: at },
      { id: "t6", type: "payout", amount: -5000, fee: 0, net: -5000, paymentIntent: "", refundId: "", created: at },
      { id: "t7", type: "refund", amount: -300, fee: 0, net: -300, paymentIntent: "pi_2", refundId: "re_bounced", created: at },
      { id: "t8", type: "refund_failure", amount: 300, fee: 0, net: 300, paymentIntent: "pi_2", refundId: "re_bounced", created: at },
    ],
  );
  const flag = (id: string) => m.rows.find((r) => r.paymentId === id || r.paymentIntent === id)?.flag;
  assert.equal(flag("p1"), "ok");
  assert.equal(flag("p2"), "amount_mismatch");
  assert.equal(flag("p3"), "missing_in_stripe");
  assert.equal(flag("pi_9"), "missing_in_till");
  assert.equal(m.rows.find((r) => r.type === "refund")?.flag, "ok");
  assert.equal(m.mismatches, 3, "a refund Stripe bounced back is not a mismatch");
  assert.deepEqual(m.stripe, { charges: 2350, refunds: 200, fees: 65, net: 2085, other: -5000 });
  assert.deepEqual(m.till, { card: 1700, reader: 500, refunds: 200 });
});
