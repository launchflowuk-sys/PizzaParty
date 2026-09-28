import "server-only";
import { prisma, type DrawerMovement, type DrawerSession } from "@launchflow/db";
import { z } from "zod";
import { gbp } from "./money";
import { managerForPin, type PosStaff } from "./pos";
import { PosError } from "./pos-queue";
import { TAKEN, drawerFigures, driverOwed } from "./pos-report-math";
import { DRAWER_NO_PIN_LIMIT, type PosDrawer, type PosDriverCash } from "./pos-reports-types";

const MAX_CASH = 1_000_000; // £10,000: no drawer movement is ever this big; a typo is.
const Pence = z.number().int().nonnegative().max(MAX_CASH);
const Pin = z.string().min(1).max(64);
const LocationKey = z.string().trim().min(1).max(60);

export const OpenBody = z.object({ float: Pence, managerPin: Pin.optional(), locationKey: LocationKey.optional() });
export const MovementBody = z.object({ kind: z.enum(["pay_in", "pay_out"]), amount: Pence.positive(), reason: z.string().trim().min(2).max(120), managerPin: Pin.optional(), locationKey: LocationKey.optional() });
export const CloseBody = z.object({ counted: Pence, managerPin: Pin, locationKey: LocationKey.optional() });
export const SettleBody = z.object({ amount: Pence.positive(), managerPin: Pin.optional(), note: z.string().trim().max(80).optional(), locationKey: LocationKey.optional() });

/**
 * The manager who signs this off. A PIN, when given, is always checked (with
 * the till's lockout). Without one, a till signed in as a manager is its own
 * approval unless `pinAlways` - used where the person at the till must prove
 * it is them (closing the drawer).
 */
export async function managerApproval(clientId: string, staff: PosStaff, pin: string | undefined, pinAlways = false): Promise<string> {
  if (pin) {
    const m = await managerForPin(clientId, pin, staff.id);
    if (!m) throw new PosError("That manager PIN was not recognised.", 403, { needsPin: true });
    return m;
  }
  if (!pinAlways && staff.role === "manager") return staff.name;
  throw new PosError("This needs a manager PIN.", 403, { needsPin: true });
}

/** The till's location: the one named, else the shop's first. */
export async function tillLocation(clientId: string, key?: string) {
  const l = await prisma.location.findFirst({ where: { clientId, active: true, ...(key ? { key } : {}) }, orderBy: { sortOrder: "asc" }, select: { id: true, key: true, name: true, timezone: true } });
  if (!l) throw new PosError("No such shop location.", 404);
  return l;
}

type SessionRow = DrawerSession & { movements: DrawerMovement[] };

/**
 * Everything the drawer screen shows. A closed session is its frozen summary;
 * an open one is worked out now. Counter cash only: doorstep cash a driver
 * collected arrives later as a hand-in.
 */
export async function drawerView(s: SessionRow, loc: { key: string; name: string }, at = new Date()): Promise<PosDrawer> {
  if (s.closedAt && s.summary) return s.summary as unknown as PosDrawer;
  const window = { gte: s.openedAt, lt: s.closedAt ?? at };
  const scope = { clientId: s.clientId, locationId: s.locationId };
  const [sales, refunds] = await Promise.all([
    prisma.payment.aggregate({ where: { provider: "cash", status: { in: [...TAKEN] }, collectedByDriverId: null, createdAt: window, order: scope }, _sum: { amount: true } }),
    prisma.refund.aggregate({ where: { provider: "cash", status: "succeeded", createdAt: window, order: scope }, _sum: { amount: true } }),
  ]);
  const driverIds = [...new Set(s.movements.map((m) => m.driverId).filter((x): x is string => !!x))];
  const drivers = driverIds.length ? await prisma.driver.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : [];
  const f = drawerFigures(s.float, s.movements, sales._sum.amount ?? 0, refunds._sum.amount ?? 0);
  return {
    id: s.id, locationKey: loc.key, locationName: loc.name,
    openedAt: s.openedAt.toISOString(), openedBy: s.openedBy, float: s.float,
    closedAt: s.closedAt?.toISOString() ?? null, closedBy: s.closedAt ? s.closedBy : null,
    cashSales: f.cashSales, cashRefunds: f.cashRefunds, payIns: f.payIns, payOuts: f.payOuts, driverHandIns: f.driverHandIns,
    expected: f.expected,
    counted: s.counted, overShort: s.counted === null ? null : s.counted - f.expected,
    movements: [...s.movements].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((m) => ({
      id: m.id, kind: m.kind as "pay_in" | "pay_out", amount: m.amount, reason: m.reason, actor: m.actor, approvedBy: m.approvedBy,
      driverId: m.driverId, driverName: drivers.find((d) => d.id === m.driverId)?.name ?? null, createdAt: m.createdAt.toISOString(),
    })),
  };
}

async function sessionView(id: string, loc: { key: string; name: string }) {
  return drawerView(await prisma.drawerSession.findUniqueOrThrow({ where: { id }, include: { movements: true } }), loc);
}

/** The open drawer at this location, else the last one closed since `since`, else null. */
export async function currentDrawer(clientId: string, locationKey: string | undefined, since: Date): Promise<PosDrawer | null> {
  const loc = await tillLocation(clientId, locationKey);
  const s = await prisma.drawerSession.findFirst({
    where: { clientId, locationId: loc.id, OR: [{ closedAt: null }, { closedAt: { gte: since } }] },
    orderBy: [{ closedAt: { sort: "desc", nulls: "first" } }, { openedAt: "desc" }], include: { movements: true },
  });
  return s ? drawerView(s, loc) : null;
}

/** Start a drawer with its float. One open per location: the Location row is held while checking. */
export async function openDrawer(clientId: string, staff: PosStaff, body: z.infer<typeof OpenBody>): Promise<PosDrawer> {
  const loc = await tillLocation(clientId, body.locationKey);
  const approvedBy = await managerApproval(clientId, staff, body.managerPin);
  const s = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Location" WHERE id = ${loc.id} FOR UPDATE`;
    if (await tx.drawerSession.count({ where: { locationId: loc.id, closedAt: null } })) throw new PosError("The drawer is already open. Close it before opening another.", 409);
    return tx.drawerSession.create({ data: { clientId, locationId: loc.id, openedBy: staff.name, approvedBy, float: body.float } });
  });
  return sessionView(s.id, loc);
}

/**
 * The open session, held for the rest of the transaction so a movement cannot
 * land on a drawer that is being closed.
 */
async function lockOpenSession(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], locationId: string): Promise<string> {
  const open = await tx.drawerSession.findFirst({ where: { locationId, closedAt: null }, select: { id: true } });
  if (!open) throw new PosError("The cash drawer is not open. Open it with a float first.", 409);
  const [row] = await tx.$queryRaw<{ closedAt: Date | null }[]>`SELECT "closedAt" FROM "DrawerSession" WHERE id = ${open.id} FOR UPDATE`;
  if (!row || row.closedAt) throw new PosError("The drawer has just been closed.", 409);
  return open.id;
}

export async function addMovement(clientId: string, staff: PosStaff, body: z.infer<typeof MovementBody>): Promise<PosDrawer> {
  const loc = await tillLocation(clientId, body.locationKey);
  const approvedBy = body.amount > DRAWER_NO_PIN_LIMIT || body.managerPin ? await managerApproval(clientId, staff, body.managerPin) : "";
  const id = await prisma.$transaction(async (tx) => {
    const sessionId = await lockOpenSession(tx, loc.id);
    await tx.drawerMovement.create({ data: { sessionId, kind: body.kind, amount: body.amount, reason: body.reason, actor: staff.name, approvedBy } });
    return sessionId;
  });
  return sessionView(id, loc);
}

/** Count and close. Manager PIN always; every figure is frozen into the session. */
export async function closeDrawer(clientId: string, staff: PosStaff, body: z.infer<typeof CloseBody>): Promise<PosDrawer> {
  const loc = await tillLocation(clientId, body.locationKey);
  const approvedBy = await managerApproval(clientId, staff, body.managerPin, true);
  const id = await prisma.$transaction(async (tx) => {
    const sessionId = await lockOpenSession(tx, loc.id);
    const closedAt = new Date();
    const s = await tx.drawerSession.findUniqueOrThrow({ where: { id: sessionId }, include: { movements: true } });
    const closedBy = staff.name === approvedBy ? staff.name : `${staff.name} · approved by ${approvedBy}`;
    const view = await drawerView({ ...s, closedAt, closedBy, counted: body.counted }, loc);
    await tx.drawerSession.update({ where: { id: sessionId }, data: { closedAt, closedBy, counted: body.counted, expected: view.expected, summary: view } });
    return sessionId;
  });
  return sessionView(id, loc);
}

/* ---------- Driver cash ---------- */

/**
 * Who collected a cash payment being taken now: on a delivery order that has
 * gone out, the driver holding it, else the last driver put on it. Null means
 * counter cash.
 */
export async function driverForCash(clientId: string, orderId: string): Promise<string | null> {
  const o = await prisma.order.findFirst({ where: { id: orderId, clientId }, select: { fulfilment: true } });
  if (o?.fulfilment !== "delivery") return null;
  if (!(await prisma.orderEvent.count({ where: { orderId, type: "out_for_delivery" } }))) return null;
  const holder = await prisma.driver.findFirst({ where: { clientId, activeOrderId: orderId }, select: { id: true } });
  if (holder) return holder.id;
  const last = await prisma.orderEvent.findFirst({ where: { orderId, type: "driver" }, orderBy: { createdAt: "desc" }, select: { data: true } });
  const id = (last?.data as { driverId?: unknown } | null)?.driverId;
  return typeof id === "string" && id ? id : null;
}

const collectedWhere = (clientId: string) => ({ provider: "cash", status: { in: [...TAKEN] }, order: { clientId } });

/**
 * Per driver: doorstep cash collected and handed in within [from, to), and what
 * they owe at `to` counting every earlier day, so unpaid cash carries over.
 */
export async function driversCash(clientId: string, from: Date, to: Date): Promise<PosDriverCash[]> {
  const [collected, allCollected, handed, allHanded] = await Promise.all([
    prisma.payment.findMany({ where: { ...collectedWhere(clientId), collectedByDriverId: { not: null }, createdAt: { gte: from, lt: to } }, orderBy: { createdAt: "asc" }, select: { collectedByDriverId: true, amount: true, createdAt: true, order: { select: { id: true, number: true } } } }),
    prisma.payment.groupBy({ by: ["collectedByDriverId"], where: { ...collectedWhere(clientId), collectedByDriverId: { not: null }, createdAt: { lt: to } }, _sum: { amount: true } }),
    prisma.drawerMovement.groupBy({ by: ["driverId"], where: { kind: "pay_in", driverId: { not: null }, createdAt: { gte: from, lt: to }, session: { clientId } }, _sum: { amount: true } }),
    prisma.drawerMovement.groupBy({ by: ["driverId"], where: { kind: "pay_in", driverId: { not: null }, createdAt: { lt: to }, session: { clientId } }, _sum: { amount: true } }),
  ]);
  const sums = (rows: { id: string | null; amount: number | null }[]) => new Map(rows.map((r) => [r.id ?? "", r.amount ?? 0]));
  const collectedAll = sums(allCollected.map((r) => ({ id: r.collectedByDriverId, amount: r._sum.amount })));
  const handedAll = sums(allHanded.map((r) => ({ id: r.driverId, amount: r._sum.amount })));
  const handedHere = sums(handed.map((r) => ({ id: r.driverId, amount: r._sum.amount })));
  const involved = [...collectedAll.keys(), ...handedAll.keys()].filter(Boolean);
  const drivers = await prisma.driver.findMany({ where: { clientId, OR: [{ active: true }, { id: { in: involved } }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, active: true } });
  return drivers.map((d) => {
    const mine = collected.filter((p) => p.collectedByDriverId === d.id);
    return {
      id: d.id, name: d.name,
      collected: mine.reduce((s, p) => s + p.amount, 0),
      handedIn: handedHere.get(d.id) ?? 0,
      owed: driverOwed(collectedAll.get(d.id) ?? 0, handedAll.get(d.id) ?? 0),
      orders: mine.map((p) => ({ orderId: p.order.id, number: p.order.number, amount: p.amount, at: p.createdAt.toISOString() })),
      active: d.active,
    };
  }).filter((d) => d.active || d.collected || d.handedIn || d.owed).map(({ active: _active, ...d }) => d);
}

/**
 * A driver hands cash in: a drawer pay-in linked to them. The driver row is
 * held so two tills cannot both take the same cash, and the amount is capped
 * at what they owe.
 */
export async function settleDriver(clientId: string, driverId: string, staff: PosStaff, body: z.infer<typeof SettleBody>): Promise<string> {
  const loc = await tillLocation(clientId, body.locationKey);
  const driver = await prisma.driver.findFirst({ where: { id: driverId, clientId }, select: { id: true, name: true } });
  if (!driver) throw new PosError("Driver not found.", 404);
  const approvedBy = body.amount > DRAWER_NO_PIN_LIMIT || body.managerPin ? await managerApproval(clientId, staff, body.managerPin) : "";
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Driver" WHERE id = ${driver.id} FOR UPDATE`;
    const [c, h] = await Promise.all([
      tx.payment.aggregate({ where: { ...collectedWhere(clientId), collectedByDriverId: driver.id }, _sum: { amount: true } }),
      tx.drawerMovement.aggregate({ where: { kind: "pay_in", driverId: driver.id, session: { clientId } }, _sum: { amount: true } }),
    ]);
    const owed = driverOwed(c._sum.amount ?? 0, h._sum.amount ?? 0);
    if (body.amount > owed) throw new PosError(owed ? `${driver.name} only owes ${gbp(owed)}.` : `${driver.name} owes nothing.`, 409, { owed });
    const sessionId = await lockOpenSession(tx, loc.id);
    await tx.drawerMovement.create({ data: { sessionId, kind: "pay_in", amount: body.amount, reason: `Cash from ${driver.name}${body.note ? ` · ${body.note}` : ""}`, actor: staff.name, approvedBy, driverId: driver.id } });
  });
  return loc.key;
}
