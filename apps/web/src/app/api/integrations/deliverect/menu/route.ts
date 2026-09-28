import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { env } from "@/lib/env";
import { deliverectOn, menuExport } from "@/lib/deliverect";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/deliverect/menu  (Authorization: Bearer <DELIVERECT_SECRET>, or ?token=)
 * The live menu as Deliverect products with our PLUs, for syncing the
 * marketplaces' menus. 404 until DELIVERECT_SECRET is set.
 */
export async function GET(req: NextRequest) {
  if (!deliverectOn()) return new NextResponse("Not found", { status: 404 });
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.nextUrl.searchParams.get("token") || "";
  if (!got || !safeEqual(got, env.deliverectSecret)) return NextResponse.json({ error: "Bad token" }, { status: 401 });
  return NextResponse.json(await menuExport());
}
