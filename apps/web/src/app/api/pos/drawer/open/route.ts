import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard, readJson } from "@/lib/pos";
import { openDrawer, OpenBody } from "@/lib/pos-cash";
import { posErrorResponse } from "@/lib/pos-queue";

/** Open the drawer with a float. Manager approval (PIN unless signed in as a manager). */
export async function POST(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, OpenBody);
  if (body instanceof NextResponse) return body;
  const client = await getClientRow();
  try {
    return NextResponse.json(await openDrawer(client.id, staff, body));
  } catch (e) {
    return posErrorResponse(e);
  }
}
