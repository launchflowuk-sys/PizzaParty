import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { sendSms, sendEmail } from "@/lib/notify";
import { loginCodeEmail } from "@/lib/email/templates";
import { sha256 } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { env } from "@/lib/env";
import { findCustomer, readIdentifier } from "@/lib/identity";

export const dynamic = "force-dynamic";

// ponytail: App Store review can't receive a UK SMS, so this one number gets a
// fixed code instead of a random one. Same number is in the ASC review notes.
// Upgrade path: rotate/remove once the app is approved and out of review.
const REVIEWER_PHONE = "+447902810090";
const REVIEWER_CODE = "483920";

/**
 * Send a one-time code, by whichever route they asked for.
 *
 * One field on the form: a mobile number or an email address. Typing an email
 * sends the code by email, which costs nothing - every login code that used to
 * go by SMS was about 4p of somebody's money to deliver six digits.
 *
 * Two rules that are not obvious from the outside.
 *
 * An unknown **email** gets the same reply as a known one and no message is
 * sent. Anything else turns this box into a way of asking "does this person
 * order from Farm Pizza?", which is not a question a stranger is owed an
 * answer to.
 *
 * An unknown **phone number** does create a record, because that is how the
 * shop identifies people and their guest orders are already filed under it.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { identifier?: string; phone?: string };
  // `phone` is still read so an older cached page keeps working through a deploy.
  const id = readIdentifier(body.identifier ?? body.phone ?? "");

  if (id.kind === "invalid") {
    return NextResponse.json({ error: "Enter your mobile number or the email address you order with." }, { status: 400 });
  }

  const client = await getClientRow();
  const customer = await findCustomer(client.id, id);

  // Nothing on record for that address. Answer exactly as if there were.
  if (!customer) {
    return NextResponse.json({ ok: true, channel: "email", unverified: true });
  }

  const recent = await prisma.otpCode.count({
    where: { customerId: customer.id, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
  });
  if (recent >= 3) return NextResponse.json({ error: "Too many codes requested. Try again in 10 minutes." }, { status: 429 });

  const isReviewer = id.kind === "phone" && id.phone === REVIEWER_PHONE;
  const code = isReviewer ? REVIEWER_CODE : String(Math.floor(100000 + Math.random() * 900000));
  await prisma.otpCode.create({
    data: {
      // Hashed against the customer rather than the phone number, so the same
      // code works whichever way it was asked for.
      customerId: customer.id,
      codeHash: await sha256(`${customer.id}:${code}:${env.sessionSecret}`),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });

  const shop = getConfig().name;

  if (id.kind === "email") {
    const mail = loginCodeEmail(code);
    const r = await sendEmail(id.email, mail.subject, mail.html);
    if (!r.ok) return NextResponse.json({ error: "Could not send that email right now." }, { status: 502 });
    return NextResponse.json({ ok: true, channel: "email", ...devCode(code, r.id) });
  }

  if (isReviewer) return NextResponse.json({ ok: true, channel: "sms" });

  const r = await sendSms(id.phone, `${shop}: your login code is ${code}. It expires in 10 minutes.`);
  if (!r.ok) return NextResponse.json({ error: "Could not send that text right now." }, { status: 502 });
  return NextResponse.json({ ok: true, channel: "sms", ...devCode(code, r.id) });
}

/** In development with nothing connected, show the code rather than hide it. */
function devCode(code: string, id?: string) {
  return id === "dry-run" && !env.isProd ? { devCode: code } : {};
}
