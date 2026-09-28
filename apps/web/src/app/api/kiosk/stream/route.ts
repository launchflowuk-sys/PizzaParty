import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { shopStream } from "@/lib/realtime";
import { kioskGuard } from "@/lib/kiosk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Menu changes only (price, sold out, deals), so the kiosk refreshes itself. No order events: those name other people's orders. */
export async function GET(req: NextRequest) {
  const staff = await kioskGuard(req);
  if (staff instanceof NextResponse) return staff;
  return shopStream(req.signal, (await getClientRow()).id, { menuOnly: true });
}
