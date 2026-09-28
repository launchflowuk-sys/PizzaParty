import "server-only";
import { NextResponse } from "next/server";
import { prisma, type OrderStatus, type Prisma } from "@launchflow/db";
import { TRANSITIONS } from "./orders";
import { isSettled, orderMoney, startOfDayIn } from "./pos-money";
import type { BasketLine } from "./basket-types";
import type { AnyOrderSource } from "./pos-phase4-types";
import type {
  PaymentKind, PosOrderDetail, PosOrderPayment, PosRefund, QueueDriver, QueueOrder, QueueResponse,
} from "./pos-queue-types";

export const OPEN: OrderStatus[] = ["placed", "accepted", "preparing", "ready", "out_for_delivery"];
export const EDITABLE: OrderStatus[] = ["pending_payment", ...OPEN];
/** The kitchen has started: taking food off now wastes it, so a manager signs it off. */
export const VOID_NEEDS_PIN: OrderStatus[] = ["preparing", "ready", "out_for_delivery"];
const DONE: OrderStatus[] = ["completed", "rejected", "cancelled"];
const CURSOR_OVERLAP_MS = 5_000;
const QUEUE_CAP = 300;

/** A failure a route turns straight into `{ error }` with this status. */
export class PosError extends Error {
  constructor(message: string, readonly status: number, readonly extra: Record<string, unknown> = {}) { super(message); }
}
export function posErrorResponse(e: unknown): NextResponse {
  if (e instanceof PosError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
  throw e;
}

const queueSelect = {
  id: true, number: true, source: true, fulfilment: true, status: true, takenBy: true,
  customerName: true, customerPhone: true, deliveryLine1: true, deliveryPostcode: true,
  placedAt: true, createdAt: true, scheduledFor: true, etaAt: true, etaMinutes: true,
  total: true, writtenOff: true, notes: true, rejectReason: true, amendedAt: true, updatedAt: true,
  tableNumber: true, externalDisplayId: true, courier: true, needsAttention: true, createdOfflineAt: true,
  items: { where: { parentId: null }, orderBy: { id: "asc" }, select: { qty: true, name: true, sizeName: true } },
  payments: { select: { provider: true, status: true, amount: true, refundedAmount: true } },
} satisfies Prisma.OrderSelect;
type QueueRow = Prisma.OrderGetPayload<{ select: typeof queueSelect }>;

/** Money the aggregator took; the till never refunds or counts it as its own. */
const MARKETPLACE = "marketplace";
const KIND: Record<string, PaymentKind> = { stripe: "card", stripe_terminal: "reader", cash: "cash" };
type DriverRow = { id: string; name: string; status: string; activeOrderId: string; backAt: Date | null };

export function queueOrder(o: QueueRow, drivers: DriverRow[]): QueueOrder {
  // A rejected or cancelled order owes nothing; anything still held is due back.
  const void_ = o.status === "rejected" || o.status === "cancelled";
  // The marketplace refunds its own customer when an order is refused: nothing is "due back" from the till.
  const money = orderMoney(void_ ? 0 : o.total, o.writtenOff, void_ ? o.payments.filter((p) => p.provider !== MARKETPLACE) : o.payments);
  const d = drivers.find((x) => x.activeOrderId === o.id);
  return {
    id: o.id, number: o.number, source: o.source as AnyOrderSource, fulfilment: o.fulfilment, status: o.status,
    next: TRANSITIONS[o.status].filter((s) => s !== "placed"),
    takenBy: o.takenBy, customerName: o.customerName, customerPhone: o.customerPhone,
    address: o.fulfilment === "delivery" ? [o.deliveryLine1, o.deliveryPostcode].filter(Boolean).join(", ") : "",
    placedAt: (o.placedAt ?? o.createdAt).toISOString(),
    dueAt: (o.scheduledFor ?? o.etaAt)?.toISOString() ?? null, scheduled: !!o.scheduledFor, etaMinutes: o.etaMinutes,
    total: o.total, paid: money.paid, balance: money.balance, refundDue: money.refundDue,
    refunded: o.payments.reduce((s, p) => s + p.refundedAmount, 0), paidState: money.state,
    paymentKinds: [...new Set(o.payments.filter((p) => p.provider !== MARKETPLACE && (isSettled(p.status) || p.status === "refunded")).map((p) => KIND[p.provider] ?? "card"))],
    payLater: o.payments.some((p) => p.status === "cash_pending"),
    driver: d ? { id: d.id, name: d.name } : null,
    itemCount: o.items.reduce((n, i) => n + i.qty, 0),
    summary: o.items.map((i) => `${i.qty}× ${i.name}${i.sizeName ? ` (${i.sizeName})` : ""}`).join(", "),
    notes: o.notes, rejectReason: o.rejectReason, amendedAt: o.amendedAt?.toISOString() ?? null,
    editable: EDITABLE.includes(o.status), voidNeedsPin: VOID_NEEDS_PIN.includes(o.status),
    updatedAt: o.updatedAt.toISOString(),
    tableNumber: o.tableNumber, marketplaceRef: o.externalDisplayId, courier: o.courier === "marketplace" ? "marketplace" : null,
    needsAttention: o.needsAttention, createdOfflineAt: o.createdOfflineAt?.toISOString() ?? null,
  };
}

export async function shopTimezone(clientId: string) {
  const l = await prisma.location.findFirst({ where: { clientId, active: true }, orderBy: { sortOrder: "asc" }, select: { timezone: true } });
  return l?.timezone ?? "Europe/London";
}

async function driverRows(clientId: string): Promise<DriverRow[]> {
  return prisma.driver.findMany({ where: { clientId, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, status: true, activeOrderId: true, backAt: true } });
}

async function queueDrivers(rows: DriverRow[]): Promise<QueueDriver[]> {
  const ids = rows.map((d) => d.activeOrderId).filter(Boolean);
  const numbers = ids.length ? await prisma.order.findMany({ where: { id: { in: ids } }, select: { id: true, number: true } }) : [];
  return rows.map((d) => ({
    id: d.id, name: d.name, status: (["available", "on_delivery", "off"].includes(d.status) ? d.status : "available") as QueueDriver["status"],
    orderId: d.activeOrderId || null, orderNumber: numbers.find((n) => n.id === d.activeOrderId)?.number ?? null,
    backAt: d.backAt?.toISOString() ?? null,
  }));
}

/** Today's orders whatever their state, plus anything still open from before. Unpaid website/app checkouts are left out. */
function inScope(dayStart: Date): Prisma.OrderWhereInput {
  return {
    OR: [
      { status: { in: OPEN } },
      { status: { in: DONE }, createdAt: { gte: dayStart } },
      { status: "pending_payment", source: { in: ["pos", "phone"] }, createdAt: { gte: dayStart } },
    ],
  };
}

export async function loadQueue(clientId: string, sinceRaw: string | null): Promise<QueueResponse> {
  const started = new Date();
  const dayStart = startOfDayIn(await shopTimezone(clientId), started);
  const since = sinceRaw ? new Date(sinceRaw) : null;
  // A cursor from before midnight means yesterday's done orders have to go: start again.
  const full = !since || Number.isNaN(since.getTime()) || since < dayStart;
  const scope = inScope(dayStart);
  const changed: Prisma.OrderWhereInput = full ? {} : {
    OR: [
      { updatedAt: { gt: since } },
      { payments: { some: { updatedAt: { gt: since } } } },
      { events: { some: { createdAt: { gt: since } } } },
    ],
  };
  const [rows, gone, drivers] = await Promise.all([
    prisma.order.findMany({ where: { clientId, AND: [scope, changed] }, select: queueSelect, orderBy: { createdAt: "asc" }, take: QUEUE_CAP }),
    full ? Promise.resolve([]) : prisma.order.findMany({ where: { clientId, AND: [changed, { NOT: scope }] }, select: { id: true }, take: QUEUE_CAP }),
    driverRows(clientId),
  ]);
  return {
    now: started.toISOString(),
    cursor: new Date(started.getTime() - CURSOR_OVERLAP_MS).toISOString(),
    full,
    orders: rows.map((o) => queueOrder(o, drivers)),
    removed: gone.map((g) => g.id),
    drivers: await queueDrivers(drivers),
  };
}

export async function queueOrderById(clientId: string, id: string): Promise<QueueOrder> {
  const [o, drivers] = await Promise.all([prisma.order.findFirstOrThrow({ where: { id, clientId }, select: queueSelect }), driverRows(clientId)]);
  return queueOrder(o, drivers);
}

export async function queueDriverList(clientId: string) {
  return queueDrivers(await driverRows(clientId));
}

const detailSelect = {
  ...queueSelect,
  subtotal: true, deliveryFee: true, discount: true, promoCode: true,
  items: {
    where: { parentId: null }, orderBy: { id: "asc" },
    select: { id: true, qty: true, name: true, sizeName: true, notes: true, lineTotal: true, line: true, modifiers: { select: { name: true } }, components: { select: { name: true, sizeName: true, modifiers: { select: { name: true } } } } },
  },
  payments: { orderBy: { createdAt: "asc" }, select: { id: true, provider: true, status: true, amount: true, refundedAmount: true, createdAt: true } },
  refunds: { orderBy: { createdAt: "asc" } },
  events: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, type: true, actor: true, message: true, createdAt: true } },
} satisfies Prisma.OrderSelect;

function paymentStatus(s: string): PosOrderPayment["status"] {
  if (isSettled(s)) return "succeeded";
  if (s === "cash_pending") return "owed";
  if (s === "refunded" || s === "failed") return s;
  return "waiting";
}

/** Everything the order panel shows. Null when it is not this shop's order. */
export async function orderDetail(clientId: string, id: string): Promise<PosOrderDetail | null> {
  const [o, drivers] = await Promise.all([prisma.order.findFirst({ where: { id, clientId }, select: detailSelect }), driverRows(clientId)]);
  if (!o) return null;
  return {
    ...queueOrder(o, drivers),
    subtotal: o.subtotal, deliveryFee: o.deliveryFee, discount: o.discount, promoCode: o.promoCode, writtenOff: o.writtenOff,
    lines: o.items.map((i) => ({
      id: i.id, qty: i.qty, name: i.name, size: i.sizeName, notes: i.notes, lineTotal: i.lineTotal,
      modifiers: i.modifiers.map((m) => m.name),
      components: i.components.map((c) => `${c.name}${c.sizeName ? ` (${c.sizeName})` : ""}${c.modifiers.length ? ` +${c.modifiers.map((m) => m.name).join(", ")}` : ""}`),
      line: (i.line as BasketLine | null) ?? null,
    })),
    payments: o.payments.map((p) => ({
      id: p.id, kind: p.status === "cash_pending" ? "later" : KIND[p.provider] ?? "card", status: paymentStatus(p.status),
      amount: p.amount, refunded: p.refundedAmount, refundable: isSettled(p.status) && p.provider !== MARKETPLACE ? p.amount - p.refundedAmount : 0,
      createdAt: p.createdAt.toISOString(),
    })),
    refunds: o.refunds.map(refundView),
    events: o.events.map((e) => ({ id: e.id, type: e.type, actor: e.actor, message: e.message, createdAt: e.createdAt.toISOString() })),
  };
}

export function refundView(r: { id: string; paymentId: string; provider: string; amount: number; reason: string; actor: string; approvedBy: string; status: string; createdAt: Date }): PosRefund {
  return {
    id: r.id, paymentId: r.paymentId, kind: KIND[r.provider] ?? "card", amount: r.amount, reason: r.reason, actor: r.actor, approvedBy: r.approvedBy,
    status: (["pending", "succeeded", "failed"].includes(r.status) ? r.status : "pending") as PosRefund["status"], createdAt: r.createdAt.toISOString(),
  };
}
