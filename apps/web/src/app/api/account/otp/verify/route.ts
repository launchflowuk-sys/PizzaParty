import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { toE164 } from "@/lib/phone";
import { COOKIE, cookieOptions, sha256, signToken } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  const phone = toE164(body.phone ?? "");
  const code = (body.code ?? "").trim();
  if (!phone || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  const client = await getClientRow();
  const customer = await prisma.customer.findUnique({ where: { clientId_phone: { clientId: client.id, phone } } });
  if (!customer) return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  const otp = await prisma.otpCode.findFirst({ where: { customerId: customer.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.attempts >= 5) return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
  if (otp.codeHash !== (await sha256(`${phone}:${code}:${env.sessionSecret}`))) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Wrong code." }, { status: 400 });
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  // Guest → verified. Orders placed as guest with this phone are already linked by phone.
  await prisma.customer.update({ where: { id: customer.id }, data: { guest: false } });
  const token = randomBytes(24).toString("base64url");
  await prisma.session.create({ data: { customerId: customer.id, token, expiresAt: new Date(Date.now() + 90 * 86400_000) } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE.customer, await signToken({ role: "customer", sub: token }), cookieOptions("customer"));
  return res;
}
