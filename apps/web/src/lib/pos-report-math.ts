/**
 * Z report, cash drawer and Stripe-match arithmetic. No server imports, so
 * scripts/tests can run it directly. All money in pence; dates are
 * "YYYY-MM-DD" in the shop's timezone.
 */
import { orderMoney, type PayRow } from "./pos-money";
import type { OrderSource } from "./pos-types";
import type { PaymentKind } from "./pos-queue-types";
import type {
  PosAdjustment, PosDayReport, PosDrawer, PosOutstanding, PosVoidLine, StripeMatchRow,
} from "./pos-reports-types";

const KIND: Record<string, PaymentKind> = { stripe: "card", stripe_terminal: "reader", cash: "cash" };
export const kindOf = (provider: string): PaymentKind => KIND[provider] ?? "card";
const KINDS: PaymentKind[] = ["card", "reader", "cash"];
const CHANNELS: OrderSource[] = ["web", "app", "pos", "phone"];
/** Money that actually came in: a later full refund does not un-take it (the refund is counted on its own). */
export const TAKEN = ["succeeded", "cash_collected", "refunded"] as const;
const TOP_N = 10;

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/* ---------- Dates ---------- */

export function isDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The shop's calendar date at an instant. */
export function dateIn(tz: string, at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** How far the wall clock in `tz` is ahead of UTC at an instant. */
function offsetMs(tz: string, at: Date): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight at the start of `date` in `tz`, as an instant. Right on clock-change days too. */
export function midnightIn(tz: string, date: string): Date {
  const guess = Date.parse(`${date}T00:00:00Z`);
  const first = guess - offsetMs(tz, new Date(guess));
  return new Date(guess - offsetMs(tz, new Date(first)));
}

export const dayBounds = (tz: string, date: string) => ({ start: midnightIn(tz, date), end: midnightIn(tz, addDays(date, 1)) });

/* ---------- Drawer ---------- */

export type DrawerMovementRow = { kind: string; amount: number; driverId: string | null };

/** The drawer's parts and what should be in it. Driver hand-ins are pay-ins carrying a driverId. */
export function drawerFigures(float: number, movements: DrawerMovementRow[], cashSales: number, cashRefunds: number) {
  const payIns = sum(movements.filter((m) => m.kind === "pay_in" && !m.driverId), (m) => m.amount);
  const driverHandIns = sum(movements.filter((m) => m.kind === "pay_in" && !!m.driverId), (m) => m.amount);
  const payOuts = sum(movements.filter((m) => m.kind === "pay_out"), (m) => m.amount);
  return { float, cashSales, cashRefunds, payIns, driverHandIns, payOuts, expected: float + cashSales - cashRefunds + payIns + driverHandIns - payOuts };
}

/** What a driver still has to hand in. Never negative: handing in more than collected is refused at settle. */
export const driverOwed = (collected: number, handedIn: number) => Math.max(0, collected - handedIn);

/* ---------- Z report ---------- */

export type ReportEvent = { type: string; data: unknown };

/**
 * The manager discount on an order now, from its events: the till's "discount"
 * event, or the last edit that re-applied it (edits recompute percent ones).
 */
export function managerPence(events: ReportEvent[]): number {
  const last = [...events].reverse().find((e) => e.type === "discount" || e.type === "amended");
  if (!last) return 0;
  const d = (last.type === "amended" ? (last.data as { manual?: { pence?: unknown } | null } | null)?.manual : last.data) as { pence?: unknown } | null | undefined;
  return typeof d?.pence === "number" && d.pence > 0 ? d.pence : 0;
}

export type ReportOrder = {
  id: string; number: number; source: string; takenBy: string | null; status: string; customerName: string;
  subtotal: number; deliveryFee: number; discount: number; total: number; writtenOff: number;
  placedAt: Date;
  managerDiscount: number;
  items: { name: string; qty: number; lineTotal: number }[];
  payments: PayRow[];
};
export type ReportPayment = { provider: string; amount: number };
export type ReportRefund = { id: string; orderId: string; orderNumber: number; orderPlacedAt: Date | null; provider: string; amount: number; reason: string; goodwill: number; at: Date };

export type ReportInput = {
  date: string; timezone: string; from: Date; to: Date; now: Date;
  orders: ReportOrder[];
  /** Money in during the period (status in TAKEN), any order. */
  payments: ReportPayment[];
  /** Refunds made during the period, not failed, any order. */
  refunds: ReportRefund[];
  voids: PosVoidLine[];
  drawers: PosDrawer[];
  driverCash: { collected: number; handedIn: number; owed: number };
};

const VOIDED = ["rejected", "cancelled"];

export function buildDayReport(i: ReportInput): PosDayReport {
  const live = i.orders.filter((o) => !VOIDED.includes(o.status));
  const dead = i.orders.filter((o) => VOIDED.includes(o.status));
  const total = sum(live, (o) => o.total);
  const manager = sum(live, (o) => Math.min(o.discount, o.managerDiscount));

  const staff = new Map<string, { count: number; amount: number }>();
  for (const o of live) {
    const name = o.takenBy || "Online";
    const s = staff.get(name) ?? { count: 0, amount: 0 };
    staff.set(name, { count: s.count + 1, amount: s.amount + o.total });
  }

  const outstanding: PosOutstanding[] = live
    .map((o) => ({ o, balance: orderMoney(o.total, o.writtenOff, o.payments).balance }))
    .filter((x) => x.balance > 0)
    .map(({ o, balance }) => ({ orderId: o.id, number: o.number, customerName: o.customerName, source: o.source as OrderSource, total: o.total, balance }));

  const products = new Map<string, { qty: number; revenue: number }>();
  for (const it of live.flatMap((o) => o.items)) {
    const p = products.get(it.name) ?? { qty: 0, revenue: 0 };
    products.set(it.name, { qty: p.qty + it.qty, revenue: p.revenue + it.lineTotal });
  }

  const adjustments: PosAdjustment[] = i.refunds
    .filter((r) => r.orderPlacedAt && r.orderPlacedAt < i.from)
    .map((r) => ({ refundId: r.id, orderId: r.orderId, orderNumber: r.orderNumber, orderDate: dateIn(i.timezone, r.orderPlacedAt!), kind: kindOf(r.provider), amount: r.amount, reason: r.reason, at: r.at.toISOString() }));

  const takings = KINDS.map((kind) => {
    const rows = i.payments.filter((p) => kindOf(p.provider) === kind);
    return { kind, count: rows.length, amount: sum(rows, (p) => p.amount) };
  });
  const refunds = KINDS.map((kind) => {
    const rows = i.refunds.filter((r) => kindOf(r.provider) === kind);
    return { kind, count: rows.length, amount: sum(rows, (r) => r.amount) };
  });
  const counted = i.drawers.filter((d) => d.counted !== null);

  return {
    date: i.date, timezone: i.timezone, from: i.from.toISOString(), to: i.to.toISOString(), generatedAt: i.now.toISOString(),
    closed: null,
    sales: {
      orders: live.length,
      subtotal: sum(live, (o) => o.subtotal),
      deliveryFees: sum(live, (o) => o.deliveryFee),
      promoDiscounts: sum(live, (o) => o.discount) - manager,
      managerDiscounts: manager,
      total,
      averageOrder: live.length ? Math.round(total / live.length) : 0,
    },
    byChannel: CHANNELS.map((channel) => {
      const rows = live.filter((o) => o.source === channel);
      return { channel, count: rows.length, amount: sum(rows, (o) => o.total) };
    }),
    byStaff: [...staff.entries()].map(([name, s]) => ({ name, ...s })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
    takings,
    refunds,
    netTakings: sum(takings, (t) => t.amount) - sum(refunds, (r) => r.amount),
    goodwill: sum(i.refunds, (r) => r.goodwill),
    tips: 0,
    voids: { count: sum(i.voids, (v) => v.qty), amount: sum(i.voids, (v) => v.value), lines: i.voids },
    cancelled: { count: dead.length, amount: sum(dead, (o) => o.total) },
    outstanding: { count: outstanding.length, amount: sum(outstanding, (o) => o.balance), orders: outstanding },
    topProducts: [...products.entries()].map(([name, p]) => ({ name, ...p })).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, TOP_N),
    adjustments,
    drawers: i.drawers,
    cashExpected: i.drawers.length ? sum(i.drawers, (d) => d.expected) : null,
    cashCounted: counted.length ? sum(counted, (d) => d.counted ?? 0) : null,
    driverCash: i.driverCash,
  };
}

/* ---------- CSV ---------- */

/** A text cell, quoted when needed, and defused so a spreadsheet never runs it as a formula. */
function cell(v: string | number): string {
  if (typeof v === "number") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
const pounds = (p: number) => Number((p / 100).toFixed(2));

export function dayReportCsv(r: PosDayReport): string {
  const rows: (string | number)[][] = [["section", "item", "count", "amount_gbp"]];
  const add = (section: string, item: string, count: number | "", amount: number | null) => rows.push([section, item, count, amount === null ? "" : pounds(amount)]);
  add("period", `${r.date} ${r.from} to ${r.to}${r.closed ? ` closed ${r.closed.at} by ${r.closed.by}` : " (not closed)"}`, "", null);
  add("sales", "orders", r.sales.orders, r.sales.total);
  add("sales", "subtotal", "", r.sales.subtotal);
  add("sales", "delivery fees", "", r.sales.deliveryFees);
  add("sales", "promo discounts", "", r.sales.promoDiscounts);
  add("sales", "manager discounts", "", r.sales.managerDiscounts);
  add("sales", "average order", "", r.sales.averageOrder);
  for (const c of r.byChannel) add("channel", c.channel, c.count, c.amount);
  for (const s of r.byStaff) add("staff", s.name, s.count, s.amount);
  for (const t of r.takings) add("takings", t.kind, t.count, t.amount);
  for (const t of r.refunds) add("refunds", t.kind, t.count, t.amount);
  add("takings", "net", "", r.netTakings);
  add("refunds", "goodwill written off", "", r.goodwill);
  add("tips", "tips", "", r.tips);
  add("voids", "items voided", r.voids.count, r.voids.amount);
  add("cancelled", "rejected or cancelled orders", r.cancelled.count, r.cancelled.amount);
  add("outstanding", "orders owing", r.outstanding.count, r.outstanding.amount);
  for (const o of r.outstanding.orders) add("outstanding", `#${o.number} ${o.customerName}`, 1, o.balance);
  for (const a of r.adjustments) add("adjustment", `#${a.orderNumber} (${a.orderDate}) ${a.kind} refund: ${a.reason}`, 1, -a.amount);
  for (const d of r.drawers) {
    add("drawer", `${d.locationName} opened ${d.openedAt} by ${d.openedBy}`, "", d.float);
    add("drawer", "cash sales", "", d.cashSales);
    add("drawer", "cash refunds", "", -d.cashRefunds);
    add("drawer", "pay-ins", "", d.payIns);
    add("drawer", "driver hand-ins", "", d.driverHandIns);
    add("drawer", "pay-outs", "", -d.payOuts);
    add("drawer", "expected", "", d.expected);
    add("drawer", "counted", "", d.counted);
    add("drawer", "over/short", "", d.overShort);
  }
  add("drivers", "cash collected", "", r.driverCash.collected);
  add("drivers", "handed in", "", r.driverCash.handedIn);
  add("drivers", "still owed", "", r.driverCash.owed);
  for (const p of r.topProducts) add("top products", p.name, p.qty, p.revenue);
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

/* ---------- Stripe match ---------- */

export type TillCard = { paymentId: string; orderId: string; orderNumber: number; kind: PaymentKind; amount: number; paymentIntent: string; at: Date };
export type TillRefund = { refundId: string; orderId: string; orderNumber: number; kind: PaymentKind; amount: number; stripeRefundId: string; paymentIntent: string; at: Date };
/** One Stripe balance transaction, flattened. `amount` is signed as Stripe gives it (refunds negative). */
export type StripeTxn = { id: string; type: string; amount: number; fee: number; net: number; paymentIntent: string; refundId: string; created: Date };

const CHARGE_TYPES = ["charge", "payment"];
// A refund_failure puts a bounced refund back; it nets against the refund by id.
const REFUND_TYPES = ["refund", "payment_refund", "refund_failure"];

/**
 * Our card money against Stripe's ledger. Charges match by PaymentIntent,
 * refunds by Stripe refund id. A payment only we have is missing_in_stripe,
 * one only Stripe has is missing_in_till, and a different amount is
 * amount_mismatch. Payouts and other ledger lines are totalled as `other`.
 */
export function matchStripe(cards: TillCard[], tillRefunds: TillRefund[], txns: StripeTxn[]) {
  const charges = new Map<string, { gross: number; fee: number; net: number; at: Date }>();
  const refunds = new Map<string, { gross: number; fee: number; net: number; at: Date; pi: string }>();
  let other = 0;
  for (const t of txns) {
    if (CHARGE_TYPES.includes(t.type) && t.paymentIntent) {
      const c = charges.get(t.paymentIntent) ?? { gross: 0, fee: 0, net: 0, at: t.created };
      charges.set(t.paymentIntent, { gross: c.gross + t.amount, fee: c.fee + t.fee, net: c.net + t.net, at: c.at });
    } else if (REFUND_TYPES.includes(t.type) && t.refundId) {
      const r = refunds.get(t.refundId) ?? { gross: 0, fee: 0, net: 0, at: t.created, pi: t.paymentIntent };
      refunds.set(t.refundId, { ...r, gross: r.gross - t.amount, fee: r.fee + t.fee, net: r.net + t.net });
    } else {
      other += t.amount;
    }
  }

  const rows: StripeMatchRow[] = [];
  const flag = (till: number, stripe: number | undefined) => (stripe === undefined ? "missing_in_stripe" : stripe === till ? "ok" : "amount_mismatch") as StripeMatchRow["flag"];
  const seenPi = new Set<string>();
  for (const c of cards) {
    // Two till rows can share a PI only by mistake; the second then shows as a mismatch against 0.
    const s = seenPi.has(c.paymentIntent) ? undefined : charges.get(c.paymentIntent);
    seenPi.add(c.paymentIntent);
    rows.push({ type: "charge", flag: flag(c.amount, s?.gross), paymentId: c.paymentId, refundId: null, orderId: c.orderId, orderNumber: c.orderNumber, kind: c.kind, till: c.amount, stripeGross: s?.gross ?? null, stripeFee: s?.fee ?? null, stripeNet: s?.net ?? null, paymentIntent: c.paymentIntent, at: c.at.toISOString() });
  }
  for (const [pi, s] of charges) {
    if (seenPi.has(pi)) continue;
    rows.push({ type: "charge", flag: "missing_in_till", paymentId: null, refundId: null, orderId: null, orderNumber: null, kind: null, till: null, stripeGross: s.gross, stripeFee: s.fee, stripeNet: s.net, paymentIntent: pi, at: s.at.toISOString() });
  }
  const seenRefund = new Set<string>();
  for (const r of tillRefunds) {
    const s = r.stripeRefundId ? refunds.get(r.stripeRefundId) : undefined;
    if (r.stripeRefundId) seenRefund.add(r.stripeRefundId);
    rows.push({ type: "refund", flag: flag(r.amount, s?.gross), paymentId: null, refundId: r.refundId, orderId: r.orderId, orderNumber: r.orderNumber, kind: r.kind, till: r.amount, stripeGross: s?.gross ?? null, stripeFee: s?.fee ?? null, stripeNet: s?.net ?? null, paymentIntent: r.paymentIntent, at: r.at.toISOString() });
  }
  for (const [id, s] of refunds) {
    if (seenRefund.has(id) || s.gross === 0) continue;
    rows.push({ type: "refund", flag: "missing_in_till", paymentId: null, refundId: null, orderId: null, orderNumber: null, kind: null, till: null, stripeGross: s.gross, stripeFee: s.fee, stripeNet: s.net, paymentIntent: s.pi, at: s.at.toISOString() });
  }
  rows.sort((a, b) => a.at.localeCompare(b.at));

  const chargeRows = [...charges.values()];
  const refundRows = [...refunds.values()];
  return {
    stripe: {
      charges: sum(chargeRows, (c) => c.gross),
      refunds: sum(refundRows, (r) => r.gross),
      fees: sum(chargeRows, (c) => c.fee) + sum(refundRows, (r) => r.fee),
      net: sum(chargeRows, (c) => c.net) + sum(refundRows, (r) => r.net),
      other,
    },
    till: {
      card: sum(cards.filter((c) => c.kind === "card"), (c) => c.amount),
      reader: sum(cards.filter((c) => c.kind === "reader"), (c) => c.amount),
      refunds: sum(tillRefunds, (r) => r.amount),
    },
    mismatches: rows.filter((r) => r.flag !== "ok").length,
    rows,
  };
}
