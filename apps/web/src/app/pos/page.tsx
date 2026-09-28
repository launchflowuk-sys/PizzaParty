import type { Metadata } from "next";
import { requireScreen } from "@/lib/session";
import { getMenu, dealsToday } from "@/lib/menu";
import { toPicker } from "@/lib/picker";
import { PosScreen } from "@/components/pos/PosScreen";
import type { PosCategory, PosDeal } from "@/components/pos/pos-client-types";

export const metadata: Metadata = { title: "Till", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The staff till. Full-screen, no storefront chrome (a Haiku agent strips that
 * in app/layout.tsx once "pos" is a real screen).
 *
 * "pos" is not in lib/permissions.ts's Screen union yet - another agent is adding
 * it there, in parallel, against the same plan. Written against the contract now
 * rather than blocked on it: the cast comes off the day that lands.
 */
export default async function PosPage() {
  const staff = await requireScreen("pos");

  const menu = await getMenu();
  const categories: PosCategory[] = menu.categories.map((c) => ({
    key: c.slug,
    name: c.name,
    products: c.products.map((p) => ({ ...toPicker(p), minPrice: Math.min(...p.sizes.map((s) => s.price)), categoryKey: c.slug })),
  }));

  // Same slot-to-product resolution as the customer-facing /deals/[deal] page.
  const all = menu.categories.flatMap((c) => c.products.map((p) => ({ p, c })));
  const deals: PosDeal[] = dealsToday(menu.deals).map((d) => ({
    slug: d.slug,
    name: d.name,
    price: d.price,
    description: d.description,
    slots: d.slots.map((s) => ({
      name: s.name,
      qty: s.qty,
      sizeKeys: s.sizeKeys,
      options: all
        .filter(({ p, c }) => (s.productSlugs.length ? s.productSlugs.includes(p.slug) : true) && (s.categorySlugs.length ? s.categorySlugs.includes(c.slug) : true))
        .filter(({ p }) => !s.sizeKeys.length || p.sizes.some((z) => s.sizeKeys.includes(z.key)))
        .map(({ p }) => ({ ...toPicker(p), extra: s.supplements.find((x) => x.productSlug === p.slug)?.extra ?? 0 })),
    })),
  }));

  return <PosScreen staffName={staff.name} categories={categories} deals={deals} />;
}
