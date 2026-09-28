import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { NeedsManagerError, transitionOrder } from "@/lib/orders";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";

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
  if (!(await prisma.order.findFirst({ where: { id, clientId: (await getClientRow()).id }, select: { id: true } }))) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  try {
    // A manager signed in to the back office is the approval; everyone else is sent to the till, which asks for a PIN.
    const approvedBy = who.role === "admin" && (!who.sr || who.sr === "manager") ? (who.nm ?? "Manager") : undefined;
    const o = await transitionOrder(id, parsed.data.status, who.role, { etaMinutes: parsed.data.etaMinutes, reason: parsed.data.reason, approvedBy });
    return NextResponse.json({ ok: true, status: o.status, etaAt: o.etaAt });
  } catch (e) {
    if (e instanceof NeedsManagerError) return NextResponse.json({ error: `${e.message} Ask a manager to do it from the till.` }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
