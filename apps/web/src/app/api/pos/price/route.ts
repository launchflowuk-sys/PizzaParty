import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard, PosBasketBody, pricePos, readJson } from "@/lib/pos";
import type { PosPriced } from "@/lib/pos-types";

export async function POST(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, PosBasketBody);
  if (body instanceof NextResponse) return body;
  const client = await getClientRow();
  const r = await pricePos(body, client.id, staff.id);
  if (r.error) return r.error;
  return NextResponse.json(r.pos satisfies PosPriced);
}
