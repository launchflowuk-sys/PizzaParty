import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { posCustomer, posGuard, readJson } from "@/lib/pos";

const Body = z.object({ staffNotes: z.string().trim().max(500).optional(), blocked: z.boolean().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const client = await getClientRow();
  const r = await prisma.customer.updateMany({ where: { id, clientId: client.id }, data: body });
  if (!r.count) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  return NextResponse.json({ customer: await posCustomer(client.id, { id }) });
}
