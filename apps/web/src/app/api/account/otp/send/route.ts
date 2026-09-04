import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { toE164 } from "@/lib/phone";
import { sendSms } from "@/lib/notify";
import { sha256 } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const phone = toE164(body.phone ?? "");
  if (!phone) return NextResponse.json({ error: "Enter a valid UK mobile number." }, { status: 400 });
  const client = await getClientRow();
  const customer = await prisma.customer.upsert({ where: { clientId_phone: { clientId: client.id, phone } }, create: { clientId: client.id, phone, guest: true }, update: {} });
  const recent = await prisma.otpCode.count({ where: { customerId: customer.id, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (recent >= 3) return NextResponse.json({ error: "Too many codes requested. Try again in 10 minutes." }, { status: 429 });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.otpCode.create({ data: { customerId: customer.id, codeHash: await sha256(`${phone}:${code}:${env.sessionSecret}`), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  const r = await sendSms(phone, `${getConfig().name}: your login code is ${code}. It expires in 10 minutes.`);
  if (!r.ok) return NextResponse.json({ error: "Could not send SMS right now." }, { status: 502 });
  return NextResponse.json({ ok: true, ...(r.id === "dry-run" && !env.isProd ? { devCode: code } : {}) });
}
