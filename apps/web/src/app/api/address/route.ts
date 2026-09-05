import { NextResponse, type NextRequest } from "next/server";
import { placesEnabled, resolveAddress, suggestAddresses } from "@/lib/places";

export const dynamic = "force-dynamic";

/**
 * The address lookup the checkout talks to.
 *
 * One route, two jobs, so there is one place to reason about what leaves the
 * server. The Places key never reaches the browser: Google's own examples put a
 * referrer-locked browser key in the page, and a referrer can be spoofed by
 * anybody with curl - the meter is the shop's either way.
 *
 * Nothing here is logged. An address somebody is halfway through typing is
 * their home, and it has no business in a log file.
 */
export async function GET(req: NextRequest) {
  if (!placesEnabled()) return NextResponse.json({ enabled: false, suggestions: [] });

  const q = req.nextUrl.searchParams;
  const session = (q.get("session") ?? "").slice(0, 64);
  if (!session) return NextResponse.json({ error: "session required" }, { status: 400 });

  const placeId = q.get("id");
  if (placeId) {
    const address = await resolveAddress(placeId.slice(0, 300), session);
    return address
      ? NextResponse.json({ enabled: true, address })
      : NextResponse.json({ enabled: true, address: null }, { status: 404 });
  }

  const suggestions = await suggestAddresses((q.get("q") ?? "").slice(0, 200), session);
  return NextResponse.json({ enabled: true, suggestions });
}
