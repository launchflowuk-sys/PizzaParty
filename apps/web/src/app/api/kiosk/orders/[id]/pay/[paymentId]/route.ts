import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { paymentView } from "@/lib/pos";
import { kioskGuard, kioskOrder } from "@/lib/kiosk";

export const dynamic = "force-dynamic";

/** Polled by the kiosk while the customer is at the reader. Asks Stripe directly, so it moves on even without the webhook. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const staff = await kioskGuard(req);
  if (staff instanceof NextResponse) return staff;
  const { id, paymentId } = await params;
  const order = await kioskOrder((await getClientRow()).id, id);
  const p = order ? await prisma.payment.findFirst({ where: { id: paymentId, orderId: order.id }, select: { id: true } }) : null;
  if (!p) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  return NextResponse.json(await paymentView(p.id, staff.name));
}
