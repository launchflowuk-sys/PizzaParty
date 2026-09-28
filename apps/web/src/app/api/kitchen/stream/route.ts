import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";
import { shopStream } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Live order events for the kitchen, and the dispatch board (drivers can't pass posGuard). Same events as /api/pos/stream. */
export async function GET(req: NextRequest) {
  if (!(await kitchenOrAdmin(req))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return shopStream(req.signal, (await getClientRow()).id);
}
