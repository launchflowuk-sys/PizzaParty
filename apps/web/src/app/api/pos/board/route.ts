import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";
import { shopTimezone } from "@/lib/pos-queue";
import { startOfDayIn } from "@/lib/pos-money";
import type { BoardResponse } from "@/lib/pos-board-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A ready order that nobody marks collected still leaves the board after this long. */
const READY_TTL_MS = 30 * 60_000;
const CAP = 100;

/**
 * Order status board (POS-PLAN item 36): today's non-delivery orders, split
 * "Preparing" / "Ready to collect" for a TV next to the kiosk. Guarded the same
 * way as the customer display (kitchenOrAdmin) - a kitchen-role PIN is enough,
 * never the till itself. No SSE of its own: the board refetches on
 * /api/kitchen/stream's order events, with a 30s safety poll, same pattern the
 * customer display uses for /api/pos/display/stream.
 */
export async function GET(req: NextRequest) {
  if (!(await kitchenOrAdmin(req))) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const client = await getClientRow();
  const cfg = getConfig();
  const dayStart = startOfDayIn(await shopTimezone(client.id), new Date());
  const readyCutoff = new Date(Date.now() - READY_TTL_MS);

  const rows = await prisma.order.findMany({
    where: {
      clientId: client.id,
      fulfilment: { not: "delivery" },
      createdAt: { gte: dayStart },
      OR: [
        { status: { in: ["placed", "accepted", "preparing"] } },
        { status: "ready", updatedAt: { gte: readyCutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, number: true, customerName: true, source: true, status: true },
    take: CAP,
  });

  const showNames = cfg.pos.boardShowNames;
  const body: BoardResponse = {
    orders: rows.map((o) => ({
      id: o.id,
      number: o.number,
      name: showNames ? o.customerName.trim().split(/\s+/)[0] || null : null,
      source: o.source,
      state: o.status === "ready" ? "ready" : "preparing",
    })),
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
