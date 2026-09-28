import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { transitionOrder } from "@/lib/orders";
import { posGuard, readJson } from "@/lib/pos";
import { queueOrderById } from "@/lib/pos-queue";

const Body = z.object({
  to: z.enum(["accepted", "preparing", "ready", "out_for_delivery", "completed", "rejected", "cancelled"]),
  etaMinutes: z.number().int().min(5).max(180).optional(),
  reason: z.string().trim().max(200).optional(),
});

/** Accept, reject or move an order on, by the kitchen's own rules (transitionOrder). Rejecting a card-paid order refunds it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const client = await getClientRow();
  if (!(await prisma.order.findFirst({ where: { id, clientId: client.id }, select: { id: true } }))) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  try {
    await transitionOrder(id, body.to, staff.name, { etaMinutes: body.etaMinutes, reason: body.reason });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
  return NextResponse.json(await queueOrderById(client.id, id));
}
