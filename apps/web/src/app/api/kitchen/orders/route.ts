import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow, getLocations } from "@/lib/menu";
import { orderInclude, orderText } from "@/lib/orders";
import { availability } from "@/lib/availability";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Active orders for the kitchen screen (+ today's completed for reference). */
export async function GET(req: NextRequest) {
  if (!(await kitchenOrAdmin(req))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const client = await getClientRow();
  const since = new Date(Date.now() - 12 * 3600_000);
  const [orders, locations] = await Promise.all([
    prisma.order.findMany({
      where: { clientId: client.id, OR: [{ status: { in: ["placed", "accepted", "preparing", "ready", "out_for_delivery"] } }, { status: { in: ["completed", "rejected", "cancelled"] }, updatedAt: { gt: since } }] },
      include: orderInclude, orderBy: { createdAt: "asc" }, take: 200,
    }),
    getLocations(),
  ]);
  // The screen tells staff, in as many words, that nothing but this board is
  // told about a new order. That is only true while all three alert channels
  // are switched off, so the screen has to be able to read them rather than
  // assert it and hope.
  const n = getConfig().notifications;
  return NextResponse.json({
    now: new Date().toISOString(),
    alerts: { sms: !!n.kitchenSms, email: !!n.kitchenEmail, printer: !!n.printerWebhook },
    orders: orders.map((o) => ({
      id: o.id, number: o.number, status: o.status, fulfilment: o.fulfilment, paymentMethod: o.paymentMethod, paid: o.payment?.status === "succeeded",
      customerName: o.customerName, customerPhone: o.customerPhone, address: [o.deliveryLine1, o.deliveryLine2, o.deliveryCity, o.deliveryPostcode].filter(Boolean).join(", "),
      notes: o.notes, scheduledFor: o.scheduledFor, etaAt: o.etaAt, etaMinutes: o.etaMinutes, total: o.total, createdAt: o.createdAt, placedAt: o.placedAt, locationKey: o.location.key, locationName: o.location.name, rejectReason: o.rejectReason,
      items: o.items.map((i) => ({ qty: i.qty, name: i.name, size: i.sizeName, modifiers: i.modifiers.map((m) => m.name), components: i.components.map((c) => `${c.name}${c.sizeName ? ` (${c.sizeName})` : ""}${c.modifiers.length ? ` +${c.modifiers.map((m) => m.name).join(", ")}` : ""}`), notes: i.notes })),
      text: orderText(o),
    })),
    locations: locations.map((l) => { const a = availability(l); return { key: l.key, name: l.name, open: a.open, paused: a.paused, pausedUntil: a.pausedUntil, pauseReason: a.pauseReason, prepMinutes: l.prepMinutes, deliveryMinutes: l.deliveryMinutes }; }),
  });
}
