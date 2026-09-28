import { NextResponse, type NextRequest } from "next/server";
import { readJson } from "@/lib/pos";
import { KioskBasket, kioskGuard, kioskLimit, priceKiosk } from "@/lib/kiosk";
import type { KioskPriced } from "@/lib/kiosk-rules";

/** The server's price for the kiosk basket: sold-out items, deal rules and totals as the website would charge. */
export async function POST(req: NextRequest) {
  const staff = await kioskGuard(req);
  if (staff instanceof NextResponse) return staff;
  const limited = kioskLimit(req, staff, "price");
  if (limited) return limited;
  const body = await readJson(req, KioskBasket);
  if (body instanceof NextResponse) return body;
  const { priced } = await priceKiosk(body);
  const out: KioskPriced = {
    lines: priced.lines.map((l) => ({ key: l.key, name: l.name, detail: l.detail, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
    subtotal: priced.subtotal, discount: priced.discount, total: priced.total, errors: priced.errors, removedKeys: priced.removedKeys,
  };
  return NextResponse.json(out);
}
