import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard, readJson } from "@/lib/pos";
import { addMovement, MovementBody } from "@/lib/pos-cash";
import { posErrorResponse } from "@/lib/pos-queue";

/** A pay-in or pay-out with a reason. Over £50 needs a manager PIN. */
export async function POST(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, MovementBody);
  if (body instanceof NextResponse) return body;
  const client = await getClientRow();
  try {
    return NextResponse.json(await addMovement(client.id, staff, body));
  } catch (e) {
    return posErrorResponse(e);
  }
}
