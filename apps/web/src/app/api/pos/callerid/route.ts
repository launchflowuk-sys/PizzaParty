import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { safeEqual } from "@/lib/auth";
import { env } from "@/lib/env";
import { getClientRow } from "@/lib/menu";
import { twilioSignatureValid } from "@/lib/notify";
import { prettyPhone, toE164 } from "@/lib/phone";
import { publishCall } from "@/lib/realtime";
import type { PosCall } from "@/lib/pos-phase4-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30; // calls a minute per token: far above any shop's phone, far below a flood
// ponytail: per-process memory, resets on restart; fine for one small instance.
const hits = new Map<string, number[]>();

function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_MAX;
}

/** Twilio sends status callbacks for every leg; only a new, ringing call should pop up. */
const NOT_NEW = new Set(["in-progress", "answered", "completed", "busy", "failed", "no-answer", "canceled"]);

/**
 * Caller ID: the phone rings, the customer pops up on the till (`event: call`
 * on /api/pos/stream).
 *
 *   POST /api/pos/callerid?token=<CALLERID_TOKEN>
 *
 * Two shapes:
 * - Twilio (form: From, To, CallSid, CallStatus). If TWILIO_AUTH_TOKEN is set
 *   the X-Twilio-Signature must be valid (signed over NEXT_PUBLIC_SITE_URL +
 *   this path + ?token=...).
 * - Any other VoIP/SIP box: JSON { phone, line? }.
 *
 * Routing is never changed by accident. Twilio treats the reply to its
 * "A call comes in" webhook as the call's instructions, so:
 * - CALLERID_FORWARD_TO unset: the reply is an empty <Response/>. Point the
 *   number's "Call status changes" callback here (Twilio ignores the reply to
 *   that one), and leave "A call comes in" as it is today - the call rings
 *   exactly as before. (Used as "A call comes in" an empty reply would end the call.)
 * - CALLERID_FORWARD_TO set (e.g. the shop's landline): this may be the
 *   "A call comes in" webhook itself, and the reply <Dial>s that number, so
 *   one URL both pops the till and puts the call through.
 */
export async function POST(req: NextRequest) {
  const want = env.callerIdToken;
  if (!want) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const got = url.searchParams.get("token") ?? req.headers.get("x-callerid-token") ?? "";
  // Wrong guesses are limited per address before the token is even compared.
  const badKey = `bad:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
  if ((hits.get(badKey) ?? []).filter((t) => t > Date.now() - RATE_WINDOW_MS).length >= RATE_MAX) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  if (!got || !safeEqual(got, want)) {
    limited(badKey);
    return NextResponse.json({ error: "Bad token" }, { status: 401 });
  }
  if (limited(want)) return NextResponse.json({ error: "Too many calls" }, { status: 429 });

  const isForm = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  let raw = "";
  let line: string | undefined;
  let fresh = true;
  if (isForm) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
    if (env.twilioToken) {
      const sig = req.headers.get("x-twilio-signature") ?? "";
      // Twilio signed the URL it was configured with: the public address, query string included.
      if (!sig || !twilioSignatureValid(`${env.siteUrl}${url.pathname}${url.search}`, params, sig, env.twilioToken)) {
        return NextResponse.json({ error: "Bad signature" }, { status: 403 });
      }
    }
    raw = params.From ?? "";
    line = params.To ? prettyPhone(params.To) : undefined;
    fresh = !NOT_NEW.has((params.CallStatus ?? "").toLowerCase());
  } else {
    const body = (await req.json().catch(() => null)) as { phone?: unknown; line?: unknown } | null;
    if (!body || typeof body.phone !== "string") return NextResponse.json({ error: "Send { phone, line? }." }, { status: 400 });
    raw = body.phone;
    line = typeof body.line === "string" && body.line.trim() ? body.line.trim().slice(0, 40) : undefined;
  }

  if (fresh && raw) {
    const client = await getClientRow();
    const phone = toE164(raw);
    // Withheld and odd numbers still pop up, just without a name.
    const c = phone ? await prisma.customer.findUnique({ where: { clientId_phone: { clientId: client.id, phone } }, select: { name: true, ordersCount: true, deletedAt: true } }) : null;
    const known = c && !c.deletedAt;
    const call: PosCall = {
      phone: phone ?? raw.slice(0, 20), at: new Date().toISOString(),
      ...(line ? { line } : {}),
      ...(known ? { customerName: c.name.slice(0, 80), ordersCount: c.ordersCount } : {}),
    };
    await publishCall(client.id, call);
  }

  if (!isForm) return NextResponse.json({ ok: true });
  const forward = env.callerIdForwardTo.replace(/[^\d+]/g, "");
  const twiml = forward
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${forward}</Dial></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(twiml, { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });
}
