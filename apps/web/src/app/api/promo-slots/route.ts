import { NextResponse } from "next/server";
import { liveSlots } from "@/lib/promo-slots";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * The promotions that are running, for the app.
 *
 * Absolute URLs, for the same reason the menu endpoint sends them: a phone has
 * no origin to resolve a relative path against. Built from `siteUrl` directly
 * rather than through `absoluteAssetUrl`, which prefixes `/brand/` and is for
 * files that ship with the build - these come out of the database.
 */
export async function GET() {
  const slots = await liveSlots();
  return NextResponse.json({
    slots: slots.map((s) => ({ ...s, imageUrl: env.siteUrl + s.imageUrl })),
  });
}
