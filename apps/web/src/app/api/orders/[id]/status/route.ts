import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { STATUS_LABEL } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Just the status, for polling.
 *
 * There is an SSE stream at /events, and the app should not use it. React
 * Native has no EventSource, the stream re-queries the database every three
 * seconds for every viewer, and mobile networks drop long-lived connections
 * the moment the app is backgrounded or the handset changes cell.
 *
 * This is the small thing to ask for every ten seconds instead - only the
 * fields that change - and only while the tracker is on screen. Once the app
 * is in the background, push takes over.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true, etaAt: true, etaMinutes: true, rejectReason: true, fulfilment: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    status: order.status,
    label: STATUS_LABEL[order.status],
    etaAt: order.etaAt?.toISOString() ?? null,
    etaMinutes: order.etaMinutes,
    rejectReason: order.rejectReason || "",
    fulfilment: order.fulfilment,
    /** Terminal states: the app should stop polling on any of these. */
    done: ["completed", "rejected", "cancelled"].includes(order.status),
  }, { headers: { "cache-control": "no-store" } });
}
