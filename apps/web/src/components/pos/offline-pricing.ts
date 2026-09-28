/**
 * Offline pricing (POS-PLAN item 30). While the till cannot reach the server,
 * prices are computed here instead: size price + modifier prices for a
 * product line, deal fixed price + slot supplements for a deal line. No
 * promo codes, no delivery fee, no manager discount - offline orders are
 * cash/pay-later Collection or Eat-in only, so none of those apply.
 *
 * Pure, no React import - so it can be unit tested directly
 * (scripts/tests/pos-offline-pricing.test.ts) and used from a plain module.
 */
import type { BasketLine, BasketModifier } from "@/lib/basket-types";
import type { PosCategory, PosDeal, PosProduct } from "./pos-client-types";

export type OfflinePricedLine = { key: string; name: string; detail: string; qty: number; unitPrice: number; lineTotal: number };
export type OfflinePriced = { lines: OfflinePricedLine[]; subtotal: number; total: number };

function productUnitPrice(product: PosProduct, sizeKey: string | undefined, modifiers: BasketModifier[]): number {
  const size = product.sizes.find((s) => s.key === sizeKey) ?? product.sizes[0];
  let price = size?.price ?? 0;
  for (const mod of modifiers) {
    const group = product.groups.find((g) => g.key === mod.group);
    const chosen = group?.modifiers.find((m) => m.key === mod.modifier);
    if (chosen) price += chosen.price;
  }
  return price;
}

export function priceOffline(lines: BasketLine[], categories: PosCategory[], deals: PosDeal[]): OfflinePriced {
  const allProducts = categories.flatMap((c) => c.products);
  const priced: OfflinePricedLine[] = lines.map((line) => {
    if (line.kind === "deal") {
      const deal = deals.find((d) => d.slug === line.deal);
      let unitPrice = deal?.price ?? line.unitPrice ?? 0;
      for (const comp of line.components ?? []) {
        const slot = deal?.slots[comp.slot];
        const option = slot?.options.find((o) => o.slug === comp.product);
        if (option?.extra) unitPrice += option.extra;
      }
      return { key: line.key, name: line.name ?? deal?.name ?? "Deal", detail: line.detail ?? "", qty: line.qty, unitPrice, lineTotal: unitPrice * line.qty };
    }
    const product = allProducts.find((p) => p.slug === line.product);
    const unitPrice = product ? productUnitPrice(product, line.size, line.modifiers ?? []) : (line.unitPrice ?? 0);
    return { key: line.key, name: line.name ?? product?.name ?? "Item", detail: line.detail ?? "", qty: line.qty, unitPrice, lineTotal: unitPrice * line.qty };
  });
  const subtotal = priced.reduce((sum, l) => sum + l.lineTotal, 0);
  return { lines: priced, subtotal, total: subtotal };
}
