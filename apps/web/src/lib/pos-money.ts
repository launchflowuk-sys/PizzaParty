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

export function paidPence(payments: { status: string; amount: number }[]): number {
  return payments.filter((p) => isSettled(p.status)).reduce((s, p) => s + p.amount, 0);
}

export const remainingPence = (total: number, payments: { status: string; amount: number }[]) => Math.max(0, total - paidPence(payments));

export const isFullyPaid = (total: number, payments: { status: string; amount: number }[]) => paidPence(payments) >= total;

/** Change due for a cash part-payment, or null when the customer has not handed over enough. */
export function changeDue(amount: number, tendered: number): number | null {
  if (!Number.isInteger(amount) || !Number.isInteger(tendered) || amount <= 0 || tendered < amount) return null;
  return tendered - amount;
}

/** What may still be charged: the total less money in and reader payments still in flight, so two readers cannot both take the balance. */
export function outstandingPence(total: number, payments: { status: string; amount: number }[]): number {
  const held = payments.filter((p) => isSettled(p.status) || p.status === "processing").reduce((s, p) => s + p.amount, 0);
  return Math.max(0, total - held);
}
