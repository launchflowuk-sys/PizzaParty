import "server-only";
import { prisma, type Prisma } from "@launchflow/db";
import type Stripe from "stripe";
import { gbp } from "./money";
import { goodwillPence, orderMoney } from "./pos-money";

/**
 * A card refund that did not go through (Stripe refused it now, or failed it
 * later): the payment gets its refundable back, a full-refund status is
 * undone, and any goodwill written off the order is owed again. Holds the
 * order row like every other money write. Idempotent: a refund already failed
 * is left alone, so a replayed webhook changes nothing.
 * `goodwill` is known to the till when it undoes its own attempt; a later
 * failure reads it from the refund's audit event.
 */
export async function releaseRefund(refundId: string, actor: string, why: string, goodwill?: number): Promise<boolean> {
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.refund.findUnique({ where: { id: refundId }, select: { orderId: true, paymentId: true, amount: true } });
    if (!r) return null;
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${r.orderId} FOR UPDATE`;
    const moved = await tx.refund.updateMany({ where: { id: refundId, status: { not: "failed" } }, data: { status: "failed" } });
    if (!moved.count) return null;
    const p = await tx.payment.update({ where: { id: r.paymentId }, data: { refundedAmount: { decrement: r.amount } } });
    if (p.status === "refunded" && p.refundedAmount < p.amount) {
      await tx.payment.update({ where: { id: p.id }, data: { status: p.provider === "cash" ? "cash_collected" : "succeeded" } });
    }
    const gw = goodwill ?? await goodwillOf(tx, r.orderId, refundId);
    if (gw > 0) await tx.order.update({ where: { id: r.orderId }, data: { writtenOff: { decrement: gw } } });
    return r;
  });
  if (done) await prisma.orderEvent.create({ data: { orderId: done.orderId, type: "refund_failed", actor, message: `${gbp(done.amount)}: ${why}`, data: { refundId } } });
  return !!done;
}

async function goodwillOf(tx: Prisma.TransactionClient, orderId: string, refundId: string): Promise<number> {
  const e = await tx.orderEvent.findFirst({ where: { orderId, type: "refund", data: { path: ["refundId"], equals: refundId } }, select: { data: true } });
  const g = (e?.data as { goodwill?: unknown } | null)?.goodwill;
  return typeof g === "number" && g > 0 ? g : 0;
}

/** refund.updated / refund.failed: a pending card refund has landed or bounced. Scoped to this shop. */
export async function settleStripeRefund(clientId: string, r: Stripe.Refund): Promise<void> {
  const refundId = r.metadata?.refundId;
  const row = await prisma.refund.findFirst({ where: { order: { clientId }, OR: [{ stripeRefundId: r.id }, ...(refundId ? [{ id: refundId }] : [])] }, select: { id: true } });
  if (!row) return; // Made in the dashboard: charge.refunded records it.
  if (r.status === "succeeded") await prisma.refund.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "succeeded", stripeRefundId: r.id } });
  else if (r.status === "failed" || r.status === "canceled") await releaseRefund(row.id, "stripe", r.failure_reason ?? r.status);
}

export const DASHBOARD_REASON = "Refunded in Stripe dashboard";

/**
 * charge.refunded: record any refund on this payment that the shop made in the
 * Stripe dashboard rather than the till, so the drawer report reconciles. Till
 * and reject refunds already have a row (created before Stripe was asked, and
 * matched by metadata.refundId). A dashboard refund is treated like a till
 * one: whatever was not an overpayment is written off, so the order does not
 * reappear as owed. refundedAmount only ever goes up.
 */
export async function recordStripeRefunds(paymentId: string, amountRefunded: number, refunds: Stripe.Refund[]): Promise<void> {
  const out = await prisma.$transaction(async (tx) => {
    const { orderId } = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { orderId: true } });
    const [o] = await tx.$queryRaw<{ total: number; writtenOff: number }[]>`SELECT CASE WHEN status IN ('rejected', 'cancelled') THEN 0 ELSE total END AS total, "writtenOff" FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const known = await tx.refund.findMany({ where: { paymentId }, select: { id: true, stripeRefundId: true } });
    const fresh = refunds.filter((r) => r.status !== "failed" && r.status !== "canceled" && !known.some((k) => k.stripeRefundId === r.id || k.id === r.metadata?.refundId));
    const added = fresh.reduce((s, r) => s + r.amount, 0);
    const refundedAmount = Math.min(p.amount, Math.max(p.refundedAmount + added, amountRefunded));
    if (refundedAmount <= p.refundedAmount && !fresh.length) return null;

    const payments = await tx.payment.findMany({ where: { orderId }, select: { status: true, amount: true, refundedAmount: true } });
    const goodwill = goodwillPence(refundedAmount - p.refundedAmount, orderMoney(o?.total ?? 0, o?.writtenOff ?? 0, payments).refundDue);
    await tx.payment.update({ where: { id: paymentId }, data: { refundedAmount, ...(refundedAmount >= p.amount ? { status: "refunded" } : {}) } });
    if (goodwill) await tx.order.update({ where: { id: orderId }, data: { writtenOff: { increment: goodwill } } });
    const rows = [];
    for (const r of fresh) {
      rows.push(await tx.refund.create({ data: { orderId, paymentId, provider: p.provider, amount: r.amount, reason: DASHBOARD_REASON, actor: "stripe", status: r.status === "succeeded" ? "succeeded" : "pending", stripeRefundId: r.id } }));
    }
    return { orderId, rows, goodwill, refundedAmount };
  });
  if (!out) return;
  // ponytail: goodwill for several dashboard refunds in one event lands on the first row's event; per-refund split if that ever matters.
  for (const [n, r] of out.rows.entries()) {
    await prisma.orderEvent.create({ data: { orderId: out.orderId, type: "refund", actor: "stripe", message: `${gbp(r.amount)} card · ${DASHBOARD_REASON}`, data: { refundId: r.id, paymentId, provider: r.provider, amount: r.amount, goodwill: n === 0 ? out.goodwill : 0, reason: DASHBOARD_REASON } } });
  }
  if (!out.rows.length) await prisma.orderEvent.create({ data: { orderId: out.orderId, type: "refunded", actor: "stripe", message: `Refunded ${gbp(out.refundedAmount)} in total` } });
}
