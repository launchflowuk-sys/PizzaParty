import { NextResponse, type NextRequest } from "next/server";
import { deliverectOn, hmacValid, ingestOrder } from "@/lib/deliverect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Deliverect's order webhook: Just Eat, Deliveroo and Uber Eats orders land in
 * the till queue and the kitchen like any other. Set this URL as the POS order
 * webhook in Deliverect. 404 until DELIVERECT_SECRET is set; every request must
 * carry a valid `x-server-authorization-hmac-sha256` over the raw body.
 * Idempotent on Deliverect's order id: a re-delivery returns the first order.
 */
/** A real order is a few KB. The body is read before the signature can be checked, so an unsigned one must not fill memory. */
const MAX_BODY = 512 * 1024;

/** The raw body as text, or null once it passes `max` bytes (declared or actually sent). */
async function readCapped(req: NextRequest, max: number): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  if (!req.body) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of req.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > max) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(req: NextRequest) {
  if (!deliverectOn()) return new NextResponse("Not found", { status: 404 });
  const raw = await readCapped(req, MAX_BODY);
  if (raw === null) return NextResponse.json({ error: "Body too large." }, { status: 413 });
  if (!hmacValid(raw, req.headers.get("x-server-authorization-hmac-sha256") ?? "")) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const r = await ingestOrder(json);
  return NextResponse.json(r.body, { status: r.status });
}
