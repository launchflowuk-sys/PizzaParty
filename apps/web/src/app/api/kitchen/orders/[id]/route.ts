import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { transitionOrder } from "@/lib/orders";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";

const Body = z.object({
  status: z.enum(["accepted", "preparing", "ready", "out_for_delivery", "completed", "rejected", "cancelled"]),
  etaMinutes: z.number().int().min(5).max(180).optional(),
  reason: z.string().max(200).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const who = await kitchenOrAdmin(req);
  if (!who) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    const o = await transitionOrder(id, parsed.data.status, who.role, { etaMinutes: parsed.data.etaMinutes, reason: parsed.data.reason });
    return NextResponse.json({ ok: true, status: o.status, etaAt: o.etaAt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
