import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { marketplaceStatus } from "@/lib/deliverect";
import { reportsGuard } from "@/lib/pos-reports";

export const dynamic = "force-dynamic";

/** GET /api/pos/marketplaces → PosMarketplaceStatus. Managers only. */
export async function GET(req: NextRequest) {
  const staff = await reportsGuard(req, "manager");
  if (staff instanceof NextResponse) return staff;
  return NextResponse.json(await marketplaceStatus((await getClientRow()).id));
}
