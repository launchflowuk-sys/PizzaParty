import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow, getLocations } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { availability } from "@/lib/availability";
import { listReaders, posGuard } from "@/lib/pos";
import type { PosBootstrap } from "@/lib/pos-types";

export const dynamic = "force-dynamic";

const BESTSELLERS = 12;

export async function GET(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const cfg = getConfig();
  const client = await getClientRow();
  const [top, locations, readers] = await Promise.all([
    prisma.product.findMany({ where: { clientId: client.id, active: true, ordersCount: { gt: 0 } }, orderBy: { ordersCount: "desc" }, take: BESTSELLERS, select: { slug: true } }),
    getLocations(),
    listReaders(),
  ]);
  const a = locations[0] ? availability(locations[0]) : null;
  const body: PosBootstrap = {
    staff: { id: staff.id, name: staff.name, role: staff.role },
    shopName: cfg.name,
    bestsellers: top.map((p) => p.slug),
    locations: locations.map((l) => ({ key: l.key, name: l.name })),
    readers,
    cashOnDelivery: cfg.payments.cashOnDelivery,
    onlineStatus: {
      open: !!a?.open,
      paused: !!a?.paused,
      message: !a ? "No active location." : a.paused ? `Online ordering paused${a.pauseReason ? ` (${a.pauseReason})` : ""}.` : a.open ? "Open online." : "Closed online. The till can still take orders.",
    },
  };
  return NextResponse.json(body);
}
