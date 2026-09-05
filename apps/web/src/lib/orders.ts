import "server-only";
import { attributeOrder, recordReviewRequest, recordReferralReward } from "./marketing";
import { prisma, type Order, type OrderStatus, type Prisma } from "@launchflow/db";
import { env } from "./env";
import { getConfig } from "./config";
import { gbp } from "./money";
import { escapeHtml, postPrinter, sendEmail, sendSms } from "./notify";
import { formatTime } from "./availability";
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
  items: { where: { parentId: null }, include: { modifiers: true, components: { include: { modifiers: true } } }, orderBy: { id: "asc" } },
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
  await notifyKitchen(order);
  await notifyCustomer(order, "placed");
  return order;
}

export async function transitionOrder(orderId: string, to: OrderStatus, actor: string, opts: { etaMinutes?: number; reason?: string } = {}) {
  const current = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, scheduledFor: true, location: { select: { deliveryMinutes: true, prepMinutes: true } }, fulfilment: true } });
  if (!current) throw new Error("Order not found");
  if (!TRANSITIONS[current.status].includes(to)) throw new Error(`Cannot go from ${current.status} to ${to}`);
  const data: Prisma.OrderUpdateInput = { status: to };
  if (to === "accepted") {
    const eta = opts.etaMinutes ?? (current.fulfilment === "delivery" ? current.location.deliveryMinutes : current.location.prepMinutes);
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
  if (to === "rejected" && order.payment?.stripePaymentIntentId && order.payment.status === "succeeded") await refundOrder(order, "rejected");
  await notifyCustomer(order, to);
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

async function refundOrder(order: FullOrder, reason: string) {
  try {
    const { getStripe, connectOpts } = await import("./stripe");
    const cfg = getConfig();
    const refund = await getStripe().refunds.create({ payment_intent: order.payment!.stripePaymentIntentId }, connectOpts(cfg.payments.stripeAccountId));
    await prisma.payment.update({ where: { orderId: order.id }, data: { status: "refunded", refundedAmount: refund.amount } });
    await addEvent(order.id, "refunded", "system", `Refunded ${gbp(refund.amount)} (${reason})`);
  } catch (e) {
    await addEvent(order.id, "refund_failed", "system", (e as Error).message);
  }
}

async function notifyKitchen(order: FullOrder) {
  const cfg = getConfig();
  const text = orderText(order);
  const tasks: Promise<unknown>[] = [];
  if (cfg.notifications.kitchenSms) {
    tasks.push(sendSms(cfg.notifications.kitchenSms, `NEW ORDER ${text.split("\n").slice(0, 2).join(" | ")} — ${env.siteUrl}/kitchen`).then((r) => addEvent(order.id, "sms_sent", "system", `kitchen sms ${r.ok ? "ok" : r.error}`)));
  }
  if (cfg.notifications.kitchenEmail) {
    tasks.push(sendEmail(cfg.notifications.kitchenEmail, `New order #${order.number} — ${order.fulfilment} ${gbp(order.total)}`, `<pre style="font:14px/1.5 monospace">${escapeHtml(text)}</pre><p><a href="${env.siteUrl}/kitchen">Open kitchen screen</a></p>`)
      .then((r) => addEvent(order.id, "email_sent", "system", `kitchen email ${r.ok ? "ok" : r.error}`)));
  }
  if (cfg.notifications.printerWebhook) {
    tasks.push(postPrinter(cfg.notifications.printerWebhook, { id: order.id, number: order.number, text, order: printPayload(order) })
      .then((r) => addEvent(order.id, "print_sent", "system", r.ok ? "ok" : r.error ?? "failed")));
  }
  await Promise.allSettled(tasks);
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

async function notifyCustomer(order: FullOrder, status: OrderStatus) {
  const cfg = getConfig();
  const tz = order.location.timezone;
  const link = orderUrl(order);
  let sms = "";
  switch (status) {
    case "placed":
      sms = `${cfg.name}: thanks ${order.customerName.split(" ")[0]}! Order #${order.number} received (${gbp(order.total)}). Track it: ${link}`;
      break;
    case "accepted":
      sms = order.fulfilment === "delivery"
        ? `${cfg.name}: order #${order.number} accepted. Estimated delivery ${order.etaAt ? formatTime(order.etaAt, tz) : `${order.etaMinutes} min`}. ${link}`
        : `${cfg.name}: order #${order.number} accepted. Ready for collection at ${order.etaAt ? formatTime(order.etaAt, tz) : `${order.etaMinutes} min`}. ${link}`;
      break;
    case "ready":
      sms = order.fulfilment === "collection" ? `${cfg.name}: order #${order.number} is ready to collect.` : "";
      break;
    case "out_for_delivery":
      sms = `${cfg.name}: order #${order.number} is on its way.`;
      break;
    case "rejected":
      sms = `${cfg.name}: sorry, we couldn't take order #${order.number}${order.rejectReason ? ` (${order.rejectReason})` : ""}. ${order.paymentMethod === "card" ? "Your payment will be refunded." : ""} Call us on ${cfg.contact.phone || "the shop"}.`;
      break;
  }
  if (sms) {
    const r = await sendSms(order.customerPhone, sms);
    await addEvent(order.id, "sms_sent", "system", `${status} → customer ${r.ok ? "ok" : r.error}`);
  }
  if (status === "placed" && order.customerEmail) {
    const r = await sendEmail(order.customerEmail, `Your ${cfg.name} order #${order.number}`, `<p>Thanks ${escapeHtml(order.customerName)}, we've got your order.</p><pre style="font:14px/1.5 monospace">${escapeHtml(orderText(order))}</pre><p><a href="${link}">Track your order</a></p>`);
    await addEvent(order.id, "email_sent", "system", `placed → customer ${r.ok ? "ok" : r.error}`);
  }
}

export async function sendReviewRequests(limit = 50): Promise<number> {
  const cfg = getConfig();
  if (!cfg.contact.reviewUrl) return 0;
  const cutoff = new Date(Date.now() - cfg.notifications.reviewDelayMinutes * 60_000);
  const client = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { id: true } });
  if (!client) return 0;
  const orders = await prisma.order.findMany({
    where: { clientId: client.id, status: "completed", completedAt: { lte: cutoff }, reviewRequestedAt: null },
    take: limit, orderBy: { completedAt: "asc" },
  });
  let n = 0;
  for (const o of orders) {
    await prisma.order.update({ where: { id: o.id }, data: { reviewRequestedAt: new Date() } });
    const r = await sendSms(o.customerPhone, `${cfg.name}: hope you enjoyed your order! A quick Google review helps us loads: ${cfg.contact.reviewUrl}`);
    await addEvent(o.id, "sms_sent", "system", `review request ${r.ok ? "ok" : r.error}`);
    // Recorded as a send so the shop sees the real SMS bill, and so the shared
    // cooldown keeps a win-back text from landing the same afternoon.
    try {
      await recordReviewRequest({ clientId: client.id, customerId: o.customerId, ok: r.ok, error: r.error });
    } catch (e) {
      console.error("[marketing] could not record review request", (e as Error).message);
    }
    n++;
  }
  return n;
}

export type { Order };
