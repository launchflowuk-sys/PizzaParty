import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { COOKIE, cookieOptions, sha256, signToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { findCustomer, readIdentifier } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { identifier?: string; phone?: string; code?: string };
  const id = readIdentifier(body.identifier ?? body.phone ?? "");
  const code = (body.code ?? "").trim();

  // One message for every way this can fail, so a wrong code and an address
  // nobody has ever ordered with are indistinguishable from the outside.
  const wrong = () => NextResponse.json({ error: "That code is not right, or it has expired." }, { status: 400 });

  if (id.kind === "invalid" || !/^\d{6}$/.test(code)) return wrong();

  const client = await getClientRow();
  const customer = await findCustomer(client.id, id);
  if (!customer) return wrong();

  const otp = await prisma.otpCode.findFirst({
    where: { customerId: customer.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= 5) return wrong();

  if (otp.codeHash !== (await sha256(`${customer.id}:${code}:${env.sessionSecret}`))) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return wrong();
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

  // Guest → verified. Orders placed as a guest on this phone are already filed
  // against this record, so their history appears the moment they are in.
  //
  // Signing in by email also stamps the address onto the record: it proves they
  // can read that inbox, which is the same standard the phone number is held
  // to, and it means the next login can go by email for free.
  await prisma.customer.update({
    where: { id: customer.id },
    data: { guest: false, ...(id.kind === "email" && !customer.email ? { email: id.email } : {}) },
  });

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 90 * 86400_000);
  await prisma.session.create({ data: { customerId: customer.id, token, expiresAt } });
  const signed = await signToken({ role: "customer", sub: token });

  /**
   * The app cannot use the cookie, so it is handed the same signed credential
   * in the body - but only when it says it is the app.
   *
   * A browser must never receive this in a readable body: the cookie is
   * httpOnly precisely so that a cross-site script cannot read the session,
   * and returning it as JSON would hand that away for nothing.
   */
  const native = (req.headers.get("x-lf-client") ?? "").startsWith("mobile");

  const res = NextResponse.json({
    ok: true,
    ...(native ? { token: signed, expiresAt: expiresAt.toISOString() } : {}),
  });
  res.cookies.set(COOKIE.customer, signed, cookieOptions("customer"));
  return res;
}
