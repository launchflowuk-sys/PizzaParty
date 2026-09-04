import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, cookieOptions, safeEqual, signToken } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const { password, key } = (await req.json().catch(() => ({}))) as { password?: string; key?: string };
  await new Promise((r) => setTimeout(r, 300));
  const res = NextResponse.json({ ok: true });
  if (key && env.launchflowKey && safeEqual(key, env.launchflowKey)) {
    res.cookies.set(COOKIE.agency, await signToken({ role: "agency", sub: "launchflow" }), cookieOptions("agency"));
    res.cookies.set(COOKIE.admin, await signToken({ role: "admin", sub: "launchflow" }), cookieOptions("admin"));
    return res;
  }
  if (password && env.adminPassword && safeEqual(password, env.adminPassword)) {
    res.cookies.set(COOKIE.admin, await signToken({ role: "admin", sub: "owner" }), cookieOptions("admin"));
    return res;
  }
  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}
