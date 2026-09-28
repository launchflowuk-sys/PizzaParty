import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { addEvent } from "@/lib/orders";
import { connectOpts, getStripe } from "@/lib/stripe";
import { failReaderPayment, paymentView, posGuard } from "@/lib/pos";

/** Stop a reader payment: clear the reader's screen, then cancel the PI so a late tap cannot charge. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const { id, paymentId } = await params;
  const client = await getClientRow();
  const p = await prisma.payment.findFirst({ where: { id: paymentId, orderId: id, order: { clientId: client.id } } });
  if (!p) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (p.provider !== "stripe_terminal" || p.status !== "processing") return NextResponse.json(await paymentView(p.id, staff.name));

  const opts = connectOpts(getConfig().payments.stripeAccountId);
  const readers = await getStripe().terminal.readers.list({ limit: 100 }, opts);
  const reader = readers.data.find((r) => r.action?.process_payment_intent?.payment_intent === p.stripePaymentIntentId && r.action.status === "in_progress");
  if (reader) {
    try { await getStripe().terminal.readers.cancelAction(reader.id, {}, opts); }
    catch (e) { console.error("[pos] cancelAction failed", (e as Error).message); }
  }
  await failReaderPayment(p.id, "requested_by_customer");
  await addEvent(id, "payment_cancelled", staff.name, "Reader payment cancelled");
  // Reconciles: if the card was tapped just before the cancel, this reports it paid.
  return NextResponse.json(await paymentView(p.id, staff.name));
}
