import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientRow } from "@/lib/menu";
import { assignDriver } from "@/lib/dispatch";
import { posGuard, readJson } from "@/lib/pos";
import { queueDriverList, queueOrderById } from "@/lib/pos-queue";
import type { PosDriverResult } from "@/lib/pos-queue-types";

const Body = z.object({ driverId: z.string().min(1).max(40).nullable() });

/** Put a driver on the order, or null to take it off them. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const client = await getClientRow();
  if (!(await assignDriver(client.id, id, body.driverId, staff.name))) return NextResponse.json({ error: "Order or driver not found." }, { status: 404 });
  const res: PosDriverResult = { order: await queueOrderById(client.id, id), drivers: await queueDriverList(client.id) };
  return NextResponse.json(res);
}
