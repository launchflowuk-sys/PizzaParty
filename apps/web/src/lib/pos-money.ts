/** Till arithmetic. No server imports, so scripts/tests can run it directly. All money in pence. */

/** Statuses that mean the money is actually in the shop's hands. */
export const SETTLED = ["succeeded", "cash_collected"] as const;
export const isSettled = (status: string) => (SETTLED as readonly string[]).includes(status);

/**
 * Pence off for a manager discount. Capped at what is left after any promo,
 * so the till can never produce a negative order or pay a customer to eat.
 */
export function manualDiscountPence(subtotal: number, promoDiscount: number, d?: { kind: "percent" | "amount"; value: number } | null): number {
  if (!d || !(d.value > 0)) return 0;
  const cap = Math.max(0, subtotal - promoDiscount);
  const raw = d.kind === "percent" ? Math.round((subtotal * Math.min(d.value, 100)) / 100) : Math.round(d.value);
  return Math.min(raw, cap);
}

/** A payment row as the arithmetic sees it. refundedAmount comes off what it counts for. */
export type PayRow = { status: string; amount: number; refundedAmount?: number };
const net = (p: PayRow) => p.amount - (p.refundedAmount ?? 0);

/** Money in, net of any partial refunds. A fully refunded row is status "refunded" and counts nothing. */
export function paidPence(payments: PayRow[]): number {
  return payments.filter((p) => isSettled(p.status)).reduce((s, p) => s + net(p), 0);
}

export const remainingPence = (total: number, payments: PayRow[]) => Math.max(0, total - paidPence(payments));

export const isFullyPaid = (total: number, payments: PayRow[]) => paidPence(payments) >= total;

/** Change due for a cash part-payment, or null when the customer has not handed over enough. */
export function changeDue(amount: number, tendered: number): number | null {
  if (!Number.isInteger(amount) || !Number.isInteger(tendered) || amount <= 0 || tendered < amount) return null;
  return tendered - amount;
}

/** What may still be charged: the total less money in and reader payments still in flight, so two readers cannot both take the balance. */
export function outstandingPence(total: number, payments: PayRow[]): number {
  const held = payments.filter((p) => isSettled(p.status) || p.status === "processing").reduce((s, p) => s + net(p), 0);
  return Math.max(0, total - held);
}

/**
 * Where an order stands. `writtenOff` is goodwill already refunded on goods
 * the customer kept, so it is no longer owed. `balance` is what /pay may still
 * take; `refundDue` is money held beyond what the order now costs.
 */
export function orderMoney(total: number, writtenOff: number, payments: PayRow[]) {
  const paid = paidPence(payments);
  const due = Math.max(0, total - writtenOff);
  const balance = Math.max(0, due - paid);
  const refundDue = Math.max(0, paid - due);
  const state = balance > 0 ? (paid > 0 ? "part" : "unpaid") : refundDue > 0 ? "refund_due" : "paid";
  return { paid, due, balance, refundDue, state: state as "paid" | "part" | "unpaid" | "refund_due" };
}

/**
 * The part of a refund that is goodwill rather than handing back an
 * overpayment. It is written off the order so it never reappears as owed.
 */
export const goodwillPence = (amount: number, refundDue: number) => Math.max(0, amount - Math.max(0, refundDue));

export type EditPromo = { type: "percent" | "fixed" | "free_delivery"; value: number } | null;

/**
 * New money for an order after items are added or voided. The delivery fee
 * stays. A percent promo or percent manager discount follows the new
 * subtotal; a fixed one keeps its value, capped. A promo we can no longer
 * look up (a referral code) keeps its old pence, capped at the subtotal.
 */
export function repriceAfterEdit(
  o: { subtotal: number; deliveryFee: number; discount: number; promo: EditPromo; manual: { kind: "percent" | "amount"; value: number } | null; manualPence: number },
  removedPence: number,
  addedPence: number,
) {
  const subtotal = Math.max(0, o.subtotal - removedPence + addedPence);
  const oldPromo = Math.max(0, o.discount - o.manualPence);
  const promo = !o.promo ? Math.min(oldPromo, subtotal)
    : o.promo.type === "percent" ? Math.round((subtotal * o.promo.value) / 100)
    : o.promo.type === "fixed" ? Math.min(subtotal, o.promo.value)
    : oldPromo; // free delivery: the fee has not changed
  const manual = manualDiscountPence(subtotal, promo, o.manual);
  const discount = promo + manual;
  return { subtotal, discount, manualPence: manual, total: Math.max(0, subtotal + o.deliveryFee - discount) };
}

/**
 * Midnight today in the shop's timezone, as an instant. Works back from the
 * wall clock there, so it is right on every normal day.
 */
// ponytail: on a clock-change day it can be an hour out until 1am; fine for "today's orders".
export function startOfDayIn(tz: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(now.getTime() - ((n("hour") * 60 + n("minute")) * 60 + n("second")) * 1000 - now.getMilliseconds());
}
