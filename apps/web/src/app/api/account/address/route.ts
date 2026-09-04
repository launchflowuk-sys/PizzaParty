import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { currentCustomer } from "@/lib/session";

export async function DELETE(req: NextRequest) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await prisma.address.deleteMany({ where: { id, customerId: customer.id } });
  return NextResponse.json({ ok: true });
}
