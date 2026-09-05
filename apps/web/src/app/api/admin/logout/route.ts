import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";
export async function POST() {
  const res = NextResponse.json({ ok: true });
  // The kitchen cookie is cleared as well: signing in with a staff PIN grants it,
  // so leaving it behind would keep the last person's kitchen screen open.
  for (const c of [COOKIE.admin, COOKIE.agency, COOKIE.kitchen]) res.cookies.set(c, "", { path: "/", maxAge: 0 });
  return res;
}
