import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { COOKIE, verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const p = await verifyToken(req.cookies.get(COOKIE.customer)?.value, "customer");
  if (p) await prisma.session.deleteMany({ where: { token: p.sub } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE.customer, "", { path: "/", maxAge: 0 });
  return res;
}
