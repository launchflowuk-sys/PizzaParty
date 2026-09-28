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
export async function POST(req: NextRequest) {
  if (!deliverectOn()) return new NextResponse("Not found", { status: 404 });
  const raw = await req.text();
  if (!hmacValid(raw, req.headers.get("x-server-authorization-hmac-sha256") ?? "")) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const r = await ingestOrder(json);
  return NextResponse.json(r.body, { status: r.status });
}
