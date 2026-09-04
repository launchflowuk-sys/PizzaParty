import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getMenu } from "@/lib/menu";
import { priceBasket } from "@/lib/pricing";
import type { BasketLine } from "@/lib/basket-types";

/** Rebuild a basket from a past order's stored lines, re-validated against today's menu and prices. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const items = await prisma.orderItem.findMany({ where: { orderId: id, parentId: null }, select: { line: true } });
  if (!items.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lines = items.map((i) => i.line as unknown as BasketLine | null).filter((l): l is BasketLine => !!l && typeof l === "object").map((l, i) => ({ ...l, key: `r${i}${Math.random().toString(36).slice(2, 6)}` }));
  const menu = await getMenu();
  const priced = priceBasket(menu, lines, { fulfilment: "collection", deliveryFee: 0, minOrder: 0 });
  const keep = lines.filter((l) => !priced.removedKeys.includes(l.key)).map((l) => {
    const p = priced.lines.find((x) => x.key === l.key)!;
    return { ...l, name: p.name, detail: p.detail, unitPrice: p.unitPrice, lineTotal: p.lineTotal };
  });
  return NextResponse.json({ lines: keep, errors: priced.errors });
}
