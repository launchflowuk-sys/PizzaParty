import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";
export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const c of [COOKIE.admin, COOKIE.agency]) res.cookies.set(c, "", { path: "/", maxAge: 0 });
  return res;
}
