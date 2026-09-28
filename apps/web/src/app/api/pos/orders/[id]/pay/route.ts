import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { settlePayment } from "@/lib/orders";
import { stripeEnabled } from "@/lib/stripe";
import { gbp } from "@/lib/money";
import { changeDue, outstandingPence } from "@/lib/pos-money";
import { OPEN_FOR_PAYMENT, paymentView, posGuard, readJson, ReaderError, startReaderPayment } from "@/lib/pos";

const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cash"), amount: z.number().int().positive(), tendered: z.number().int().positive() }),
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

  // Balance check and the payment row in one transaction, holding the order row,
  // so two tills (or a double tap) cannot both take the same balance. The row is
  // "processing" until settled, which outstandingPence already counts as held.
  const reserved = await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ status: string; total: number }[]>`SELECT status::text AS status, total FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
    if (!row || !(OPEN_FOR_PAYMENT as readonly string[]).includes(row.status)) return { error: `This order is ${row?.status ?? "gone"}.`, outstanding: 0 };
    const payments = await tx.payment.findMany({ where: { orderId: order.id }, select: { status: true, amount: true } });
    const outstanding = outstandingPence(row.total, payments);
    if (body.amount > outstanding) return { error: outstanding === 0 ? "Nothing left to pay." : `Only ${gbp(outstanding)} is left to pay.`, outstanding };
    const payment = await tx.payment.create({
      data: body.kind === "cash"
        ? { orderId: order.id, provider: "cash", status: "processing", amount: body.amount, tendered: body.tendered }
        : { orderId: order.id, provider: "stripe_terminal", status: "processing", amount: body.amount },
    });
    return { payment };
  });
  if (!reserved.payment) return NextResponse.json(reserved, { status: 409 });

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
