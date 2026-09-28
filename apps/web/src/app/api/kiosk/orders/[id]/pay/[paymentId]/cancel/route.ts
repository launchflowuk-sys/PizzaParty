import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { addEvent } from "@/lib/orders";
import { connectOpts, getStripe } from "@/lib/stripe";
import { failReaderPayment, paymentView } from "@/lib/pos";
import { kioskGuard, kioskOrder } from "@/lib/kiosk";

/** The customer pressed Cancel: clear the reader, then cancel the PI so a late tap cannot charge. Reports paid if the tap won the race. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const staff = await kioskGuard(req);
  if (staff instanceof NextResponse) return staff;
  const { id, paymentId } = await params;
  const order = await kioskOrder((await getClientRow()).id, id);
  const p = order ? await prisma.payment.findFirst({ where: { id: paymentId, orderId: order.id } }) : null;
  if (!p) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (p.provider !== "stripe_terminal" || p.status !== "processing") return NextResponse.json(await paymentView(p.id, staff.name));

  const opts = connectOpts(getConfig().payments.stripeAccountId);
  try {
    const readers = await getStripe().terminal.readers.list({ limit: 100 }, opts);
    const reader = readers.data.find((r) => r.action?.process_payment_intent?.payment_intent === p.stripePaymentIntentId && r.action.status === "in_progress");
    if (reader) await getStripe().terminal.readers.cancelAction(reader.id, {}, opts);
  } catch (e) {
    console.error("[kiosk] cancelAction failed", (e as Error).message);
  }
  await failReaderPayment(p.id, "requested_by_customer");
  await addEvent(p.orderId, "payment_cancelled", staff.name, "Kiosk reader payment cancelled");
  return NextResponse.json(await paymentView(p.id, staff.name));
}
