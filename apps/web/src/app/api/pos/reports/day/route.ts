import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posErrorResponse, shopTimezone } from "@/lib/pos-queue";
import { dayReport, pickDate, reportsGuard } from "@/lib/pos-reports";
import { dayReportCsv } from "@/lib/pos-report-math";

export const dynamic = "force-dynamic";

/** The end-of-day (Z) report as JSON, or `&format=csv` for a spreadsheet. See PosDayReport. */
export async function GET(req: NextRequest) {
  const staff = await reportsGuard(req, "reports");
  if (staff instanceof NextResponse) return staff;
  const client = await getClientRow();
  try {
    const date = pickDate(req.nextUrl.searchParams.get("date"), await shopTimezone(client.id));
    const report = await dayReport(client.id, date);
    if (req.nextUrl.searchParams.get("format") !== "csv") return NextResponse.json(report);
    return new NextResponse(dayReportCsv(report), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="z-report-${date}.csv"`, "cache-control": "no-store" },
    });
  } catch (e) {
    return posErrorResponse(e);
  }
}
