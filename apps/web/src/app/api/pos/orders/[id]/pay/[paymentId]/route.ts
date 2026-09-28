import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { paymentView, posGuard } from "@/lib/pos";

export const dynamic = "force-dynamic";

/** Polled by the till while the customer is at the reader. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const { id, paymentId } = await params;
  const client = await getClientRow();
  const p = await prisma.payment.findFirst({ where: { id: paymentId, orderId: id, order: { clientId: client.id } }, select: { id: true } });
  if (!p) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  return NextResponse.json(await paymentView(p.id, staff.name));
}
