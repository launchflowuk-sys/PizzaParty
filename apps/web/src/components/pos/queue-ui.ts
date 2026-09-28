/** Display-only helpers shared by the queue board and the order panel. Nothing
 *  here talks to the server - the wire contract is lib/pos-queue-types.ts. */
import type { OrderSource } from "@/lib/pos-types";
import type { OrderStatus, PaidState } from "@/lib/pos-queue-types";

export const SOURCE_LABEL: Record<OrderSource, string> = { web: "Web", app: "App", pos: "Counter", phone: "Phone" };
/** Four distinct, subtle tag colours - reusing the back-office palette rather than inventing a fifth. */
export const SOURCE_TAG: Record<OrderSource, string> = { web: "tag-info", app: "tag-accent-2", pos: "tag-neutral", phone: "tag-warn" };

export const PAID_LABEL: Record<PaidState, string> = { paid: "Paid", part: "Part", unpaid: "Unpaid", refund_due: "Refund due" };
export const PAID_TAG: Record<PaidState, string> = { paid: "tag-ok", part: "tag-warn", unpaid: "tag-danger", refund_due: "tag-info" };

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending payment", placed: "New", accepted: "Accepted", preparing: "Cooking",
  ready: "Ready", out_for_delivery: "Out for delivery", completed: "Completed", rejected: "Rejected", cancelled: "Cancelled",
};

export const DONE_STATUSES = new Set<OrderStatus>(["completed", "rejected", "cancelled"]);

/** Minutes from ISO `a` to ISO `b` (positive when `b` is later). */
export function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

/**
 * Colour an order card as it gets late. With a due time, count down to it -
 * amber inside the last 5 minutes, red once it has passed. Without one (an
 * order not yet accepted has no ETA), age off placedAt alone.
 * ponytail: two fixed thresholds, not a per-shop setting - add one if a shop
 * ever asks for a different cutoff than "10 minutes waiting is amber".
 */
export function ageTone(order: { placedAt: string; dueAt: string | null }, nowIso: string): "" | "amber" | "red" {
  if (order.dueAt) {
    const toDue = minutesBetween(nowIso, order.dueAt);
    if (toDue <= 0) return "red";
    if (toDue <= 5) return "amber";
    return "";
  }
  const age = minutesBetween(order.placedAt, nowIso);
  if (age >= 15) return "red";
  if (age >= 8) return "amber";
  return "";
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
