import "server-only";
import { dealsToday, type Menu } from "./menu";
import { toPicker } from "./picker";
import { assetUrl } from "./config";
import type { PosCategory, PosDeal } from "@/components/pos/pos-client-types";

/** The menu as the till and the kiosk pick from it: categories of priced products, with photos. */
export function posCategories(menu: Menu): PosCategory[] {
  return menu.categories.map((c) => ({
    key: c.slug,
    name: c.name,
    products: c.products.map((p) => ({ ...toPicker(p), minPrice: Math.min(...p.sizes.map((s) => s.price)), categoryKey: c.slug, image: p.image ? assetUrl(p.image) : undefined })),
  }));
}

/** Today's deals with each slot resolved to its products - the same resolution as the customer-facing /deals/[deal] page. */
export function posDeals(menu: Menu): PosDeal[] {
  const all = menu.categories.flatMap((c) => c.products.map((p) => ({ p, c })));
  return dealsToday(menu.deals).map((d) => ({
    slug: d.slug,
    name: d.name,
    price: d.price,
    description: d.description,
    image: d.image ? assetUrl(d.image) : undefined,
    slots: d.slots.map((s) => ({
      name: s.name,
      qty: s.qty,
      sizeKeys: s.sizeKeys,
      options: all
        .filter(({ p, c }) => (s.productSlugs.length ? s.productSlugs.includes(p.slug) : true) && (s.categorySlugs.length ? s.categorySlugs.includes(c.slug) : true))
        .filter(({ p }) => !s.sizeKeys.length || p.sizes.some((z) => s.sizeKeys.includes(z.key)))
        .map(({ p }) => ({ ...toPicker(p), extra: s.supplements.find((x) => x.productSlug === p.slug)?.extra ?? 0, image: p.image ? assetUrl(p.image) : undefined })),
    })),
  }));
}
