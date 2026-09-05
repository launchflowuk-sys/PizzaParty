import { NextResponse, type NextRequest } from "next/server";
import { BasketBody, priceRequest } from "@/lib/checkout";

export async function POST(req: NextRequest) {
  const parsed = BasketBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { priced, location, availability, terms } = await priceRequest(parsed.data);
  return NextResponse.json({
    ...priced,
    // The BANDED fee and minimum for this postcode, not the shop's headline
    // figures. Quoting one number here and charging another in the summary
    // directly below it is exactly the surprise banding was meant to avoid.
    location: location
      ? {
          key: location.key, name: location.name,
          deliveryFee: terms.fee, minOrder: terms.minOrder,
          band: terms.bandName,
          etaMinutes: location.deliveryMinutes + terms.extraMinutes,
          open: availability?.open ?? false, paused: availability?.paused ?? false,
        }
      : null,
  });
}
