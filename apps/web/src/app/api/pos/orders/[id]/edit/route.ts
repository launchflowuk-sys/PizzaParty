import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard, readJson } from "@/lib/pos";
import { EditBody, editOrder } from "@/lib/pos-edit";
import { orderDetail, posErrorResponse } from "@/lib/pos-queue";
import { printUrl, type PosEditResult } from "@/lib/pos-queue-types";

/** Add or void items on a sent order. Rules in PosEdit (lib/pos-queue-types.ts). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, EditBody);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const client = await getClientRow();
  try {
    const r = await editOrder(client.id, id, staff, body);
    const res: PosEditResult = { order: (await orderDetail(client.id, id))!, eventId: r.eventId, changeTicketUrl: printUrl(id, "changes", r.eventId), printer: r.printer, warnings: r.warnings, ...(r.replayed ? { replayed: true } : {}) };
    return NextResponse.json(res);
  } catch (e) {
    return posErrorResponse(e);
  }
}
