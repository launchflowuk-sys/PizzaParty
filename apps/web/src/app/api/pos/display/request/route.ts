import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { findProduct, getClientRow, getMenu } from "@/lib/menu";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";
import { publishDisplayRequest } from "@/lib/realtime";
import { DISPLAY_REQ_PER_MIN, REQUEST_ID, rateLimited, type DisplayRequest } from "@/lib/pos-display-requests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 1_000;
const id = z.string().regex(REQUEST_ID);
const base = { tillId: id, id };
const inHandoff = { ...base, handoff: id };
const Body = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("hello") }).strict(),
  z.object({ ...inHandoff, type: z.literal("add"), slug: z.string().regex(/^[a-z0-9-]{1,120}$/) }).strict(),
  z.object({ ...inHandoff, type: z.literal("remove"), ref: id }).strict(),
  z.object({ ...inHandoff, type: z.literal("pay"), method: z.enum(["card", "cash"]), total: z.number().int().min(0).max(10_000_000) }).strict(),
  z.object({ ...inHandoff, type: z.literal("ready") }).strict(),
  z.object({ ...inHandoff, type: z.literal("more") }).strict(),
]);

// ponytail: per process, like the kiosk's limiter; a second instance doubles the allowance.
const g = globalThis as unknown as { __lfDisplayHits?: Map<string, number[]> };
const hits = (g.__lfDisplayHits ??= new Map());

/**
 * A customer's tap on the customer display (POS-PLAN item 29): add an extra, undo
 * it, "ready", "add something else", or pay by card/cash. Same sign-in as the
 * display itself (kitchen PIN or staff), this shop only, 20 a minute per sign-in.
 * An add must be a live, in-stock, one-tap product (one size, no options). The
 * request is only relayed to the tills' own stream; the till decides whether to
 * apply it (lib/pos-display-requests.ts checkDisplayRequest) and never lets the
 * display touch prices, discounts or staff-rung lines.
 */
export async function POST(req: NextRequest) {
  const who = await kitchenOrAdmin(req);
  if (!who) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (rateLimited(hits, `${who.role}:${who.sub}:${who.exp}`, DISPLAY_REQ_PER_MIN, 60_000)) {
    return NextResponse.json({ error: "Too many taps - please wait a moment." }, { status: 429 });
  }
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "Too big." }, { status: 413 });
  let raw: unknown = null;
  try { raw = JSON.parse(text); } catch { /* falls through to the 400 */ }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Please check the details." }, { status: 400 });
  const body: DisplayRequest = parsed.data;

  if (body.type === "add") {
    const hit = findProduct(await getMenu(), body.slug);
    const p = hit?.product;
    if (!p || p.soldOut) return NextResponse.json({ error: "Sorry, that's not available right now." }, { status: 409 });
    if (p.sizes.length !== 1 || p.modifierGroups.length > 0) return NextResponse.json({ error: "Please ask our team to add that one." }, { status: 422 });
  }
  await publishDisplayRequest((await getClientRow()).id, body);
  return NextResponse.json({ ok: true });
}
