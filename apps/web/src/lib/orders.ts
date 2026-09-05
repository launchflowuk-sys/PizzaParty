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

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
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
  payment: true,
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

/** pending_payment → placed. Idempotent. Notifies kitchen + customer. */
export async function markPlaced(orderId: string, actor: string, paymentData?: Prisma.InputJsonValue) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return null;
  if (existing.status !== "pending_payment") return existing;
  const order = await prisma.order.update({ where: { id: orderId }, data: { status: "placed", placedAt: new Date() }, include: orderInclude });
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

export async function transitionOrder(orderId: string, to: OrderStatus, actor: string, opts: { etaMinutes?: number; reason?: string } = {}) {
  const current = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true, scheduledFor: true, fulfilment: true, deliveryPostcode: true,
      location: { select: { deliveryMinutes: true, prepMinutes: true, deliveryFee: true, minOrder: true, bands: true } },
    },
  });
  if (!current) throw new Error("Order not found");
  if (!TRANSITIONS[current.status].includes(to)) throw new Error(`Cannot go from ${current.status} to ${to}`);
  const data: Prisma.OrderUpdateInput = { status: to };
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
  const order = await prisma.order.update({ where: { id: orderId }, data, include: orderInclude });
  await addEvent(orderId, to, actor, opts.reason ?? (opts.etaMinutes ? `ETA ${opts.etaMinutes} min` : ""));
  if (to === "completed") await awardLoyalty(order);

  const event = STATUS_EVENT[to];
  if (event) await notify(event, order, { reason: opts.reason });

  if (to === "rejected" && order.payment?.stripePaymentIntentId && order.payment.status === "succeeded") {
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

/** Returns the pence actually refunded, or null if Stripe refused. */
async function refundOrder(order: FullOrder, reason: string): Promise<number | null> {
  try {
    const { getStripe, connectOpts } = await import("./stripe");
    const cfg = getConfig();
    const refund = await getStripe().refunds.create({ payment_intent: order.payment!.stripePaymentIntentId }, connectOpts(cfg.payments.stripeAccountId));
    await prisma.payment.update({ where: { orderId: order.id }, data: { status: "refunded", refundedAmount: refund.amount } });
    await addEvent(order.id, "refunded", "system", `Refunded ${gbp(refund.amount)} (${reason})`);
    return refund.amount;
  } catch (e) {
    await addEvent(order.id, "refund_failed", "system", (e as Error).message);
    return null;
  }
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
function printPayload(order: FullOrder) {
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
