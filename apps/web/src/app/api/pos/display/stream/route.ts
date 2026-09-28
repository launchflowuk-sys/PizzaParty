import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";
import { displayStream } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The customer display's live feed: `event: display` (PosDisplayEnvelope) only. Its own
 * stream rather than /api/pos/stream because the display tablet signs in with a
 * low-privilege (kitchen-role) PIN that cannot pass posGuard, and it needs no orders.
 */
export async function GET(req: NextRequest) {
  if (!(await kitchenOrAdmin(req))) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return displayStream(req.signal, (await getClientRow()).id);
}
