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
/** Every bad guess adds a key; spoofed addresses must not grow the map without end. */
const MAX_KEYS = 5_000;

function limited(key: string): boolean {
  const now = Date.now();
  if (hits.size >= MAX_KEYS && !hits.has(key)) {
    for (const [k, ts] of hits) if (!ts.some((t) => t > now - RATE_WINDOW_MS)) hits.delete(k);
    // ponytail: still full = a flood of fresh addresses; forgetting them all is cheaper than tracking them.
    if (hits.size >= MAX_KEYS) hits.clear();
  }
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
 * Shapes accepted, so a shop can use whichever VoIP provider it likes:
 * - Twilio (form: From, To, CallSid, CallStatus). If TWILIO_AUTH_TOKEN is set
 *   the X-Twilio-Signature must be valid (signed over NEXT_PUBLIC_SITE_URL +
 *   this path + ?token=...).
 * - Other providers' form posts (sipgate push API: from/to/direction; many hosted
 *   PBXs: caller/callerid/cli/number) and JSON with any of the same keys, or { phone, line? }.
 * - GET with the number in the query (?number= / ?from= / ?caller=), for PBXs such as
 *   3CX or Yeastar whose "call a URL on incoming call" feature can only do a GET.
 * Outgoing calls (direction=out) are ignored.
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
/** The caller's number under whichever name the provider uses. */
const NUMBER_KEYS = ["From", "from", "phone", "caller", "callerid", "callerId", "caller_id", "cli", "number"];
const LINE_KEYS = ["line", "To", "to", "called", "did"];
const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) { const v = o[k]; if (typeof v === "string" && v.trim()) return v.trim(); }
  return "";
};
const outgoing = (o: Record<string, unknown>) => /^out/i.test(String(o.direction ?? ""));

export async function GET(req: NextRequest) {
  return handle(req, "query");
}

export async function POST(req: NextRequest) {
  const isForm = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  return handle(req, isForm ? "form" : "json");
}

async function handle(req: NextRequest, shape: "query" | "form" | "json") {
  const want = env.callerIdToken;
  if (!want) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const got = url.searchParams.get("token") ?? req.headers.get("x-callerid-token") ?? "";
  // Wrong guesses are limited per address before the token is even compared.
  const badKey = `bad:${(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 64)}`;
  if ((hits.get(badKey) ?? []).filter((t) => t > Date.now() - RATE_WINDOW_MS).length >= RATE_MAX) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  if (!got || !safeEqual(got, want)) {
    limited(badKey);
    return NextResponse.json({ error: "Bad token" }, { status: 401 });
  }
  if (limited(want)) return NextResponse.json({ error: "Too many calls" }, { status: 429 });

  let params: Record<string, unknown> = {};
  if (shape === "form") {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  } else if (shape === "json") {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Send { phone, line? }." }, { status: 400 });
    params = body as Record<string, unknown>;
  } else {
    for (const [k, v] of url.searchParams.entries()) if (k !== "token") params[k] = v;
  }
  const isTwilio = shape === "form" && typeof params.CallSid === "string";
  if (isTwilio && env.twilioToken) {
    const sig = req.headers.get("x-twilio-signature") ?? "";
    // Twilio signed the URL it was configured with: the public address, query string included.
    if (!sig || !twilioSignatureValid(`${env.siteUrl}${url.pathname}${url.search}`, params as Record<string, string>, sig, env.twilioToken)) {
      return NextResponse.json({ error: "Bad signature" }, { status: 403 });
    }
  }
  const raw = pick(params, NUMBER_KEYS).slice(0, 40);
  if (!raw && shape === "json") return NextResponse.json({ error: "Send { phone, line? }." }, { status: 400 });
  const lineRaw = pick(params, LINE_KEYS);
  const line = lineRaw ? (isTwilio ? prettyPhone(lineRaw) : lineRaw.slice(0, 40)) : undefined;
  const fresh = !outgoing(params) && !NOT_NEW.has(String(params.CallStatus ?? "").toLowerCase());

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

  if (!isTwilio) return NextResponse.json({ ok: true });
  const forward = env.callerIdForwardTo.replace(/[^\d+]/g, "");
  const twiml = forward
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${forward}</Dial></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(twiml, { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });
}
