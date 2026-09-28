import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma, prisma } from "@launchflow/db";
import { getConfig } from "./config";
import { can } from "./permissions";
import { managerForPin, posGuard, type PosStaff } from "./pos";
import { drawerView, driversCash } from "./pos-cash";
import type { ChangeData } from "./pos-edit";
import { PosError, shopTimezone } from "./pos-queue";
import {
  TAKEN, addDays, buildDayReport, dateIn, dayBounds, isDate, kindOf, managerPence, matchStripe,
  type StripeTxn, type TillCard, type TillRefund,
} from "./pos-report-math";
import type { PosDayClose, PosDayReport, PosPriceChanges, PosStripeReport, PosVoidLine, PriceChangeKind } from "./pos-reports-types";
import { connectOpts, getStripe, stripeEnabled } from "./stripe";
import { reconcileStripeRefunds } from "./refunds";

const STRIPE_TXN_CAP = 2000;
const PRICE_LOG_CAP = 500;
const PRICE_LOG_DAYS = 30;

/**
 * Till guard for the money screens. "reports": manager or shift lead (the day
 * report, driver cash). "manager": managers only (Stripe, price log).
 */
export async function reportsGuard(req: NextRequest, level: "reports" | "manager"): Promise<PosStaff | NextResponse> {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const ok = level === "manager" ? staff.role === "manager" : can(staff.role, "reports");
  return ok ? staff : NextResponse.json({ error: level === "manager" ? "Only a manager can see this." : "Your role cannot see the reports." }, { status: 403 });
}

/** `?date=` or today, in the shop's timezone. */
export function pickDate(raw: string | null | undefined, tz: string, now = new Date()): string {
  if (!raw) return dateIn(tz, now);
  if (!isDate(raw)) throw new PosError("Dates are YYYY-MM-DD.", 400);
  return raw;
}

/**
 * Midnight to midnight, except that a day whose previous day was closed early
 * starts at that close: nothing between a close and midnight is lost.
 */
export async function reportPeriod(clientId: string, tz: string, date: string) {
  const { start, end } = dayBounds(tz, date);
  const prevStart = dayBounds(tz, addDays(date, -1)).start;
  const prev = await prisma.dayClose.findUnique({ where: { clientId_date: { clientId, date: addDays(date, -1) } }, select: { closedAt: true } });
  const from = prev && prev.closedAt >= prevStart && prev.closedAt < start ? prev.closedAt : start;
  return { from, to: end };
}

/** The day's report: the frozen snapshot once closed, otherwise worked out now. */
export async function dayReport(clientId: string, date: string): Promise<PosDayReport> {
  const closed = await prisma.dayClose.findUnique({ where: { clientId_date: { clientId, date } }, select: { report: true } });
  if (closed) return closed.report as unknown as PosDayReport;
  return liveReport(clientId, date);
}

async function liveReport(clientId: string, date: string, now = new Date()): Promise<PosDayReport> {
  const tz = await shopTimezone(clientId);
  const { from, to } = await reportPeriod(clientId, tz, date);
  const period = { gte: from, lt: to };
  const [orders, payments, refunds, amended, sessions, drivers] = await Promise.all([
    prisma.order.findMany({
      where: { clientId, placedAt: period },
      orderBy: { placedAt: "asc" },
      select: {
        id: true, number: true, source: true, takenBy: true, status: true, customerName: true, placedAt: true,
        subtotal: true, deliveryFee: true, discount: true, total: true, writtenOff: true,
        items: { where: { parentId: null }, select: { name: true, qty: true, lineTotal: true } },
        payments: { select: { status: true, amount: true, refundedAmount: true } },
        events: { where: { type: { in: ["discount", "amended"] } }, orderBy: { createdAt: "asc" }, select: { type: true, data: true } },
      },
    }),
    prisma.payment.findMany({ where: { order: { clientId }, status: { in: [...TAKEN] }, createdAt: period }, select: { provider: true, amount: true } }),
    prisma.refund.findMany({ where: { order: { clientId }, status: { not: "failed" }, createdAt: period }, orderBy: { createdAt: "asc" }, select: { id: true, orderId: true, provider: true, amount: true, reason: true, createdAt: true, order: { select: { number: true, placedAt: true } } } }),
    prisma.orderEvent.findMany({ where: { type: "amended", createdAt: period, order: { clientId } }, orderBy: { createdAt: "asc" }, select: { orderId: true, actor: true, data: true, createdAt: true, order: { select: { number: true } } } }),
    prisma.drawerSession.findMany({ where: { clientId, openedAt: period }, orderBy: { openedAt: "asc" }, include: { movements: true } }),
    driversCash(clientId, from, to),
  ]);

  // Goodwill is recorded on each refund's audit event.
  const refundEvents = refunds.length ? await prisma.orderEvent.findMany({ where: { type: "refund", orderId: { in: [...new Set(refunds.map((r) => r.orderId))] } }, select: { data: true } }) : [];
  const goodwill = new Map(refundEvents.map((e) => e.data as { refundId?: string; goodwill?: number } | null).filter((d) => d?.refundId).map((d) => [d!.refundId!, typeof d!.goodwill === "number" ? d!.goodwill : 0]));

  const voids: PosVoidLine[] = amended.flatMap((e) => ((e.data as unknown as ChangeData | null)?.removed ?? []).map((l) => ({
    orderId: e.orderId, orderNumber: e.order.number, qty: l.qty, name: `${l.name}${l.size ? ` (${l.size})` : ""}`, value: l.lineTotal,
    reason: l.reason ?? "", by: e.actor, approvedBy: (e.data as unknown as ChangeData).approvedBy ?? "", at: e.createdAt.toISOString(),
  })));

  const locations = await prisma.location.findMany({ where: { clientId }, select: { id: true, key: true, name: true } });
  const loc = (id: string) => locations.find((l) => l.id === id) ?? { key: "", name: "" };

  return buildDayReport({
    date, timezone: tz, from, to, now,
    orders: orders.map((o) => ({ ...o, placedAt: o.placedAt!, managerDiscount: managerPence(o.events) })),
    payments,
    refunds: refunds.map((r) => ({ id: r.id, orderId: r.orderId, orderNumber: r.order.number, orderPlacedAt: r.order.placedAt, provider: r.provider, amount: r.amount, reason: r.reason, goodwill: goodwill.get(r.id) ?? 0, at: r.createdAt })),
    voids,
    drawers: await Promise.all(sessions.map((s) => drawerView(s, loc(s.locationId), now))),
    driverCash: {
      collected: drivers.reduce((s, d) => s + d.collected, 0),
      handedIn: drivers.reduce((s, d) => s + d.handedIn, 0),
      owed: drivers.reduce((s, d) => s + d.owed, 0),
    },
  });
}

/**
 * Freeze the day. Manager PIN; the drawer must be counted first; once only
 * (the unique row is the guard, so two tills closing at once get one close).
 */
export async function closeDay(clientId: string, staff: PosStaff, body: PosDayClose): Promise<PosDayReport> {
  const tz = await shopTimezone(clientId);
  const today = dateIn(tz, new Date());
  const date = pickDate(body.date, tz);
  if (date > today) throw new PosError("That day has not happened yet.", 409);
  const approvedBy = await managerForPin(clientId, body.managerPin, staff.id);
  if (!approvedBy) throw new PosError("That manager PIN was not recognised.", 403, { needsPin: true });
  if (await prisma.dayClose.count({ where: { clientId, date } })) throw new PosError(`${date} is already closed.`, 409);
  const { to } = await reportPeriod(clientId, tz, date);
  if (await prisma.drawerSession.count({ where: { clientId, closedAt: null, openedAt: { lt: to } } })) throw new PosError("Count and close the cash drawer first.", 409);

  const report = await liveReport(clientId, date);
  const closedAt = new Date();
  const counted = report.cashCounted ?? body.counted ?? null;
  const snap: PosDayReport = { ...report, closed: { at: closedAt.toISOString(), by: staff.name, approvedBy, counted } };
  try {
    await prisma.dayClose.create({ data: { clientId, date, closedAt, closedBy: staff.name, approvedBy, counted, report: snap as unknown as Prisma.InputJsonValue } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new PosError(`${date} is already closed.`, 409);
    throw e;
  }
  return snap;
}

/* ---------- Stripe ---------- */

type Src = { object?: string; id?: string; payment_intent?: string | { id: string } | null } | string | null;
const piOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? "");

/** Stripe's ledger for the day against our card payments and card refunds. */
export async function stripeReport(clientId: string, date: string): Promise<PosStripeReport> {
  const tz = await shopTimezone(clientId);
  const { from, to } = await reportPeriod(clientId, tz, date);
  const cardSelect = { id: true, amount: true, provider: true, stripePaymentIntentId: true, createdAt: true, order: { select: { id: true, number: true } } } as const;
  const refundSelect = { id: true, amount: true, provider: true, stripeRefundId: true, createdAt: true, order: { select: { id: true, number: true } }, payment: { select: { stripePaymentIntentId: true } } } as const;
  const cardWhere = { order: { clientId }, provider: { in: ["stripe", "stripe_terminal"] }, status: { in: ["succeeded" as const, "refunded" as const] }, stripePaymentIntentId: { not: "" } };
  const refundWhere = { order: { clientId }, provider: { not: "cash" }, status: { not: "failed" } };

  let cards = await prisma.payment.findMany({ where: { ...cardWhere, createdAt: { gte: from, lt: to } }, select: cardSelect });
  let refunds = await prisma.refund.findMany({ where: { ...refundWhere, createdAt: { gte: from, lt: to } }, select: refundSelect });

  let txns: StripeTxn[] = [];
  let error: string | null = null;
  const configured = stripeEnabled();
  if (configured) {
    try {
      const list = getStripe().balanceTransactions.list(
        { created: { gte: Math.floor(from.getTime() / 1000), lt: Math.floor(to.getTime() / 1000) }, limit: 100, expand: ["data.source"] },
        connectOpts(getConfig().payments.stripeAccountId),
      );
      for await (const t of list) {
        const src = t.source as unknown as Src;
        const obj = typeof src === "object" && src ? src : null;
        txns.push({
          id: t.id, type: t.type, amount: t.amount, fee: t.fee, net: t.net, created: new Date(t.created * 1000),
          paymentIntent: piOf(obj?.payment_intent),
          refundId: obj?.object === "refund" ? obj.id ?? "" : "",
        });
        if (txns.length >= STRIPE_TXN_CAP) break;
      }
      // A card taken just before midnight can land on Stripe's side of it: pull those rows in by id rather than flag them.
      const knownPi = new Set(cards.map((c) => c.stripePaymentIntentId));
      const extraPi = [...new Set(txns.map((t) => t.paymentIntent).filter((pi) => pi && !knownPi.has(pi)))];
      if (extraPi.length) cards = [...cards, ...(await prisma.payment.findMany({ where: { ...cardWhere, stripePaymentIntentId: { in: extraPi } }, select: cardSelect }))];
      const knownRe = new Set(refunds.map((r) => r.stripeRefundId));
      const extraRe = [...new Set(txns.map((t) => t.refundId).filter((id) => id && !knownRe.has(id)))];
      if (extraRe.length) refunds = [...refunds, ...(await prisma.refund.findMany({ where: { ...refundWhere, stripeRefundId: { in: extraRe } }, select: refundSelect }))];
    } catch (e) {
      error = (e as Error).message;
      txns = [];
    }
  }

  const till: TillCard[] = cards.map((c) => ({ paymentId: c.id, orderId: c.order.id, orderNumber: c.order.number, kind: kindOf(c.provider), amount: c.amount, paymentIntent: c.stripePaymentIntentId, at: c.createdAt }));
  const tillRefunds: TillRefund[] = refunds.map((r) => ({ refundId: r.id, orderId: r.order.id, orderNumber: r.order.number, kind: kindOf(r.provider), amount: r.amount, stripeRefundId: r.stripeRefundId, paymentIntent: r.payment.stripePaymentIntentId, at: r.createdAt }));
  const m = matchStripe(till, tillRefunds, txns);
  // Without Stripe's side there is nothing to match against: show our figures, flag nothing.
  if (!configured || error) return { date, from: from.toISOString(), to: to.toISOString(), configured, error, ...m, mismatches: 0, rows: [] };
  return { date, from: from.toISOString(), to: to.toISOString(), configured, error, ...m };
}

/**
 * The manager's "fix it" for the Stripe match: every PaymentIntent on a row
 * that is not ok has its refunds made to agree with Stripe (see
 * recordStripeRefunds), then the day is matched again.
 */
export async function reconcileStripeDay(clientId: string, date: string): Promise<PosStripeReport & { checked: number }> {
  const before = await stripeReport(clientId, date);
  if (!before.configured || before.error) return { ...before, checked: 0 };
  const checked = await reconcileStripeRefunds(clientId, before.rows.filter((r) => r.flag !== "ok").map((r) => r.paymentIntent));
  return { ...(await stripeReport(clientId, date)), checked };
}

/* ---------- Price log ---------- */

export async function priceChanges(clientId: string, rawFrom: string | null, rawTo: string | null): Promise<PosPriceChanges> {
  const tz = await shopTimezone(clientId);
  const to = pickDate(rawTo, tz);
  const from = rawFrom ? pickDate(rawFrom, tz) : addDays(to, -(PRICE_LOG_DAYS - 1));
  if (from > to) throw new PosError("`from` is after `to`.", 400);
  const rows = await prisma.priceChange.findMany({
    where: { clientId, createdAt: { gte: dayBounds(tz, from).start, lt: dayBounds(tz, to).end } },
    orderBy: { createdAt: "desc" }, take: PRICE_LOG_CAP,
  });
  return {
    from, to,
    changes: rows.map((r) => ({ id: r.id, kind: r.kind as PriceChangeKind, label: r.label, oldPrice: r.oldPrice, newPrice: r.newPrice, actor: r.actor, at: r.createdAt.toISOString() })),
  };
}
