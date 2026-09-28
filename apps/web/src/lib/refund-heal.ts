/**
 * Pure decisions for card refunds whose outcome our rows may have got wrong.
 * Stripe is the truth: these only say what to change so the till agrees.
 */

/**
 * What a thrown refunds.create tells us. A 4xx answer means Stripe looked and
 * did not refund. Anything else (no answer, a timeout, a 5xx, a 409 for a key
 * still in use) may have refunded, so the reservation must be kept.
 */
export function stripeRefundOutcome(e: unknown): "refused" | "unknown" {
  const code = (e as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === "number" && code >= 400 && code < 500 && code !== 409 ? "refused" : "unknown";
}

/** A pending row Stripe has no refund for is only given up on after this long. */
export const STALE_PENDING_MS = 15 * 60_000;

export type HealRow = { id: string; status: string; stripeRefundId: string; createdAt: Date };
export type HealStripe = { id: string; status: string | null; amount: number; failure_reason?: string | null; metadata?: Record<string, string> | null };
export type HealPlan<S extends HealStripe = HealStripe> = {
  /** On Stripe, no row: record them. */
  fresh: S[];
  /** Rows to point at their Stripe refund; `revive` when the row is failed but Stripe made it. */
  mark: { id: string; stripeRefundId: string; status: "succeeded" | "pending"; revive: boolean }[];
  /** Rows Stripe failed, or a stale pending one Stripe never made. */
  release: { id: string; why: string }[];
};

const bad = (s: HealStripe) => s.status === "failed" || s.status === "canceled";

/** One card payment's refund rows against Stripe's full refund list for it. */
export function planRefundHeal<S extends HealStripe>(rows: HealRow[], refunds: S[], now = new Date()): HealPlan<S> {
  const plan: HealPlan<S> = { fresh: [], mark: [], release: [] };
  const matched = new Set<string>();
  for (const row of rows) {
    const s = refunds.find((x) => (row.stripeRefundId && x.id === row.stripeRefundId) || x.metadata?.refundId === row.id);
    if (!s) {
      if (row.status === "pending" && now.getTime() - row.createdAt.getTime() >= STALE_PENDING_MS) plan.release.push({ id: row.id, why: "Stripe has no record of this refund" });
      continue;
    }
    matched.add(s.id);
    if (bad(s)) {
      if (row.status !== "failed") plan.release.push({ id: row.id, why: s.failure_reason ?? s.status ?? "failed" });
      continue;
    }
    const status = s.status === "succeeded" || row.status === "succeeded" ? "succeeded" : "pending";
    if (row.status === "failed" || (row.status === "pending" && status === "succeeded") || !row.stripeRefundId) {
      plan.mark.push({ id: row.id, stripeRefundId: s.id, status, revive: row.status === "failed" });
    }
  }
  plan.fresh = refunds.filter((s) => !bad(s) && !matched.has(s.id));
  return plan;
}
