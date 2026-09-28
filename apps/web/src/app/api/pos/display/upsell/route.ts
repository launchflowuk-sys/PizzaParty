import { NextResponse, type NextRequest } from "next/server";
import { findProduct, getMenu } from "@/lib/menu";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";
import { assetUrl } from "@/lib/config";
import { rankUpsell, type UpsellBasketItem, type UpsellCandidate } from "@/lib/pos-display-requests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SLUGS = 60;
const DETAIL_MAX = 40;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * GET ?slugs=a,b → { items: DisplayExtra[] }: the one-tap add-ons the customer
 * display offers for this basket (POS-PLAN item 29), ranked by rankUpsell. Only
 * simple, in-stock products (one size, no options) - the same rule the request
 * route enforces on an add. Photos only, when there are enough of them.
 */
export async function GET(req: NextRequest) {
  if (!(await kitchenOrAdmin(req))) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const slugs = (req.nextUrl.searchParams.get("slugs") ?? "").split(",").filter((s) => /^[a-z0-9-]{1,120}$/.test(s)).slice(0, MAX_SLUGS);
  const menu = await getMenu();

  const basket: UpsellBasketItem[] = slugs.flatMap((slug) => {
    const hit = findProduct(menu, slug);
    return hit ? [{ slug, category: hit.category.slug, categoryName: hit.category.name, name: hit.product.name }] : [];
  });
  const all = menu.categories.flatMap((cat) => cat.products
    .filter((p) => !p.soldOut && p.sizes.length === 1 && p.modifierGroups.length === 0)
    .map((p) => ({
      slug: p.slug, name: p.name, category: cat.slug, categoryName: cat.name, price: p.sizes[0]!.price,
      featured: p.featured, ordersCount: p.ordersCount, image: p.image ? assetUrl(p.image) : "", detail: clip(p.description ?? "", DETAIL_MAX),
    }) satisfies UpsellCandidate & { image: string; detail: string }));
  const withPhoto = all.filter((p) => p.image);
  const items = rankUpsell(withPhoto.length >= 6 ? withPhoto : all, basket)
    .map(({ slug, name, detail, price, image }) => ({ slug, name, detail, price, image }));
  return NextResponse.json({ items }, { headers: { "cache-control": "no-store" } });
}
