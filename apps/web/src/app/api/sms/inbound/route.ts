import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getClientRow } from "@/lib/menu";
import { handleInbound } from "@/lib/opt-out";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Twilio posts replies to the shop's number here.
 *
 * Point the number's "A MESSAGE COMES IN" webhook at:
 *   POST https://<host>/api/sms/inbound
 *
 * This endpoint is public by necessity, so the signature check is the only
 * thing standing between a stranger and the ability to opt customers in and
 * out at will. It is not optional and there is no bypass.
 */

/**
 * Twilio's scheme: HMAC-SHA1 over the full URL with every POST field appended
 * in key order, keyed by the account's auth token.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
function signatureValid(url: string, params: Record<string, string>, header: string, token: string): boolean {
  const payload = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
  const expected = createHmac("sha1", token).update(Buffer.from(payload, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The URL Twilio signed is the one it was configured with, which is not always
 * the one Next sees behind a proxy or a tunnel. NEXT_PUBLIC_SITE_URL is the
 * shop's real public address, so rebuild the URL from that.
 */
function signedUrl(req: NextRequest): string {
  const path = new URL(req.url).pathname;
  return `${env.siteUrl}${path}`;
}

/** Twilio expects TwiML. An empty Response means "received, say nothing". */
function twiml(message: string) {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(body, { status: 200, headers: { "content-type": "text/xml; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  const token = env.twilioToken;
  if (!token) {
    // Refusing beats accepting unverifiable opt-in changes from anyone who
    // finds the URL.
    console.error("[sms:inbound] TWILIO_AUTH_TOKEN is not set; refusing unverified webhook");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const header = req.headers.get("x-twilio-signature") ?? "";
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  if (!header || !signatureValid(signedUrl(req), params, header, token)) {
    console.warn("[sms:inbound] bad signature from", params.From ?? "unknown");
    return NextResponse.json({ error: "Bad signature" }, { status: 403 });
  }

  const from = params.From ?? "";
  const body = params.Body ?? "";
  if (!from) return twiml("");

  const client = await getClientRow();
  const result = await handleInbound({
    clientId: client.id,
    clientName: client.name,
    from,
    body,
    providerId: params.MessageSid,
  });

  return twiml(result.reply);
}
