/** How an order leaves the shop, in words. No server imports: the print pages, emails and tests share it. */
import type { Fulfilment } from "./basket-types";
import { isMarketplaceSource, MARKETPLACE_NAME } from "./pos-phase4-types";

type Shape = { fulfilment: string; tableNumber?: string | null; source?: string; courier?: string | null };

/** "DELIVERY", "COLLECTION", "EAT IN · Table 4", "DELIVEROO · RIDER COLLECTS", "JUST EAT · DELIVERY". */
export function fulfilmentLabel(o: Shape): string {
  if (o.fulfilment === "eat_in") return o.tableNumber ? `EAT IN · Table ${o.tableNumber}` : "EAT IN";
  const base = o.fulfilment === "delivery" ? "DELIVERY" : "COLLECTION";
  if (!o.source || !isMarketplaceSource(o.source)) return base;
  return `${MARKETPLACE_NAME[o.source].toUpperCase()} · ${o.courier === "marketplace" ? "RIDER COLLECTS" : base}`;
}

/** Eat-in is priced like collection: no delivery fee, no delivery minimum. */
export const pricedAs = (f: string): Fulfilment => (f === "delivery" ? "delivery" : "collection");
