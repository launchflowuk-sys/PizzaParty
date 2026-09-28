import "server-only";
import { z } from "zod";
import { prisma, type OrderStatus, type Prisma } from "@launchflow/db";
import { LineSchema } from "./checkout";
import { getMenu } from "./menu";
import { priceBasket } from "./pricing";
import { deliveryTermsFor } from "./postcode";
import { getConfig } from "./config";
import { gbp } from "./money";
import { postPrinter } from "./notify";
import { addEvent, markPlaced, writeItems } from "./orders";
import { managerForPin, type PosStaff } from "./pos";
import { goodwillPence, isSettled, orderMoney, repriceAfterEdit, type EditPromo } from "./pos-money";
import { EDITABLE, PosError, VOID_NEEDS_PIN } from "./pos-queue";
import { connectOpts, getStripe } from "./stripe";
import type { BasketLine, PricedLine } from "./basket-types";

export const EditBody = z.object({
  add: z.array(LineSchema).max(50).default([]),
  remove: z.array(z.object({ orderItemId: z.string().min(1).max(40), reason: z.string().trim().min(2).max(120) })).max(50).default([]),
  managerPin: z.string().min(1).max(64).optional(),
}).refine((b) => b.add.length + b.remove.length > 0, { message: "Add or remove at least one item." });

/** One line on a change ticket, snapshotted into the event so the ticket prints the same forever. */
export type ChangeLine = { qty: number; name: string; size: string; modifiers: string[]; components: string[]; notes: string; lineTotal: number; reason?: string };
export type ChangeData = { added: ChangeLine[]; removed: ChangeLine[]; before: { subtotal: number; discount: number; total: number }; after: { subtotal: number; discount: number; total: number }; manual: { kind: "percent" | "amount"; value: number; pence: number } | null; approvedBy: string | null };

const comp = (c: { name: string; sizeName: string; modifiers: { name: string }[] }) => `${c.name}${c.sizeName ? ` (${c.sizeName})` : ""}${c.modifiers.length ? ` +${c.modifiers.map((m) => m.name).join(", ")}` : ""}`;
const fromPriced = (l: PricedLine): ChangeLine => ({ qty: l.qty, name: l.name, size: l.sizeName, modifiers: l.modifiers.map((m) => m.name), components: l.components.map(comp), notes: l.notes, lineTotal: l.lineTotal });

export function changeText(number: number, d: Pick<ChangeData, "added" | "removed">): string {
  const row = (l: ChangeLine) => `${l.qty} x ${l.name}${l.size ? ` (${l.size})` : ""}${l.modifiers.length ? ` +${l.modifiers.join(", ")}` : ""}${l.components.map((c) => `\n   - ${c}`).join("")}${l.notes ? `\n   note: ${l.notes}` : ""}`;
  return [`#${number} ORDER CHANGED`, ...d.added.map((l) => `+ ADD ${row(l)}`), ...d.removed.map((l) => `- VOID ${row(l)}${l.reason ? `\n   why: ${l.reason}` : ""}`)].join("\n");
}

/** The manager discount as last set: from the till's "discount" event, or the last edit that re-applied it. */
async function currentManual(orderId: string): Promise<ChangeData["manual"]> {
  const e = await prisma.orderEvent.findFirst({ where: { orderId, type: { in: ["discount", "amended"] } }, orderBy: { createdAt: "desc" }, select: { type: true, data: true } });
  const d = (e?.type === "amended" ? (e.data as ChangeData | null)?.manual : e?.data) as { kind?: string; value?: number; pence?: number } | null | undefined;
  return d && (d.kind === "percent" || d.kind === "amount") && typeof d.value === "number" ? { kind: d.kind, value: d.value, pence: d.pence ?? 0 } : null;
}

type EditBodyT = z.infer<typeof EditBody>;

/**
 * Add and void items on a sent order, reprice it, and log it. The order row is
 * locked for the whole write so two tills cannot edit it at once or edit it
 * while /pay is taking the balance.
 */
export async function editOrder(clientId: string, orderId: string, staff: PosStaff, body: EditBodyT) {
  const before = await prisma.order.findFirst({
    where: { id: orderId, clientId },
    select: { status: true, fulfilment: true, deliveryPostcode: true, promoId: true, promoCode: true, location: { select: { deliveryFee: true, minOrder: true, bands: true } } },
  });
  if (!before) throw new PosError("Order not found.", 404);
  if (!EDITABLE.includes(before.status)) throw new PosError(`This order is ${before.status.replace(/_/g, " ")}; it cannot be changed.`, 409);

  let approvedBy: string | null = null;
  if (body.remove.length && VOID_NEEDS_PIN.includes(before.status)) {
    if (!body.managerPin) throw new PosError("The kitchen has started this order: voiding needs a manager PIN.", 403, { needsPin: true });
    approvedBy = await managerForPin(clientId, body.managerPin, staff.id);
    if (!approvedBy) throw new PosError("That manager PIN was not recognised.", 403, { needsPin: true });
  }

  const priced = priceBasket(await getMenu(), body.add as BasketLine[], { fulfilment: before.fulfilment, deliveryFee: 0, minOrder: 0, promo: null });
  if (priced.errors.length) throw new PosError(priced.errors[0]!, 409, { errors: priced.errors, removedKeys: priced.removedKeys });
  const promoRow = before.promoId ? await prisma.promo.findUnique({ where: { id: before.promoId }, select: { type: true, value: true } }) : null;
  const promo: EditPromo = promoRow ? { type: promoRow.type as NonNullable<EditPromo>["type"], value: promoRow.value } : null;
  const manual = await currentManual(orderId);
  const removeIds = [...new Set(body.remove.map((r) => r.orderItemId))];

  const out = await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ status: OrderStatus }[]>`SELECT status::text AS status FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    if (!row || !EDITABLE.includes(row.status)) throw new PosError(`This order is ${row?.status ?? "gone"}; it cannot be changed.`, 409);
    if (removeIds.length && VOID_NEEDS_PIN.includes(row.status) && !approvedBy) throw new PosError("The kitchen has just started this order: voiding needs a manager PIN.", 403, { needsPin: true });
    if (await tx.payment.count({ where: { orderId, status: "processing" } })) throw new PosError("A card payment is in progress on this order. Finish or cancel it first.", 409);

    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { number: true, subtotal: true, deliveryFee: true, discount: true, total: true, writtenOff: true } });
    const removed = removeIds.length ? await tx.orderItem.findMany({ where: { orderId, parentId: null, id: { in: removeIds } }, include: { modifiers: true, components: { include: { modifiers: true } } } }) : [];
    if (removed.length !== removeIds.length) throw new PosError("That item is not on this order any more.", 404);
    const left = await tx.orderItem.count({ where: { orderId, parentId: null, id: { notIn: removeIds } } });
    if (left + priced.lines.length === 0) throw new PosError("That would void every item. Cancel the order instead.", 409);

    const next = repriceAfterEdit({ ...o, promo, manual, manualPence: manual?.pence ?? 0 }, removed.reduce((s, i) => s + i.lineTotal, 0), priced.subtotal);
    await writeItems(tx, orderId, priced.lines, body.add as BasketLine[]);
    if (removeIds.length) {
      // Voided lines go; the event below keeps a full copy for the record and the Z report.
      await tx.orderItem.deleteMany({ where: { parentId: { in: removeIds } } });
      await tx.orderItem.deleteMany({ where: { id: { in: removeIds } } });
    }
    await tx.order.update({ where: { id: orderId }, data: { subtotal: next.subtotal, discount: next.discount, total: next.total, amendedAt: new Date() } });

    // A pay-later placeholder stands for what is owed, so it follows the new total.
    const payments = await tx.payment.findMany({ where: { orderId }, select: { status: true, amount: true, refundedAmount: true } });
    const money = orderMoney(next.total, o.writtenOff, payments);
    const pending = { orderId, provider: "cash", status: "cash_pending" as const };
    if (money.balance > 0) await tx.payment.updateMany({ where: pending, data: { amount: money.balance } });
    else await tx.payment.deleteMany({ where: pending });

    const reasons = new Map(body.remove.map((r) => [r.orderItemId, r.reason]));
    const data: ChangeData = {
      added: priced.lines.map(fromPriced),
      removed: removed.map((i) => ({ qty: i.qty, name: i.name, size: i.sizeName, modifiers: i.modifiers.map((m) => m.name), components: i.components.map(comp), notes: i.notes, lineTotal: i.lineTotal, reason: reasons.get(i.id) })),
      before: { subtotal: o.subtotal, discount: o.discount, total: o.total },
      after: { subtotal: next.subtotal, discount: next.discount, total: next.total },
      manual: manual ? { ...manual, pence: next.manualPence } : null,
      approvedBy,
    };
    const message = [
      ...data.added.map((l) => `+${l.qty}× ${l.name}`),
      ...data.removed.map((l) => `−${l.qty}× ${l.name} (${l.reason})`),
    ].join("; ") + ` · ${gbp(o.total)} → ${gbp(next.total)}${approvedBy ? ` · approved by ${approvedBy}` : ""}`;
    const event = await tx.orderEvent.create({ data: { orderId, type: "amended", actor: staff.name, message, data: data as unknown as Prisma.InputJsonValue } });
    return { event, data, number: o.number, status: row.status, money };
  });

  const warnings: string[] = [];
  if (before.fulfilment === "delivery") {
    const min = deliveryTermsFor(before.deliveryPostcode, before.location, before.location.bands).minOrder;
    if (out.data.after.subtotal < min) warnings.push(`Now below the ${gbp(min)} delivery minimum.`);
  }
  if (out.money.refundDue > 0) warnings.push(`${gbp(out.money.refundDue)} is now owed back to the customer.`);

  // An unpaid till order the edit has made fully covered (or free) goes to the kitchen now.
  if (out.status === "pending_payment" && out.money.balance === 0) await markPlaced(orderId, staff.name);

  // The kitchen has not seen an unpaid till order yet, so there is no change to print for it.
  const url = getConfig().notifications.printerWebhook;
  let printer: { ok: boolean; error?: string } | null = null;
  if (url && out.status !== "pending_payment") {
    printer = await postPrinter(url, { id: orderId, number: out.number, kind: "changes", eventId: out.event.id, text: changeText(out.number, out.data), changes: { added: out.data.added, removed: out.data.removed } });
    await addEvent(orderId, "print_sent", "system", `changes: ${printer.ok ? "ok" : printer.error ?? "failed"}`);
  }
  return { eventId: out.event.id, printer, warnings };
}

export const RefundBody = z.object({
  amount: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().min(2).max(200),
  managerPin: z.string().min(1).max(64),
  paymentId: z.string().min(1).max(40).optional(),
});
type RefundBodyT = z.infer<typeof RefundBody>;

const DOUBLE_TAP_MS = 10_000;

/**
 * Send money back against one payment. The order row is locked while the
 * refund is reserved (refundedAmount goes up before Stripe is asked), so a
 * double tap or a second till sees the smaller refundable figure. A Stripe
 * failure puts the reservation back.
 */
export async function refundPayment(clientId: string, orderId: string, staff: PosStaff, body: RefundBodyT) {
  const exists = await prisma.order.findFirst({ where: { id: orderId, clientId }, select: { id: true } });
  if (!exists) throw new PosError("Order not found.", 404);
  const approvedBy = await managerForPin(clientId, body.managerPin, staff.id);
  if (!approvedBy) throw new PosError("That manager PIN was not recognised.", 403);

  const r = await prisma.$transaction(async (tx) => {
    // A rejected or cancelled order owes nothing, so all it holds is due back (none of it is goodwill).
    const [row] = await tx.$queryRaw<{ total: number; writtenOff: number }[]>`SELECT CASE WHEN status IN ('rejected', 'cancelled') THEN 0 ELSE total END AS total, "writtenOff" FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    if (!row) throw new PosError("Order not found.", 404);
    const payments = await tx.payment.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } });
    const refundable = (p: (typeof payments)[number]) => (isSettled(p.status) ? p.amount - p.refundedAmount : 0);
    const p = body.paymentId ? payments.find((x) => x.id === body.paymentId) : payments.find((x) => refundable(x) >= body.amount);
    if (!p) {
      if (body.paymentId) throw new PosError("Payment not found.", 404);
      throw new PosError(payments.some((x) => refundable(x) > 0) ? "No single payment covers that amount. Pick a payment and refund in parts." : "Nothing on this order can be refunded.", 409);
    }
    if (refundable(p) < body.amount) throw new PosError(refundable(p) ? `Only ${gbp(refundable(p))} can go back on that payment.` : "That payment has nothing left to refund.", 409);
    if (p.provider !== "cash" && !p.stripePaymentIntentId) throw new PosError("That card payment has no Stripe record to refund against.", 409);
    const dup = await tx.refund.findFirst({ where: { paymentId: p.id, amount: body.amount, status: { not: "failed" }, createdAt: { gt: new Date(Date.now() - DOUBLE_TAP_MS) } }, select: { id: true } });
    if (dup) throw new PosError("That refund was just made.", 409, { refundId: dup.id });

    const goodwill = goodwillPence(body.amount, orderMoney(row.total, row.writtenOff, payments).refundDue);
    const refund = await tx.refund.create({
      data: { orderId, paymentId: p.id, provider: p.provider, amount: body.amount, reason: body.reason, actor: staff.name, approvedBy, status: p.provider === "cash" ? "succeeded" : "pending" },
    });
    const full = p.refundedAmount + body.amount >= p.amount;
    await tx.payment.update({ where: { id: p.id }, data: { refundedAmount: { increment: body.amount }, ...(full ? { status: "refunded" } : {}) } });
    if (goodwill) await tx.order.update({ where: { id: orderId }, data: { writtenOff: { increment: goodwill } } });
    return { refund, payment: p, goodwill };
  });

  const { refund, payment, goodwill } = r;
  const undo = async (why: string) => {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { refundedAmount: { decrement: body.amount }, status: payment.status } }),
      prisma.refund.update({ where: { id: refund.id }, data: { status: "failed" } }),
      ...(goodwill ? [prisma.order.update({ where: { id: orderId }, data: { writtenOff: { decrement: goodwill } } })] : []),
    ]);
    await addEvent(orderId, "refund_failed", staff.name, `${gbp(body.amount)}: ${why}`, { refundId: refund.id });
  };

  let final = refund;
  if (payment.provider !== "cash") {
    try {
      const s = await getStripe().refunds.create(
        { payment_intent: payment.stripePaymentIntentId, amount: body.amount, metadata: { orderId, refundId: refund.id } },
        { idempotencyKey: `refund_${refund.id}`, ...(connectOpts(getConfig().payments.stripeAccountId) ?? {}) },
      );
      if (s.status === "failed" || s.status === "canceled") {
        await undo(s.failure_reason ?? s.status);
        throw new PosError(`Stripe refused the refund (${s.failure_reason ?? s.status}).`, 502);
      }
      final = await prisma.refund.update({ where: { id: refund.id }, data: { stripeRefundId: s.id, status: s.status === "succeeded" ? "succeeded" : "pending" } });
    } catch (e) {
      if (e instanceof PosError) throw e;
      const why = (e as Error).message;
      await undo(why);
      throw new PosError(`Stripe refused the refund: ${why}`, 502);
    }
  }
  const kind = payment.provider === "cash" ? "cash" : payment.provider === "stripe_terminal" ? "card (reader)" : "card (online)";
  await addEvent(orderId, "refund", staff.name, `${gbp(body.amount)} ${kind} · ${body.reason} · approved by ${approvedBy}`, {
    refundId: final.id, paymentId: payment.id, provider: payment.provider, amount: body.amount, goodwill, reason: body.reason, approvedBy,
  });
  return final;
}
