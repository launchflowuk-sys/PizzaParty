import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { isUniqueViolation, settlePayment } from "@/lib/orders";
import { stripeEnabled } from "@/lib/stripe";
import { gbp } from "@/lib/money";
import { changeDue, outstandingPence } from "@/lib/pos-money";
import { OPEN_FOR_PAYMENT, paymentView, posGuard, readJson, ReaderError, startReaderPayment } from "@/lib/pos";
import { driverForCash } from "@/lib/pos-cash";

const Body = z.discriminatedUnion("kind", [
  // clientRequestId (PosPayExtras): a repeat returns the first payment instead of taking the cash twice.
  z.object({ kind: z.literal("cash"), amount: z.number().int().positive(), tendered: z.number().int().positive(), clientRequestId: z.string().trim().min(8).max(64).regex(/^[\w-]+$/).optional() }),
  z.object({ kind: z.literal("reader"), amount: z.number().int().positive(), readerId: z.string().min(3).max(64) }),
]);

/** Take all or part of what is owed. Works on a new till order and on a "pay later" order already in the kitchen. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const client = await getClientRow();
  const order = await prisma.order.findFirst({ where: { id, clientId: client.id }, select: { id: true, number: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const change = body.kind === "cash" ? changeDue(body.amount, body.tendered) : 0;
  if (change === null) return NextResponse.json({ error: "Less cash was handed over than the amount." }, { status: 400 });
  if (body.kind === "reader" && !stripeEnabled()) return NextResponse.json({ error: "Card payments are not set up." }, { status: 503 });
  // Doorstep cash is the driver's to hand in, not counter cash in the drawer.
  const collectedByDriverId = body.kind === "cash" ? await driverForCash(client.id, order.id) : null;

  const requestId = body.kind === "cash" ? body.clientRequestId : undefined;
  /** The payment a retried request already made; 409 if that id was used on another order. */
  const repeat = async (paymentId: string, orderId: string) => {
    if (orderId !== order.id) return NextResponse.json({ error: "That payment id was already used on another order." }, { status: 409 });
    // The first request may still be settling it; settling is idempotent, so finish it here rather than answer "waiting".
    await settlePayment(paymentId, staff.name, { status: "cash_collected" });
    return NextResponse.json(await paymentView(paymentId, staff.name));
  };

  // Balance check and the payment row in one transaction, holding the order row,
  // so two tills (or a double tap) cannot both take the same balance. The row is
  // "processing" until settled, which outstandingPence already counts as held.
  const reserve = () => prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ status: string; total: number }[]>`SELECT status::text AS status, total - "writtenOff" AS total FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
    // Checked under the lock: a repeat that waited behind the first sees its row, not a paid-up order.
    if (requestId) {
      const dup = await tx.payment.findUnique({ where: { clientRequestId: requestId }, select: { id: true, orderId: true } });
      if (dup) return { dup };
    }
    if (!row || !(OPEN_FOR_PAYMENT as readonly string[]).includes(row.status)) return { error: `This order is ${row?.status ?? "gone"}.`, outstanding: 0 };
    const payments = await tx.payment.findMany({ where: { orderId: order.id }, select: { status: true, amount: true, refundedAmount: true } });
    const outstanding = outstandingPence(row.total, payments);
    if (body.amount > outstanding) return { error: outstanding === 0 ? "Nothing left to pay." : `Only ${gbp(outstanding)} is left to pay.`, outstanding };
    const payment = await tx.payment.create({
      data: body.kind === "cash"
        ? { orderId: order.id, provider: "cash", status: "processing", amount: body.amount, tendered: body.tendered, collectedByDriverId, clientRequestId: requestId ?? null }
        : { orderId: order.id, provider: "stripe_terminal", status: "processing", amount: body.amount },
    });
    return { payment };
  });
  let reserved: Awaited<ReturnType<typeof reserve>>;
  try {
    reserved = await reserve();
  } catch (e) {
    // Same id on another order racing this one: the unique key decides.
    if (!(requestId && isUniqueViolation(e))) throw e;
    const dup = await prisma.payment.findUnique({ where: { clientRequestId: requestId }, select: { id: true, orderId: true } });
    if (!dup) throw e;
    reserved = { dup };
  }
  if ("dup" in reserved && reserved.dup) return repeat(reserved.dup.id, reserved.dup.orderId);
  if (!("payment" in reserved) || !reserved.payment) return NextResponse.json(reserved, { status: 409 });

  if (body.kind === "cash") {
    await settlePayment(reserved.payment.id, staff.name, { status: "cash_collected" });
    return NextResponse.json(await paymentView(reserved.payment.id, staff.name, { change }));
  }

  try {
    const p = await startReaderPayment(order, reserved.payment, body.readerId, staff.name);
    return NextResponse.json(await paymentView(p.id, staff.name));
  } catch (e) {
    if (!(e instanceof ReaderError)) throw e;
    return NextResponse.json({ ...(await paymentView(e.paymentId, staff.name)), status: "failed", message: e.message });
  }
}
