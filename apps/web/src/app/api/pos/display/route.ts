import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientRow } from "@/lib/menu";
import { posGuard } from "@/lib/pos";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";
import { lastDisplays, publishDisplay } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 64_000;
const pence = z.number().int().min(0).max(10_000_000);
const Line = z.object({
  name: z.string().max(120), detail: z.string().max(400), qty: z.number().int().min(1).max(999), lineTotal: pence,
  image: z.string().max(500).optional(), slug: z.string().max(120).optional(),
  size: z.string().max(60).optional(), unitPrice: pence.optional(),
  modifiers: z.array(z.object({ name: z.string().max(80), price: z.number().int().min(-1_000_000).max(1_000_000) })).max(30).optional(),
});
const Msg = z.discriminatedUnion("type", [
  z.object({ type: z.literal("basket"), shopName: z.string().max(120), lines: z.array(Line).max(150), subtotal: pence, discount: pence, deliveryFee: pence, total: pence, fulfilment: z.enum(["delivery", "collection", "eat_in"]).optional() }),
  z.object({ type: z.literal("paying"), total: pence, method: z.enum(["cash", "reader"]), tendered: pence.optional(), change: pence.optional() }),
  z.object({ type: z.literal("paid"), orderNumber: z.number().int().min(0), change: pence.optional() }),
  z.object({ type: z.literal("idle"), shopName: z.string().max(120) }),
]);
const Body = z.object({ tillId: z.string().regex(/^[\w-]{8,64}$/), tillName: z.string().trim().min(1).max(40), at: z.number().int().positive(), msg: Msg });

/** The till's customer-display message, relayed to every display on any device (POS-PLAN item 29). */
export async function POST(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "Too big." }, { status: 413 });
  let raw: unknown = null;
  try { raw = JSON.parse(text); } catch { /* falls through to the 400 */ }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Please check the details." }, { status: 400 });
  await publishDisplay((await getClientRow()).id, parsed.data);
  return NextResponse.json({ ok: true });
}

/** Tills heard from recently (PosDisplayTill[]), for a display that has just connected. `?till=` narrows to one. */
export async function GET(req: NextRequest) {
  if (!(await kitchenOrAdmin(req))) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const till = req.nextUrl.searchParams.get("till");
  const tills = lastDisplays((await getClientRow()).id).filter((t) => !till || t.tillId === till);
  return NextResponse.json({ tills }, { headers: { "cache-control": "no-store" } });
}
