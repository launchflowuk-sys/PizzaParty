import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard, readJson } from "@/lib/pos";
import { RefundBody, refundPayment } from "@/lib/pos-edit";
import { orderDetail, posErrorResponse, refundView } from "@/lib/pos-queue";
import type { PosRefundResult } from "@/lib/pos-queue-types";

/** Money back, manager PIN always. Card through Stripe, cash out of the drawer. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, RefundBody);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const client = await getClientRow();
  try {
    const refund = await refundPayment(client.id, id, staff, body);
    const res: PosRefundResult = { refund: refundView(refund), order: (await orderDetail(client.id, id))! };
    return NextResponse.json(res);
  } catch (e) {
    return posErrorResponse(e);
  }
}
