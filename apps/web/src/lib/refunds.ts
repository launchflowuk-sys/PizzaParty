import "server-only";
import { prisma, type Prisma } from "@launchflow/db";
import type Stripe from "stripe";
import { gbp } from "./money";
import { goodwillPence, orderMoney } from "./pos-money";
import { publishOrder } from "./realtime";
import { getConfig } from "./config";
import { connectOpts, getStripe } from "./stripe";
import { planRefundHeal, stripeRefundOutcome } from "./refund-heal";

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
    const gw = goodwill ?? (await goodwillOf(tx, r.orderId, refundId)) ?? 0;
    if (gw > 0) await tx.order.update({ where: { id: r.orderId }, data: { writtenOff: { decrement: gw } } });
    return r;
  });
  if (done) await prisma.orderEvent.create({ data: { orderId: done.orderId, type: "refund_failed", actor, message: `${gbp(done.amount)}: ${why}`, data: { refundId } } });
  if (done) await publishOrder(done.orderId, "refund_failed");
  return !!done;
}

/** Goodwill recorded on the refund's audit event; null when it has none. */
async function goodwillOf(tx: Prisma.TransactionClient, orderId: string, refundId: string): Promise<number | null> {
  const e = await tx.orderEvent.findFirst({ where: { orderId, type: "refund", data: { path: ["refundId"], equals: refundId } }, select: { data: true } });
  if (!e) return null;
  const g = (e.data as { goodwill?: unknown } | null)?.goodwill;
  return typeof g === "number" && g > 0 ? g : 0;
}

/** refund.updated / refund.failed: a pending card refund has landed or bounced. Scoped to this shop. */
export async function settleStripeRefund(clientId: string, r: Stripe.Refund): Promise<void> {
  const refundId = r.metadata?.refundId;
  const row = await prisma.refund.findFirst({ where: { order: { clientId }, OR: [{ stripeRefundId: r.id }, ...(refundId ? [{ id: refundId }] : [])] }, select: { id: true } });
  if (!row) return; // Made in the dashboard: charge.refunded records it.
  // A failed row Stripe says succeeded is revived by charge.refunded, which has the whole list.
  if (r.status === "succeeded") await prisma.refund.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "succeeded", stripeRefundId: r.id } });
  else if (r.status === "failed" || r.status === "canceled") await releaseRefund(row.id, "stripe", r.failure_reason ?? r.status);
}

export const DASHBOARD_REASON = "Refunded in Stripe dashboard";

export type AskedRefund = { refund: Stripe.Refund } | { refused: string } | { unknown: string };

/**
 * Ask Stripe to refund a reserved row. `refused`: Stripe made no refund, so
 * the caller releases the reservation. `unknown`: Stripe may have made it (no
 * answer, a timeout, a 5xx), so the row must stay pending for charge.refunded
 * or a reconcile to settle. Never throws.
 */
export async function askStripeRefund(refundId: string, paymentIntent: string, amount: number, orderId: string): Promise<AskedRefund> {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    return { refused: (e as Error).message }; // Not configured: nothing was sent.
  }
  try {
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntent, amount, metadata: { orderId, refundId } },
      { idempotencyKey: `refund_${refundId}`, ...(connectOpts(getConfig().payments.stripeAccountId) ?? {}) },
    );
    return refund.status === "failed" || refund.status === "canceled" ? { refused: refund.failure_reason ?? refund.status } : { refund };
  } catch (e) {
    const why = (e as Error).message;
    return stripeRefundOutcome(e) === "refused" ? { refused: why } : { unknown: why };
  }
}

type Revived = { id: string; amount: number; goodwill: number };

/**
 * charge.refunded, and the reconcile: make one card payment's refund rows
 * agree with Stripe's full list of refunds on it. Records refunds made in the
 * Stripe dashboard (whatever was not an overpayment is written off, so the
 * order does not reappear as owed), settles pending rows, revives a row we
 * marked failed that Stripe did make (its reservation and goodwill come back),
 * and releases rows Stripe failed or never made. Under the order lock;
 * replays change nothing. refundedAmount only goes down through a release.
 */
export async function recordStripeRefunds(paymentId: string, amountRefunded: number, refunds: Stripe.Refund[]): Promise<void> {
  const out = await prisma.$transaction(async (tx) => {
    const { orderId } = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { orderId: true } });
    const [o] = await tx.$queryRaw<{ total: number; writtenOff: number }[]>`SELECT CASE WHEN status IN ('rejected', 'cancelled') THEN 0 ELSE total END AS total, "writtenOff" FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const known = await tx.refund.findMany({ where: { paymentId }, select: { id: true, status: true, stripeRefundId: true, createdAt: true, amount: true } });
    const plan = planRefundHeal(known, refunds);
    const payments = await tx.payment.findMany({ where: { orderId }, select: { status: true, amount: true, refundedAmount: true } });
    let due = orderMoney(o?.total ?? 0, o?.writtenOff ?? 0, payments).refundDue;

    const revived: Revived[] = [];
    for (const m of plan.mark) {
      const moved = await tx.refund.updateMany({ where: { id: m.id, status: m.revive ? "failed" : { not: "failed" } }, data: { status: m.status, stripeRefundId: m.stripeRefundId } });
      if (!m.revive || !moved.count) continue;
      const amount = known.find((k) => k.id === m.id)!.amount;
      // No audit event (it was never written): treated like a dashboard refund.
      const goodwill = (await goodwillOf(tx, orderId, m.id)) ?? goodwillPence(amount, due);
      due = Math.max(0, due - (amount - goodwill));
      revived.push({ id: m.id, amount, goodwill });
    }
    const revivedPence = revived.reduce((s, r) => s + r.amount, 0);

    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const added = revivedPence + plan.fresh.reduce((s, r) => s + r.amount, 0);
    const refundedAmount = Math.min(p.amount, Math.max(p.refundedAmount + added, amountRefunded));
    const dashGoodwill = goodwillPence(Math.max(0, refundedAmount - p.refundedAmount - revivedPence), due);
    const writeOff = dashGoodwill + revived.reduce((s, r) => s + r.goodwill, 0);
    if (refundedAmount > p.refundedAmount) await tx.payment.update({ where: { id: paymentId }, data: { refundedAmount, ...(refundedAmount >= p.amount ? { status: "refunded" } : {}) } });
    if (writeOff) await tx.order.update({ where: { id: orderId }, data: { writtenOff: { increment: writeOff } } });

    const rows = [];
    for (const r of plan.fresh) {
      rows.push(await tx.refund.create({ data: { orderId, paymentId, provider: p.provider, amount: r.amount, reason: DASHBOARD_REASON, actor: "stripe", status: r.status === "succeeded" ? "succeeded" : "pending", stripeRefundId: r.id } }));
    }
    return { orderId, rows, revived, dashGoodwill, grew: refundedAmount > p.refundedAmount, refundedAmount, release: plan.release, marked: plan.mark.length > 0 };
  });

  const { orderId } = out;
  // ponytail: goodwill for several dashboard refunds in one event lands on the first row's event; per-refund split if that ever matters.
  for (const [n, r] of out.rows.entries()) {
    await prisma.orderEvent.create({ data: { orderId, type: "refund", actor: "stripe", message: `${gbp(r.amount)} card · ${DASHBOARD_REASON}`, data: { refundId: r.id, paymentId, provider: r.provider, amount: r.amount, goodwill: n === 0 ? out.dashGoodwill : 0, reason: DASHBOARD_REASON } } });
  }
  for (const r of out.revived) {
    await prisma.orderEvent.create({ data: { orderId, type: "refund_restored", actor: "stripe", message: `${gbp(r.amount)}: Stripe made this refund after all`, data: { refundId: r.id, goodwill: r.goodwill } } });
  }
  if (!out.rows.length && !out.revived.length && out.grew) await prisma.orderEvent.create({ data: { orderId, type: "refunded", actor: "stripe", message: `Refunded ${gbp(out.refundedAmount)} in total` } });
  for (const r of out.release) await releaseRefund(r.id, "stripe", r.why);
  if (out.rows.length || out.grew || out.marked) await publishOrder(orderId, "refund");
}

/**
 * Heal card refunds against Stripe for these PaymentIntents (the Stripe match
 * report's mismatches, say). Returns how many of this shop's payments it checked.
 */
export async function reconcileStripeRefunds(clientId: string, paymentIntents: string[]): Promise<number> {
  const stripe = getStripe();
  const opts = connectOpts(getConfig().payments.stripeAccountId);
  let checked = 0;
  for (const pi of new Set(paymentIntents.filter(Boolean))) {
    const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: pi, order: { clientId } }, select: { id: true } });
    if (!payment) continue;
    const list = await stripe.refunds.list({ payment_intent: pi, limit: 100 }, opts);
    const amountRefunded = list.data.filter((r) => r.status === "succeeded" || r.status === "pending").reduce((s, r) => s + r.amount, 0);
    await recordStripeRefunds(payment.id, amountRefunded, list.data);
    checked++;
  }
  return checked;
}
