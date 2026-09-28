import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { env } from "@/lib/env";
import { deliverectOn, menuExport } from "@/lib/deliverect";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/deliverect/menu  (Authorization: Bearer <DELIVERECT_MENU_TOKEN>, or ?token=)
 * The live menu as Deliverect products with our PLUs, for syncing the
 * marketplaces' menus. 404 until both DELIVERECT_SECRET and DELIVERECT_MENU_TOKEN are set.
 * Its own token, never the order-signing secret: a ?token= URL can end up in proxy
 * logs, and the signing secret leaking would let anyone forge paid orders.
 */
export async function GET(req: NextRequest) {
  if (!deliverectOn() || !env.deliverectMenuToken) return new NextResponse("Not found", { status: 404 });
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("token") || "";
  if (!got || !safeEqual(got, env.deliverectMenuToken)) return NextResponse.json({ error: "Bad token" }, { status: 401 });
  return NextResponse.json(await menuExport());
}
