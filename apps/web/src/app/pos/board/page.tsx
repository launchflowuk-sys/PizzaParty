import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { requireScreen } from "@/lib/session";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, dealsToday, topSellers, minPrice } from "@/lib/menu";
import { liveSlots } from "@/lib/promo-slots";
import { BoardClient } from "@/components/pos/BoardClient";
import type { DisplayExtra, DisplayPromo } from "@/components/pos/PosDisplayOrder";

export const metadata: Metadata = { title: "Order status board", robots: { index: false } };
export const dynamic = "force-dynamic";

const heading = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-cd", display: "swap" });

const PROMO_COUNT = 5;
// Same count the customer display itself shows (PosDisplayOrder's EXTRAS_SHOWN) - .cd-extras
// never shrinks (flex: 0 0 auto), so more than a handful squeezes the promo hero to nothing
// in the board's shorter panel.
const EXTRAS_COUNT = 3;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Best sellers with a photo, for the "Popular extras" strip under the rotating promo. */
function extrasFrom(menu: Awaited<ReturnType<typeof getMenu>>): DisplayExtra[] {
  return topSellers(menu, 20)
    .filter((x) => x.product.image)
    .slice(0, EXTRAS_COUNT)
    .map((x) => ({ slug: x.product.slug, name: x.product.name, detail: clip(x.product.description ?? "", 40), price: minPrice(x.product), image: assetUrl(x.product.image) }));
}

/**
 * Order status board (POS-PLAN item 36) - "Now preparing / Ready to collect", for a TV
 * next to the self-service kiosk. Guarded on the kitchen screen, same as the customer
 * display: a tablet or TV facing the shop floor can be signed in with a Kitchen-role
 * PIN, which cannot open the till or its actions. Live order data comes from
 * BoardClient (GET /api/pos/board, pushed via /api/kitchen/stream). Branding and the
 * rotating promo/extras strip are this shop's own config/menu, read here once, same
 * source as the customer display's promo panel.
 */
export default async function BoardPage() {
  await requireScreen("kitchen");
  const cfg = getConfig();
  const [menu, slots] = await Promise.all([getMenu(), liveSlots().catch(() => [])]);

  const todaysDeals = dealsToday(menu.deals);
  // A wide pool before the image filter - the top few sellers by orders are not always the ones with a photo.
  const sellers = topSellers(menu, 20).filter((x) => x.product.image).slice(0, PROMO_COUNT);

  const fromSlots: DisplayPromo[] = slots.slice(0, PROMO_COUNT).map((s) => ({ headline: s.title, subline: s.subtitle, price: s.price, image: s.imageUrl }));
  const fromDeals: DisplayPromo[] = todaysDeals.map((d) => ({ headline: d.name, subline: "Today's deal", price: d.price, image: d.image ? assetUrl(d.image) : "" })).filter((p) => p.image);
  const fromSellers: DisplayPromo[] = sellers.map((x) => ({ headline: x.product.name, subline: "Our most popular", price: minPrice(x.product), image: assetUrl(x.product.image) }));
  const promos = [...fromSlots, ...fromDeals, ...fromSellers].slice(0, PROMO_COUNT);

  return (
    <div className={heading.variable}>
      <BoardClient
        shopName={cfg.name}
        logoUrl={cfg.brand.logo ? assetUrl(cfg.brand.logo) : ""}
        tagline={cfg.brand.tagline}
        promos={promos}
        extras={extrasFrom(menu)}
        loyaltyName={cfg.loyalty.enabled ? cfg.loyalty.name : ""}
      />
    </div>
  );
}
