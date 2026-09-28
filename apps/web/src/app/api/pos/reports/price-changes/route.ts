import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posErrorResponse } from "@/lib/pos-queue";
import { priceChanges, reportsGuard } from "@/lib/pos-reports";

export const dynamic = "force-dynamic";

/** Every menu price change in a date range, newest first. See PosPriceChanges. */
export async function GET(req: NextRequest) {
  const staff = await reportsGuard(req, "manager");
  if (staff instanceof NextResponse) return staff;
  const client = await getClientRow();
  const q = req.nextUrl.searchParams;
  try {
    return NextResponse.json(await priceChanges(client.id, q.get("from"), q.get("to")));
  } catch (e) {
    return posErrorResponse(e);
  }
}
