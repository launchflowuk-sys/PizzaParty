import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma, type Payment } from "@launchflow/db";
import { COOKIE, safeEqual, sha256, verifyToken } from "./auth";
import { can, STAFF_ROLES, type StaffRole } from "./permissions";
import { BasketBody, priceRequest } from "./checkout";
import { getConfig } from "./config";
import { env } from "./env";
import { gbp } from "./money";
import { addEvent, settlePayment } from "./orders";
import { connectOpts, getStripe, stripeServerEnabled } from "./stripe";
import { isSettled, manualDiscountPence, paidPence } from "./pos-money";
import type { BasketLine } from "./basket-types";
import { pricedAs } from "./fulfilment";
import type { PosCustomer, PosOrderRef, PosPayment, PosReader } from "./pos-types";

export type PosStaff = { id: string; name: string; role: StaffRole };

/**
 * Staff-only guard for /api/pos/*. The admin cookie carries the person and
 * role; the shared password and the agency key sign in as a manager.
 * Returns the person, or the response to send back.
 */
export async function posGuard(req: NextRequest): Promise<PosStaff | NextResponse> {
  const admin = await verifyToken(req.cookies.get(COOKIE.admin)?.value, "admin");
  const agency = admin ? null : await verifyToken(req.cookies.get(COOKIE.agency)?.value, "agency");
  if (!admin && !agency) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const staff: PosStaff = admin
    ? { id: admin.sub, name: admin.nm ?? "Owner", role: (STAFF_ROLES as readonly string[]).includes(admin.sr ?? "") ? (admin.sr as StaffRole) : "manager" }
    : { id: "launchflow", name: "LaunchFlow", role: "manager" };
  if (!can(staff.role, "pos")) return NextResponse.json({ error: "Your role cannot use the till." }, { status: 403 });
  return staff;
}

export async function readJson<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T> | NextResponse> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (parsed.success) return parsed.data;
  return NextResponse.json({ error: "Please check the details.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
}

const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 15 * 60_000;
// ponytail: per-process memory, so a restart or a second instance resets it; move to the DB if the till ever scales out.
const pinFails = new Map<string, { n: number; until: number }>();

/**
 * The name of the manager who owns this PIN (or the shop password), else null.
 * A four-digit PIN is ten thousand guesses, so whoever is signed in to the till
 * gets five wrong tries, then is locked out of discounts for fifteen minutes.
 */
export async function managerForPin(clientId: string, pin: string, askedBy: string): Promise<string | null> {
  const key = `${clientId}:${askedBy}`;
  const f = pinFails.get(key);
  if (f && f.n >= PIN_MAX_FAILS && f.until > Date.now()) return null;
  if (env.adminPassword && safeEqual(pin, env.adminPassword)) return "Owner";
  if (/^\d{4,8}$/.test(pin)) {
    const m = await prisma.staff.findFirst({ where: { clientId, active: true, role: "manager", pinHash: await sha256(`${clientId}:${pin}`) }, select: { name: true } });
    if (m) { pinFails.delete(key); return m.name; }
  }
  const n = f && f.until > Date.now() ? f.n + 1 : 1;
  pinFails.set(key, { n, until: Date.now() + PIN_LOCK_MS });
  // Same delay as the login screen, so the PIN box is no faster to guess at.
  await new Promise((r) => setTimeout(r, 300));
  return null;
}

export const Discount = z.object({
  kind: z.enum(["percent", "amount"]),
  value: z.number().positive(),
  reason: z.string().trim().min(2).max(120),
  managerPin: z.string().min(1).max(64),
}).refine((d) => d.kind === "amount" ? Number.isInteger(d.value) : d.value <= 100, { message: "Percent is at most 100; an amount is whole pence." });

/** The website's basket, plus eat-in (till only) and a manager discount. */
export const PosBasketBody = BasketBody.omit({ promoCode: true }).extend({ fulfilment: z.enum(["delivery", "collection", "eat_in"]).default("delivery"), discount: Discount.optional() });
export type PosBasketBodyT = z.infer<typeof PosBasketBody>;

/**
 * Server price for a till basket: the website's own pricing, then the manager
 * discount on top. `approvedBy` is null when no discount was asked for.
 */
export async function pricePos(body: PosBasketBodyT, clientId: string, staffId: string, customerPhone?: string) {
  const res = await priceRequest({ ...body, fulfilment: pricedAs(body.fulfilment), promoCode: "" }, { customerPhone });
  let approvedBy: string | null = null;
  if (body.discount) {
    approvedBy = await managerForPin(clientId, body.discount.managerPin, staffId);
    if (!approvedBy) return { ...res, error: NextResponse.json({ error: "That manager PIN was not recognised." }, { status: 403 }) };
  }
  const manualDiscount = manualDiscountPence(res.priced.subtotal, res.priced.discount, body.discount);
  return { ...res, error: null, approvedBy, pos: { ...res.priced, total: res.priced.total - manualDiscount, manualDiscount } };
}

/** One shared customer per shop for counter sales with no phone number. The phone is not E.164, so no lookup or text can ever reach it. */
export const WALK_IN_PHONE = "walk-in";
export function walkInCustomer(clientId: string) {
  return prisma.customer.upsert({
    where: { clientId_phone: { clientId, phone: WALK_IN_PHONE } },
    create: { clientId, phone: WALK_IN_PHONE, name: "Walk-in", guest: true },
    update: {},
  });
}

export async function posCustomer(clientId: string, where: { phone: string } | { id: string }): Promise<PosCustomer | null> {
  const c = await prisma.customer.findFirst({
    where: { clientId, ...where },
    include: {
      addresses: { orderBy: { createdAt: "desc" } },
      orders: {
        where: { status: { notIn: ["pending_payment", "cancelled"] } },
        orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, number: true, placedAt: true, createdAt: true, total: true, items: { where: { parentId: null }, orderBy: { id: "asc" }, select: { qty: true, name: true, line: true } } },
      },
    },
  });
  if (!c) return null;
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email,
    ordersCount: c.ordersCount, totalSpent: c.totalSpent, loyaltyPoints: c.loyaltyPoints,
    staffNotes: c.staffNotes ?? "", blocked: c.blocked,
    addresses: c.addresses.map((a) => ({ id: a.id, line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode, notes: a.notes })),
    lastOrders: c.orders.map((o) => ({
      id: o.id, number: o.number, placedAt: (o.placedAt ?? o.createdAt).toISOString(), total: o.total,
      summary: o.items.map((i) => `${i.qty}× ${i.name}`).join(", "),
      lines: o.items.map((i) => i.line as BasketLine | null).filter((l): l is BasketLine => !!l),
    })),
  };
}

export async function orderRef(orderId: string): Promise<PosOrderRef> {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, number: true, total: true, status: true, payments: { select: { status: true, amount: true, refundedAmount: true } } } });
  return { id: o.id, number: o.number, total: o.total, paid: paidPence(o.payments), status: o.status };
}

export async function listReaders(): Promise<PosReader[]> {
  if (!stripeServerEnabled()) return [];
  try {
    const list = await getStripe().terminal.readers.list({ limit: 100 }, connectOpts(getConfig().payments.stripeAccountId));
    return list.data.map((r) => ({ id: r.id, label: r.label || r.serial_number, status: r.status === "online" ? "online" : "offline", simulated: r.device_type.startsWith("simulated") }));
  } catch (e) {
    console.error("[pos] could not list readers", (e as Error).message);
    return [];
  }
}

/**
 * Start a server-driven reader payment on a "processing" row the caller has
 * already reserved against the balance, so the PI can point back at it.
 */
export async function startReaderPayment(order: { id: string; number: number }, payment: Payment, readerId: string, staff: string): Promise<Payment> {
  const cfg = getConfig();
  const opts = connectOpts(cfg.payments.stripeAccountId);
  const { amount } = payment;
  try {
    const pi = await getStripe().paymentIntents.create(
      {
        amount, currency: "gbp", payment_method_types: ["card_present"], capture_method: "automatic",
        description: `${cfg.name} order #${order.number}`,
        metadata: { orderId: order.id, paymentId: payment.id, orderNumber: String(order.number), client: env.clientSlug },
      },
      { idempotencyKey: `pos_${payment.id}`, ...(opts ?? {}) },
    );
    await prisma.payment.update({ where: { id: payment.id }, data: { stripePaymentIntentId: pi.id } });
    await getStripe().terminal.readers.processPaymentIntent(readerId, { payment_intent: pi.id }, opts);
    await addEvent(order.id, "reader_started", staff, `${gbp(amount)} on ${readerId}`);
    return { ...payment, stripePaymentIntentId: pi.id };
  } catch (e) {
    const message = (e as Error).message;
    await failReaderPayment(payment.id, "abandoned");
    await addEvent(order.id, "payment_failed", staff, `Reader: ${message}`);
    throw new ReaderError(message, payment.id);
  }
}

export class ReaderError extends Error {
  constructor(message: string, readonly paymentId: string) { super(message); }
}

/** Marks a reader payment failed and cancels its PI so a late tap cannot take the money. */
export async function failReaderPayment(paymentId: string, reason: "abandoned" | "requested_by_customer") {
  const p = await prisma.payment.update({ where: { id: paymentId }, data: { status: "failed" } });
  if (!p.stripePaymentIntentId) return;
  try {
    await getStripe().paymentIntents.cancel(p.stripePaymentIntentId, { cancellation_reason: reason }, connectOpts(getConfig().payments.stripeAccountId));
  } catch (e) {
    // Already cancelled or already succeeded; the status poll will say which.
    console.error("[pos] could not cancel PI", (e as Error).message);
  }
}

/**
 * Current state of a till payment. For a reader payment still waiting, asks
 * Stripe directly so the till moves on even when the webhook is slow or,
 * locally, absent.
 */
export async function paymentView(paymentId: string, staff: string, extra: { change?: number } = {}): Promise<PosPayment> {
  let p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  let message: string | undefined;
  let cancelled = false;
  if (p.provider === "stripe_terminal" && p.stripePaymentIntentId && (p.status === "processing" || p.status === "failed")) {
    const opts = connectOpts(getConfig().payments.stripeAccountId);
    const pi = await getStripe().paymentIntents.retrieve(p.stripePaymentIntentId, undefined, opts);
    // Also when marked failed: a cancel that lost the race with a tap still took the money.
    if (pi.status === "succeeded") {
      await settlePayment(p.id, staff, { status: "succeeded", stripePaymentIntentId: pi.id });
    } else if (pi.status === "canceled") {
      if (p.status === "processing") await prisma.payment.update({ where: { id: p.id }, data: { status: "failed" } });
      cancelled = pi.cancellation_reason === "requested_by_customer";
    } else if (p.status === "processing") {
      message = await readerFailure(pi.id, opts);
      if (message) {
        await failReaderPayment(p.id, "abandoned");
        await addEvent(p.orderId, "payment_failed", staff, `Reader: ${message}`);
      }
    }
    p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  }
  return {
    id: p.id,
    kind: p.provider === "cash" ? "cash" : "reader",
    amount: p.amount,
    ...(extra.change !== undefined ? { change: extra.change } : p.tendered !== null ? { change: p.tendered - p.amount } : {}),
    status: isSettled(p.status) ? "succeeded" : p.status === "processing" ? "waiting" : cancelled ? "cancelled" : "failed",
    ...(message ? { message } : {}),
    order: await orderRef(p.orderId),
  };
}

/** The reader's own failure message for this PI (declined card, timeout), if its last action failed. */
async function readerFailure(piId: string, opts: ReturnType<typeof connectOpts>): Promise<string | undefined> {
  const readers = await getStripe().terminal.readers.list({ limit: 100 }, opts);
  const r = readers.data.find((x) => x.action?.process_payment_intent?.payment_intent === piId);
  return r?.action?.status === "failed" ? r.action.failure_message ?? "Card payment failed." : undefined;
}

export const OPEN_FOR_PAYMENT = ["pending_payment", "placed", "accepted", "preparing", "ready", "out_for_delivery", "completed"] as const;
