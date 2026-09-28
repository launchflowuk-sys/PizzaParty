import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard } from "@/lib/pos";
import { orderDetail } from "@/lib/pos-queue";

export const dynamic = "force-dynamic";

/** The queue's order panel: lines (with ids to void), payments (with what each can refund), refunds, history. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const client = await getClientRow();
  const detail = await orderDetail(client.id, id);
  if (!detail) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json(detail);
}
