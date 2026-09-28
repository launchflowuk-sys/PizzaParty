import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard, readJson } from "@/lib/pos";
import { closeDrawer, CloseBody } from "@/lib/pos-cash";
import { posErrorResponse } from "@/lib/pos-queue";

/** Count and close the drawer. Manager PIN always; the figures are frozen. */
export async function POST(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, CloseBody);
  if (body instanceof NextResponse) return body;
  const client = await getClientRow();
  try {
    return NextResponse.json(await closeDrawer(client.id, staff, body));
  } catch (e) {
    return posErrorResponse(e);
  }
}
