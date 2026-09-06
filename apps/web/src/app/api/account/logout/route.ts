import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { COOKIE, verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // The app signs out with a bearer token and has no cookie to send. Reading
  // only the cookie left the Session row alive, so "sign out" on a phone left
  // a working 90-day credential on the device.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const p = await verifyToken(bearer || req.cookies.get(COOKIE.customer)?.value, "customer");
  if (p) await prisma.session.deleteMany({ where: { token: p.sub } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE.customer, "", { path: "/", maxAge: 0 });
  return res;
}
