import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { driversCash } from "@/lib/pos-cash";
import { posErrorResponse, shopTimezone } from "@/lib/pos-queue";
import { pickDate, reportPeriod, reportsGuard } from "@/lib/pos-reports";
import type { PosDriversCashResponse } from "@/lib/pos-reports-types";

export const dynamic = "force-dynamic";

/** Per driver: doorstep cash collected, handed in, still owed. */
export async function GET(req: NextRequest) {
  const staff = await reportsGuard(req, "reports");
  if (staff instanceof NextResponse) return staff;
  const client = await getClientRow();
  try {
    const tz = await shopTimezone(client.id);
    const date = pickDate(req.nextUrl.searchParams.get("date"), tz);
    const { from, to } = await reportPeriod(client.id, tz, date);
    const res: PosDriversCashResponse = { date, drivers: await driversCash(client.id, from, to) };
    return NextResponse.json(res);
  } catch (e) {
    return posErrorResponse(e);
  }
}
