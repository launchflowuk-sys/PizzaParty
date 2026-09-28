import type { NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { STATUS_LABEL } from "@/lib/orders";
import { onLive, sseResponse } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DONE = ["completed", "rejected", "cancelled"];

/**
 * Server-Sent Events for the customer's order page: sends the status now, then
 * again whenever this order changes (pushed via lib/realtime.ts, no polling).
 * Ends on a terminal status. Output format is unchanged - the page depends on it.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return sseResponse(req.signal, ({ send, close }) => {
    let last = "";
    let busy = false;
    let again = false;
    const tick = async () => {
      if (busy) { again = true; return; }
      busy = true;
      try {
        const o = await prisma.order.findUnique({ where: { id }, select: { status: true, etaAt: true, etaMinutes: true, rejectReason: true, fulfilment: true } });
        if (!o) { close(); return; }
        const payload = { status: o.status, label: STATUS_LABEL[o.status], etaAt: o.etaAt?.toISOString() ?? null, etaMinutes: o.etaMinutes, rejectReason: o.rejectReason, fulfilment: o.fulfilment };
        const key = JSON.stringify(payload);
        if (key !== last) { last = key; send(payload); }
        if (DONE.includes(o.status)) { close(); return; }
      } catch (e) {
        console.error("[order events]", (e as Error).message);
      } finally {
        busy = false;
      }
      if (again) { again = false; void tick(); }
    };
    const off = onLive((e) => { if (e.kind === "resync" || (e.kind === "order" && e.orderId === id)) void tick(); });
    void tick();
    return off;
  });
}
