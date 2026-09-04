import { NextResponse, type NextRequest } from "next/server";
import { getLocations } from "@/lib/menu";
import { availability } from "@/lib/availability";
import { isValidUkPostcode, matchLocation, normalisePostcode } from "@/lib/postcode";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { postcode?: string };
  const postcode = normalisePostcode(body.postcode ?? "");
  if (!postcode || (postcode.length > 4 && !isValidUkPostcode(postcode))) return NextResponse.json({ ok: false, message: "That doesn't look like a UK postcode." });
  const locations = await getLocations();
  const loc = matchLocation(postcode, locations);
  const res = NextResponse.json(
    loc
      ? { ok: true, location: { key: loc.key, name: loc.name, deliveryFee: loc.deliveryFee, minOrder: loc.minOrder, open: availability(loc).open, etaMinutes: loc.deliveryMinutes } }
      : { ok: false, message: "Sorry, we don't deliver to that postcode yet. Collection is available." },
  );
  res.cookies.set("lf_postcode", postcode, { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });
  return res;
}
