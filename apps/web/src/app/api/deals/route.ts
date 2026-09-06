import { NextResponse } from "next/server";
import { dealsToday, getMenu } from "@/lib/menu";
import { absoluteAssetUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Tonight's deals, with everything a native deal builder needs.
 *
 * Filtered through `dealsToday` rather than returning every active deal. A
 * Tuesday-only deal is still `active` on a Friday - the day restriction is
 * enforced at checkout - so an app listing raw active deals would advertise
 * something all week that pricing then refuses. The web made exactly that
 * mistake until it was fixed.
 *
 * Slots carry their allow-lists as slugs (categories, products, sizes) rather
 * than embedded product objects, so the payload stays small and the app
 * resolves them against the menu it already has.
 */
export async function GET() {
  const menu = await getMenu();
  const deals = dealsToday(menu.deals);

  return NextResponse.json({
    deals: deals.map((d) => ({
      slug: d.slug,
      name: d.name,
      description: d.description || "",
      image: d.image ? absoluteAssetUrl(d.image) : null,
      price: d.price,
      featured: d.featured,
      // Empty means every day / any fulfilment. Sent through so the app can
      // show "Tuesdays only" rather than a deal that silently vanishes.
      daysOfWeek: d.daysOfWeek,
      fulfilment: d.fulfilment,
      slots: d.slots.map((s) => ({
        id: s.id,
        name: s.name,
        qty: s.qty,
        categorySlugs: s.categorySlugs,
        productSlugs: s.productSlugs,
        sizeKeys: s.sizeKeys,
        /** Whether modifiers chosen inside this slot are charged on top. */
        extraPerModifier: s.extraPerModifier,
        /** Premium items that add to the deal price when picked for this line. */
        supplements: s.supplements.map((x) => ({ productSlug: x.productSlug, extra: x.extra })),
      })),
    })),
  }, {
    headers: { "cache-control": "public, max-age=60" },
  });
}
