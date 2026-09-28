import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { COOKIE, cookieOptions, signToken, verifyToken } from "./auth";
import { can, STAFF_ROLES, type StaffRole } from "./permissions";
import { LineSchema, priceRequest } from "./checkout";
import { outstandingPence } from "./pos-money";
import { rateLimited, storedKioskLine } from "./kiosk-rules";
import type { PosStaff } from "./pos";

/**
 * The self-service kiosk's server side (POS-PLAN item 35). Its own guard and its
 * own endpoints (/api/kiosk/*), so a Kiosk-role PIN never reaches the till's:
 * posGuard refuses it (no "pos" grant), and kitchenOrAdmin/adminOnly refuse its
 * cookie outright. A manager can open the kiosk too.
 */
export type KioskStaff = PosStaff & { reader: string; token: NonNullable<Awaited<ReturnType<typeof verifyToken>>> };

export async function kioskGuard(req: NextRequest): Promise<KioskStaff | NextResponse> {
  const admin = await verifyToken(req.cookies.get(COOKIE.admin)?.value, "admin");
  if (!admin) return NextResponse.json({ error: "This kiosk is signed out. Ask a member of staff." }, { status: 401 });
  const role: StaffRole = (STAFF_ROLES as readonly string[]).includes(admin.sr ?? "") ? (admin.sr as StaffRole) : "manager";
  if (!can(role, "kiosk")) return NextResponse.json({ error: "Not a kiosk." }, { status: 403 });
  return { id: admin.sub, name: admin.nm ?? "Kiosk", role, reader: admin.rd ?? "", token: admin };
}

/** A kiosk is signed in once and left for weeks, like the kitchen tablet. */
export const KIOSK_TTL_S = 60 * 60 * 24 * 30;

/**
 * The card reader lives in the kiosk's own signed cookie, set only behind a manager
 * PIN (/api/kiosk/unlock). /pay reads it from there, never from the request, so devtools
 * on the kiosk cannot send its payments to the counter's reader.
 */
export async function setKioskReader(res: NextResponse, staff: KioskStaff, reader: string) {
  const { sub, sr, nm, loc } = staff.token;
  const ttl = staff.role === "kiosk" ? KIOSK_TTL_S : undefined;
  res.cookies.set(COOKIE.admin, await signToken({ role: "admin", sub, sr, nm, loc, ...(reader ? { rd: reader } : {}) }, ttl), { ...cookieOptions("admin"), ...(ttl ? { maxAge: ttl } : {}) });
}

const hits = new Map<string, number[]>();
const LIMITS = { price: { max: 240, windowMs: 10 * 60_000 }, order: { max: 30, windowMs: 10 * 60_000 }, pay: { max: 60, windowMs: 10 * 60_000 } } as const;

/**
 * Per device (the kiosk's own id header) and per sign-in, so one screen being
 * hammered cannot flood the kitchen, and changing the header does not dodge it.
 * Null when allowed, else the 429 to send.
 */
export function kioskLimit(req: NextRequest, staff: PosStaff, bucket: keyof typeof LIMITS): NextResponse | null {
  const { max, windowMs } = LIMITS[bucket];
  // ponytail: every new device header is a new key, so sweep idle ones once the map grows (all windows are <= 10 min).
  if (hits.size > 5_000) for (const [k, v] of hits) if ((v.at(-1) ?? 0) < Date.now() - 10 * 60_000) hits.delete(k);
  const device = /^[\w-]{8,64}$/.test(req.headers.get("x-kiosk-device") ?? "") ? req.headers.get("x-kiosk-device")! : "none";
  // Sign-in first: once it is spent, rotating the device header adds nothing.
  const limited = rateLimited(hits, `${bucket}:${staff.id}`, max * 4, windowMs) || rateLimited(hits, `${bucket}:${staff.id}:${device}`, max, windowMs);
  return limited ? NextResponse.json({ error: "Too many tries. Please ask a member of staff." }, { status: 429 }) : null;
}

/**
 * The real brake on order spam: per sign-in, not per device (the device header is the
 * kiosk's own say-so). Pay at the counter puts an unpaid ticket in the kitchen at once,
 * so this is what stops a script filling the kitchen. `pos.kiosk.ordersPerMinute`.
 */
export function kioskOrderCap(staff: PosStaff, perMinute: number): NextResponse | null {
  return rateLimited(hits, `order-min:${staff.id}`, perMinute, 60_000)
    ? NextResponse.json({ error: "Lots of orders just now. Please wait a moment, or order at the counter." }, { status: 429 })
    : null;
}

/** A kiosk basket: the website's line schema, eat in or takeaway only - never delivery, promo codes or discounts. */
export const KioskBasket = z.object({
  fulfilment: z.enum(["eat_in", "collection"]),
  lines: z.array(LineSchema).min(1).max(50),
});
export type KioskBasketT = z.infer<typeof KioskBasket>;

/**
 * Server price for a kiosk basket: exactly the website's pricing, with eat in priced
 * as collection. Lines are cut down to what pricing reads first, so a crafted request
 * cannot put free text (notes) on a kitchen ticket.
 */
export function priceKiosk(body: KioskBasketT) {
  return priceRequest({ lines: body.lines.map(storedKioskLine), fulfilment: "collection", postcode: "", locationKey: "", promoCode: "" });
}

/** A kiosk may only work on its own recent orders. */
const KIOSK_ORDER_MAX_AGE_MS = 60 * 60_000;
export async function kioskOrder(clientId: string, id: string) {
  return prisma.order.findFirst({
    where: { id, clientId, source: "kiosk", createdAt: { gte: new Date(Date.now() - KIOSK_ORDER_MAX_AGE_MS) } },
    select: { id: true, number: true, status: true },
  });
}

/**
 * Reserve the whole balance of an unpaid kiosk order for one reader payment,
 * under a row lock so a double tap cannot start two. The till's /pay does the same
 * for part payments; the kiosk only ever takes the full amount.
 */
export async function reserveKioskReader(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ status: string; total: number }[]>`SELECT status::text AS status, total - "writtenOff" AS total FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    if (!row || row.status !== "pending_payment") return { error: "This order is already paid or closed." };
    const payments = await tx.payment.findMany({ where: { orderId }, select: { status: true, amount: true, refundedAmount: true } });
    if (payments.some((p) => p.status === "processing")) return { error: "The reader is already waiting for this order." };
    const amount = outstandingPence(row.total, payments);
    if (amount <= 0) return { error: "Nothing left to pay." };
    return { payment: await tx.payment.create({ data: { orderId, provider: "stripe_terminal", status: "processing", amount } }) };
  });
}
