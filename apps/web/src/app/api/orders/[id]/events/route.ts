import type { NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { STATUS_LABEL } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Server-Sent Events: polls the order every 3s and pushes changes. Ends on a terminal status. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const enc = new TextEncoder();
  let last = "";
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const tick = async () => {
        if (closed) return;
        const o = await prisma.order.findUnique({ where: { id }, select: { status: true, etaAt: true, etaMinutes: true, rejectReason: true, fulfilment: true } });
        if (!o) { controller.close(); return; }
        const payload = { status: o.status, label: STATUS_LABEL[o.status], etaAt: o.etaAt?.toISOString() ?? null, etaMinutes: o.etaMinutes, rejectReason: o.rejectReason, fulfilment: o.fulfilment };
        const key = JSON.stringify(payload);
        if (key !== last) { last = key; send(payload); }
        if (["completed", "rejected", "cancelled"].includes(o.status)) { closed = true; controller.close(); return; }
        controller.enqueue(enc.encode(": ping\n\n"));
        setTimeout(tick, 3000);
      };
      await tick();
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
