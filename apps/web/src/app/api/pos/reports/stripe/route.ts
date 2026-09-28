import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posErrorResponse, shopTimezone } from "@/lib/pos-queue";
import { pickDate, reportsGuard, stripeReport } from "@/lib/pos-reports";

export const dynamic = "force-dynamic";

/** Card takings against Stripe's balance transactions for the day. See PosStripeReport. */
export async function GET(req: NextRequest) {
  const staff = await reportsGuard(req, "manager");
  if (staff instanceof NextResponse) return staff;
  const client = await getClientRow();
  try {
    const date = pickDate(req.nextUrl.searchParams.get("date"), await shopTimezone(client.id));
    return NextResponse.json(await stripeReport(client.id, date));
  } catch (e) {
    return posErrorResponse(e);
  }
}
