import "server-only";
import { attributeOrder, recordReviewRequest, recordReferralReward } from "./marketing";
import { prisma, type Order, type OrderStatus, type Prisma } from "@launchflow/db";
import { env } from "./env";
import { getConfig } from "./config";
import { gbp } from "./money";
// sendSms is still used directly for the referral reward, which is a message
// to a third party about somebody else's order and so sits outside the
// per-order notification rules.
import { postPrinter, sendSms } from "./notify";
import { notify, STATUS_EVENT } from "./notifications";
import { formatTime } from "./availability";
import { deliveryTermsFor } from "./postcode";
import { revalidateTag } from "next/cache";
import { MENU_TAG } from "./menu";
import { paidPence, remainingPence } from "./pos-money";
import { releaseRefund } from "./refunds";
import { releaseDriver } from "./dispatch";
import type { BasketLine, Fulfilment, PricedBasket } from "./basket-types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  placed: "Order received",
  accepted: "Accepted",
  preparing: "Being prepared",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/**
 * The colour every status wears, everywhere it appears.
 *
 * One map, so the dashboard, the orders table, the dispatch board and the
 * kitchen can never disagree about what "ready" looks like. Consistency is the
 * whole point: staff learn the colours in a shift and stop reading the words.
 */
export const STATUS_TONE: Record<OrderStatus, "ok" | "warn" | "danger" | "info" | "busy" | "neutral"> = {
  pending_payment: "warn",      // money not taken yet
  placed: "info",               // needs a human to accept it
  accepted: "info",
  preparing: "busy",            // in the oven
  ready: "ok",                  // waiting to go out
  out_for_delivery: "busy",
  completed: "ok",
  rejected: "danger",
  cancelled: "danger",
};

/** Rows that want the eye first: something is waiting on a person. */
export const STATUS_ROW: Partial<Record<OrderStatus, "danger" | "warn" | "ok" | "info">> = {
  placed: "info",
  pending_payment: "warn",
  ready: "ok",
  rejected: "danger",
  cancelled: "danger",
};

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["placed", "cancelled"],
  placed: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "ready", "out_for_delivery", "completed", "cancelled"],
  preparing: ["ready", "out_for_delivery", "completed", "cancelled"],
  ready: ["out_for_delivery", "completed", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export const KITCHEN_NEXT: Partial<Record<OrderStatus, { label: string; to: OrderStatus }[]>> = {
  accepted: [{ label: "Preparing", to: "preparing" }],
  preparing: [{ label: "Ready", to: "ready" }],
  ready: [{ label: "Out for delivery", to: "out_for_delivery" }, { label: "Collected / done", to: "completed" }],
  out_for_delivery: [{ label: "Delivered", to: "completed" }],
};

export const orderInclude = {
  // `product` is selected only for its photograph, which the customer emails
  // put against each line. Narrow on purpose: pulling whole products here would
  // drag the description and every price band into memory for nothing.
  items: {
    where: { parentId: null },
    include: {
      modifiers: true,
      components: { include: { modifiers: true } },
      product: { select: { image: true } },
    },
    orderBy: { id: "asc" },
  },
  location: true,
  customer: true,
  payments: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export async function addEvent(orderId: string, type: string, actor = "system", message = "", data?: Prisma.InputJsonValue) {
  return prisma.orderEvent.create({ data: { orderId, type, actor, message, data } });
}

export function orderUrl(order: { id: string }) {
  return `${env.siteUrl}/order/${order.id}`;
}

export function orderText(order: FullOrder): string {
  const lines = order.items.map((i) => {
    const mods = i.modifiers.map((m) => m.name).join(", ");
    const comps = i.components.map((c) => `   - ${c.name}${c.sizeName ? ` (${c.sizeName})` : ""}${c.modifiers.length ? ` +${c.modifiers.map((m) => m.name).join(", ")}` : ""}`).join("\n");
    return `${i.qty} × ${i.name}${i.sizeName ? ` (${i.sizeName})` : ""}${mods ? ` +${mods}` : ""} ${gbp(i.lineTotal)}${i.notes ? `\n   note: ${i.notes}` : ""}${comps ? `\n${comps}` : ""}`;
  });
  const addr = order.fulfilment === "delivery" ? `\n${[order.deliveryLine1, order.deliveryLine2, order.deliveryCity, order.deliveryPostcode].filter(Boolean).join(", ")}` : "";
  return [
    `#${order.number} ${order.fulfilment.toUpperCase()} ${order.paymentMethod === "cash" ? "CASH" : "PAID"}`,
    `${order.customerName} ${order.customerPhone}${addr}`,
    order.scheduledFor ? `Scheduled: ${formatTime(order.scheduledFor, order.location.timezone)}` : "ASAP",
    ...lines,
    order.deliveryFee ? `Delivery ${gbp(order.deliveryFee)}` : "",
    order.discount ? `Discount -${gbp(order.discount)}${order.promoCode ? ` (${order.promoCode})` : ""}` : "",
    `TOTAL ${gbp(order.total)}`,
    order.notes ? `Notes: ${order.notes}` : "",
  ].filter(Boolean).join("\n");
}

export async function getFullOrder(id: string): Promise<FullOrder | null> {
  return prisma.order.findUnique({ where: { id }, include: orderInclude });
}

export type CreateOrderInput = {
  clientId: string;
  locationId: string;
  customerId: string;
  fulfilment: Fulfilment;
  paymentMethod: "card" | "cash";
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  /** Required for delivery; saved to the customer's address book if new. */
  address?: { line1: string; line2: string; city: string };
  postcode: string;
  notes: string;
  scheduledFor: Date | null;
  priced: PricedBasket;
  /** The raw basket lines, index-aligned with priced.lines, kept for one-tap reorder. */
  lines: BasketLine[];
  source: "web" | "app" | "pos" | "phone";
  takenBy?: string | null;
  /** The first payment row; omitted when the till records payments separately. */
  payment?: { provider: string; status: "requires_payment" | "cash_pending"; amount: number };
  actor: string;
  eventMessage: string;
};

/**
 * The one place an order is written. Checkout and the till both come through
 * here so an order taken at the counter is shaped exactly like one taken online.
 * Always leaves the order pending_payment; callers decide when it is placed.
 */
export async function createOrder(i: CreateOrderInput) {
  const { priced } = i;
  let addressId: string | null = null;
  if (i.fulfilment === "delivery" && i.address) {
    const existing = await prisma.address.findFirst({ where: { customerId: i.customerId, line1: i.address.line1, postcode: i.postcode } });
    const addr = existing ?? (await prisma.address.create({ data: { customerId: i.customerId, line1: i.address.line1, line2: i.address.line2, city: i.address.city, postcode: i.postcode, isDefault: true } }));
    addressId = addr.id;
  }

  const promoRow = priced.promoCode ? await prisma.promo.findUnique({ where: { clientId_code: { clientId: i.clientId, code: priced.promoCode } }, select: { id: true } }) : null;
  const order = await prisma.order.create({
    data: {
      clientId: i.clientId, locationId: i.locationId, customerId: i.customerId, addressId,
      status: "pending_payment", fulfilment: i.fulfilment, paymentMethod: i.paymentMethod,
      customerName: i.customerName, customerPhone: i.customerPhone, customerEmail: i.customerEmail,
      deliveryLine1: i.address?.line1 ?? "", deliveryLine2: i.address?.line2 ?? "", deliveryCity: i.address?.city ?? "", deliveryPostcode: i.fulfilment === "delivery" ? i.postcode : "",
      notes: i.notes, scheduledFor: i.scheduledFor,
      subtotal: priced.subtotal, deliveryFee: priced.deliveryFee, discount: priced.discount, promoCode: priced.promoCode, total: priced.total,
      promoId: promoRow?.id,
      source: i.source, takenBy: i.takenBy ?? null,
      ...(i.payment ? { payments: { create: i.payment } } : {}),
    },
  });
  await writeItems(prisma, order.id, priced.lines, i.lines);
  await addEvent(order.id, "created", i.actor, i.eventMessage);
  return order;
}

/**
 * Writes priced lines as order items (deal contents as child rows). Shared by
 * a new order and an edit to a sent one, so both are shaped alike. `lines` are
 * the raw basket lines, index-aligned, kept for reorder. Returns the new ids.
 */
export async function writeItems(db: Prisma.TransactionClient, orderId: string, pricedLines: PricedBasket["lines"], lines: BasketLine[]): Promise<string[]> {
  const ids: string[] = [];
  for (const [n, l] of pricedLines.entries()) {
    const data: Prisma.OrderItemUncheckedCreateInput = {
      orderId, productId: l.productId ?? null, dealId: l.dealId ?? null,
      name: l.name, sizeKey: l.sizeKey, sizeName: l.sizeName, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal, notes: l.notes,
      line: lines[n] as Prisma.InputJsonValue,
      modifiers: { create: l.modifiers.map((m) => ({ groupName: m.groupName, name: m.name, price: m.price })) },
      components: { create: l.components.map((c) => ({ orderId, productId: c.productId, name: c.name, sizeKey: c.sizeKey, sizeName: c.sizeName, qty: 1, unitPrice: 0, lineTotal: 0, modifiers: { create: c.modifiers.map((m) => ({ groupName: m.groupName, name: m.name, price: m.price })) } })) },
    };
    ids.push((await db.orderItem.create({ data, select: { id: true } })).id);
  }
  return ids;
}

/**
 * Marks one payment row as money received, then places the order once the
 * settled rows cover its total. Idempotent: a repeated webhook, or a poll
 * racing the webhook, changes nothing the second time. Safe on an order that
 * is already placed (a "pay later" order settled from the queue).
 */
export async function settlePayment(paymentId: string, actor: string, data: { status: "succeeded" | "cash_collected"; receiptUrl?: string; stripePaymentIntentId?: string }) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  // A refund is final: a late or replayed "succeeded" must not undo it.
  if (!payment || payment.status === "refunded") return null;
  // Conditional update, so of two callers racing (webhook and till poll) only one logs it.
  const moved = await prisma.payment.updateMany({ where: { id: paymentId, status: { notIn: [data.status, "refunded"] } }, data });
  if (moved.count) {
    await addEvent(payment.orderId, "paid", actor, `${payment.provider} ${gbp(payment.amount)}${data.stripePaymentIntentId ? ` · ${data.stripePaymentIntentId}` : ""}`);
  }
  const order = await prisma.order.findUnique({ where: { id: payment.orderId }, select: { total: true, writtenOff: true, payments: { select: { status: true, amount: true, refundedAmount: true } } } });
  if (!order) return null;
  // A "pay later" placeholder stands for what is still owed: it shrinks as money
  // comes in and goes once the order is covered.
  const owed = remainingPence(order.total - order.writtenOff, order.payments);
  const pending = { orderId: payment.orderId, provider: "cash", status: "cash_pending" as const };
  if (owed > 0) await prisma.payment.updateMany({ where: pending, data: { amount: owed } });
  else {
    await prisma.payment.deleteMany({ where: pending });
    await markPlaced(payment.orderId, actor);
  }
  return payment.orderId;
}

/** pending_payment → placed. Idempotent. Notifies kitchen + customer. */
export async function markPlaced(orderId: string, actor: string, paymentData?: Prisma.InputJsonValue) {
  // Claimed atomically: the webhook, the till poll and the order page can all
  // arrive at once, and only one of them may count the order and notify.
  const claimed = await prisma.order.updateMany({ where: { id: orderId, status: "pending_payment" }, data: { status: "placed", placedAt: new Date() } });
  if (!claimed.count) return prisma.order.findUnique({ where: { id: orderId } });
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  await addEvent(orderId, "placed", actor, "Order placed", paymentData);
  await prisma.customer.update({
    where: { id: order.customerId },
    data: { lastOrderAt: new Date(), ordersCount: { increment: 1 }, totalSpent: { increment: order.total }, lastPostcode: order.deliveryPostcode || undefined },
  });
  if (order.promoId) await prisma.promo.update({ where: { id: order.promoId }, data: { uses: { increment: 1 } } });
  // Credit the marketing message that carried this code, if there was one. Best
  // effort: a failure here must never stop an order being placed.
  try { await attributeOrder(order.id); } catch (e) { console.error("[marketing] attribution failed", (e as Error).message); }
  // Pay the person who introduced them, now the first order is real money.
  try { await payReferrer(order); } catch (e) { console.error("[referral] reward failed", (e as Error).message); }
  // Popularity counters for top sellers
  const productIds = order.items.flatMap((i) => [i.productId, ...i.components.map((c) => c.productId)]).filter((x): x is string => !!x);
  if (productIds.length) await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { ordersCount: { increment: 1 } } });
  revalidateTag(MENU_TAG);
  await notify("order_placed", order);
  await notifyPrinter(order);
  return order;
}

/** Thrown when a move would refund, or leave owed back, money the shop has taken. */
export class NeedsManagerError extends Error {
  constructor() { super("This order has been paid, so rejecting or cancelling it needs a manager PIN."); }
}

/**
 * `approvedBy` is the manager who signed off. Rejecting a paid order refunds it and
 * cancelling one leaves the money owed back, so both need a manager - the shop owner
 * decided every refund goes through a manager (2026-09-28).
 */
export async function transitionOrder(orderId: string, to: OrderStatus, actor: string, opts: { etaMinutes?: number; reason?: string; approvedBy?: string } = {}) {
  const current = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true, scheduledFor: true, fulfilment: true, deliveryPostcode: true,
      payments: { select: { status: true, amount: true, refundedAmount: true } },
      location: { select: { deliveryMinutes: true, prepMinutes: true, deliveryFee: true, minOrder: true, bands: true } },
    },
  });
  if (!current) throw new Error("Order not found");
  if (!TRANSITIONS[current.status].includes(to)) throw new Error(`Cannot go from ${current.status} to ${to}`);
  if ((to === "rejected" || to === "cancelled") && paidPence(current.payments) > 0 && !opts.approvedBy) throw new NeedsManagerError();
  const data: Prisma.OrderUpdateManyMutationInput = { status: to };
  if (to === "accepted") {
    // Further-out bands carry extra minutes, so the promised time matches the
    // distance the driver actually has to cover.
    const extra = current.fulfilment === "delivery"
      ? deliveryTermsFor(current.deliveryPostcode, current.location, current.location.bands).extraMinutes
      : 0;
    const eta = opts.etaMinutes ?? (current.fulfilment === "delivery" ? current.location.deliveryMinutes + extra : current.location.prepMinutes);
    data.etaMinutes = eta;
    // Pre-orders: ETA is the booked slot unless the kitchen explicitly overrides it.
    data.etaAt = current.scheduledFor && opts.etaMinutes === undefined && current.scheduledFor.getTime() > Date.now() ? current.scheduledFor : new Date(Date.now() + eta * 60_000);
    data.acceptedAt = new Date();
  }
  if (to === "completed") data.completedAt = new Date();
  if (to === "rejected") data.rejectReason = opts.reason ?? "";
  // Conditional on the status just checked, so two screens moving the same order
  // at once cannot both win (a cancel racing a complete, say).
  const moved = await prisma.order.updateMany({ where: { id: orderId, status: current.status }, data });
  if (!moved.count) throw new Error("This order has just been changed on another screen. Try again.");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  const note = opts.reason ?? (opts.etaMinutes ? `ETA ${opts.etaMinutes} min` : "");
  await addEvent(orderId, to, actor, opts.approvedBy ? `${note}${note ? " · " : ""}approved by ${opts.approvedBy}` : note);
  if (to === "completed") await awardLoyalty(order);

  const event = STATUS_EVENT[to];
  if (event) await notify(event, order, { reason: opts.reason });
  // After notify, which looks the driver up by the order to tell them.
  if (to === "completed" || to === "rejected" || to === "cancelled") await releaseDriver(order.clientId, orderId);

  if (to === "rejected" && order.payments.some((p) => p.stripePaymentIntentId && p.status === "succeeded")) {
    const refunded = await refundOrder(order, "rejected");
    // Only once the money has actually moved. Telling somebody their refund is
    // on its way before Stripe has accepted it is how a shop ends up promising
    // money it has not sent.
    if (refunded !== null) await notify("order_refunded", order, { refund: refunded });
  }
  return order;
}

/**
 * Mint and send the referrer's thank-you.
 *
 * Deliberately after the order is placed rather than at sign-up: an
 * introduction is worth paying for once it has bought something. The text is
 * logged as a send like any other, so the code can be attributed when it comes
 * back through the till.
 */
async function payReferrer(order: FullOrder) {
  const { rewardReferrer } = await import("./referral");
  const reward = await rewardReferrer(order.id);
  if (!reward) return;

  const cfg = getConfig();
  const referrer = await prisma.customer.findUnique({
    where: { id: reward.referrerId },
    select: { id: true, name: true, phone: true },
  });
  if (!referrer?.phone) return;

  const first = (referrer.name || "").trim().split(/\s+/)[0] || "there";
  const r = await sendSms(
    referrer.phone,
    `${cfg.name}: ${first}, your friend just ordered - thanks for sending them our way. ` +
    `${reward.code} takes £${cfg.referral.referrerReward.toFixed(2)} off your next order.

Reply STOP to opt out`,
  );
  await recordReferralReward({
    clientId: order.clientId, customerId: referrer.id, promoCode: reward.code,
    ok: r.ok, error: r.error,
  });
}

async function awardLoyalty(order: FullOrder) {
  const cfg = getConfig();
  if (!cfg.loyalty.enabled) return;
  const points = Math.floor((order.subtotal / 100) * cfg.loyalty.pointsPerPound);
  if (points <= 0) return;
  await prisma.loyaltyLedger.create({ data: { customerId: order.customerId, orderId: order.id, delta: points, reason: `Order #${order.number}` } });
  await prisma.customer.update({ where: { id: order.customerId }, data: { loyaltyPoints: { increment: points } } });
}

/**
 * Refunds every card payment on the order, online and card reader alike. Cash
 * goes back over the counter, so it is left alone. Returns the pence actually
 * refunded, or null if Stripe refused any of them.
 */
async function refundOrder(order: FullOrder, reason: string): Promise<number | null> {
  const { getStripe, connectOpts } = await import("./stripe");
  const cfg = getConfig();
  let refunded = 0;
  for (const p of order.payments.filter((p) => p.stripePaymentIntentId && p.status === "succeeded")) {
    // Reserved under the order lock first, like a till refund, so a till refund
    // in flight is not refunded twice and the webhook can match it by refundId.
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
      const cur = await tx.payment.findUniqueOrThrow({ where: { id: p.id } });
      const left = cur.amount - cur.refundedAmount;
      if (cur.status !== "succeeded" || left <= 0) return null;
      await tx.payment.update({ where: { id: p.id }, data: { status: "refunded", refundedAmount: { increment: left } } });
      return tx.refund.create({ data: { orderId: order.id, paymentId: p.id, provider: p.provider, amount: left, reason, status: "pending" } });
    });
    if (!row) continue;
    try {
      const refund = await getStripe().refunds.create(
        { payment_intent: p.stripePaymentIntentId, amount: row.amount, metadata: { orderId: order.id, refundId: row.id } },
        { idempotencyKey: `refund_${row.id}`, ...(connectOpts(cfg.payments.stripeAccountId) ?? {}) },
      );
      if (refund.status === "failed" || refund.status === "canceled") {
        await releaseRefund(row.id, "system", refund.failure_reason ?? refund.status, 0);
        return null;
      }
      await prisma.refund.updateMany({ where: { id: row.id, stripeRefundId: "" }, data: { stripeRefundId: refund.id } });
      if (refund.status === "succeeded") await prisma.refund.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "succeeded" } });
      await addEvent(order.id, "refunded", "system", `Refunded ${gbp(refund.amount)} (${reason})`, { refundId: row.id });
      refunded += refund.amount;
    } catch (e) {
      await releaseRefund(row.id, "system", (e as Error).message, 0);
      return null;
    }
  }
  return refunded;
}

/**
 * The receipt printer.
 *
 * Deliberately outside the notification rules. Email and SMS are messages to a
 * person who can be over-messaged and cost money to reach; the printer is a
 * machine in the kitchen that either has a docket or does not. Putting it
 * behind the same toggles would invite somebody to switch off the one output
 * the kitchen physically works from.
 */
async function notifyPrinter(order: FullOrder) {
  const cfg = getConfig();
  if (!cfg.notifications.printerWebhook) return;
  const r = await postPrinter(cfg.notifications.printerWebhook, {
    id: order.id, number: order.number, text: orderText(order), order: printPayload(order),
  });
  await addEvent(order.id, "print_sent", "system", r.ok ? "ok" : r.error ?? "failed");
}
export function printPayload(order: FullOrder) {
  return {
    number: order.number, fulfilment: order.fulfilment, paymentMethod: order.paymentMethod, status: order.status,
    customer: { name: order.customerName, phone: order.customerPhone },
    address: order.fulfilment === "delivery" ? { line1: order.deliveryLine1, line2: order.deliveryLine2, city: order.deliveryCity, postcode: order.deliveryPostcode } : null,
    scheduledFor: order.scheduledFor, notes: order.notes,
    items: order.items.map((i) => ({ qty: i.qty, name: i.name, size: i.sizeName, modifiers: i.modifiers.map((m) => m.name), components: i.components.map((c) => ({ name: c.name, size: c.sizeName, modifiers: c.modifiers.map((m) => m.name) })), notes: i.notes, total: i.lineTotal })),
    subtotal: order.subtotal, deliveryFee: order.deliveryFee, discount: order.discount, total: order.total, createdAt: order.createdAt,
  };
}

export async function sendReviewRequests(limit = 50): Promise<number> {
  const cfg = getConfig();
  if (!cfg.contact.reviewUrl) return 0;
  const cutoff = new Date(Date.now() - cfg.notifications.reviewDelayMinutes * 60_000);
  const client = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { id: true } });
  if (!client) return 0;
  const orders = await prisma.order.findMany({
    where: { clientId: client.id, status: "completed", completedAt: { lte: cutoff }, reviewRequestedAt: null },
    take: limit, orderBy: { completedAt: "asc" }, include: orderInclude,
  });
  let n = 0;
  for (const o of orders) {
    // Stamped before sending, not after. A send that throws halfway would
    // otherwise leave the order eligible again on the next run, and the
    // customer gets asked for a review twice.
    await prisma.order.update({ where: { id: o.id }, data: { reviewRequestedAt: new Date() } });
    const r = await notify("review_request", o);
    // Recorded as a send so the shop sees the real SMS bill, and so the shared
    // cooldown keeps a win-back text from landing the same afternoon.
    try {
      await recordReviewRequest({ clientId: client.id, customerId: o.customerId, ok: r.sent > 0, error: r.sent > 0 ? undefined : "no channel enabled" });
    } catch (e) {
      console.error("[marketing] could not record review request", (e as Error).message);
    }
    n++;
  }
  return n;
}

export type { Order };
