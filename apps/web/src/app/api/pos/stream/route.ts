import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard } from "@/lib/pos";
import { shopStream } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Live order + menu events for the till. Events: order {orderId, kind}, menu {}, resync {}. */
export async function GET(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  return shopStream(req.signal, (await getClientRow()).id);
}
