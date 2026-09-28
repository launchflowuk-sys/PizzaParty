import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posErrorResponse, shopTimezone } from "@/lib/pos-queue";
import { pickDate, reconcileStripeDay, reportsGuard } from "@/lib/pos-reports";

export const dynamic = "force-dynamic";

/** Managers: make the day's mismatched card refunds agree with Stripe, then return the match again. */
export async function POST(req: NextRequest) {
  const staff = await reportsGuard(req, "manager");
  if (staff instanceof NextResponse) return staff;
  const client = await getClientRow();
  try {
    const date = pickDate(req.nextUrl.searchParams.get("date"), await shopTimezone(client.id));
    return NextResponse.json(await reconcileStripeDay(client.id, date));
  } catch (e) {
    return posErrorResponse(e);
  }
}
