import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard } from "@/lib/pos";
import { currentDrawer } from "@/lib/pos-cash";
import { posErrorResponse, shopTimezone } from "@/lib/pos-queue";
import { startOfDayIn } from "@/lib/pos-money";
import type { PosDrawerResponse } from "@/lib/pos-reports-types";

export const dynamic = "force-dynamic";

/** The open drawer, else the one closed today, else null. */
export async function GET(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const client = await getClientRow();
  try {
    const since = startOfDayIn(await shopTimezone(client.id));
    const res: PosDrawerResponse = { drawer: await currentDrawer(client.id, req.nextUrl.searchParams.get("location") ?? undefined, since) };
    return NextResponse.json(res);
  } catch (e) {
    return posErrorResponse(e);
  }
}
