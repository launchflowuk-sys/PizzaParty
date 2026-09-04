import { NextResponse, type NextRequest } from "next/server";
import { BasketBody, priceRequest } from "@/lib/checkout";

export async function POST(req: NextRequest) {
  const parsed = BasketBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { priced, location, availability } = await priceRequest(parsed.data);
  return NextResponse.json({
    ...priced,
    location: location ? { key: location.key, name: location.name, deliveryFee: location.deliveryFee, minOrder: location.minOrder, open: availability?.open ?? false, paused: availability?.paused ?? false } : null,
  });
}
