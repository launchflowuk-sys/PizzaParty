import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { toE164 } from "@/lib/phone";
import { posCustomer, posGuard } from "@/lib/pos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const phone = toE164(req.nextUrl.searchParams.get("phone") ?? "");
  if (!phone) return NextResponse.json({ error: "Enter a full phone number." }, { status: 400 });
  const client = await getClientRow();
  return NextResponse.json({ customer: await posCustomer(client.id, { phone }) });
}
