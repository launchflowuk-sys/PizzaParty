import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, cookieOptions, safeEqual, signToken } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  if (!env.kitchenPin || !pin || !safeEqual(pin, env.kitchenPin)) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE.kitchen, await signToken({ role: "kitchen", sub: "kitchen" }), cookieOptions("kitchen"));
  return res;
}
