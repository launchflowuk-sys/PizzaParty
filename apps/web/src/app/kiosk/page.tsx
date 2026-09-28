import type { Metadata, Viewport } from "next";
import { Kaushan_Script, Poppins } from "next/font/google";
import { requireRole, requireScreen } from "@/lib/session";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, dealsToday, topSellers, minPrice, type Menu } from "@/lib/menu";
import { liveSlots } from "@/lib/promo-slots";
import { stripeServerEnabled } from "@/lib/stripe";
import { posCategories, posDeals } from "@/lib/pos-catalogue";
import { kioskFulfilments } from "@/lib/kiosk-rules";
import { KioskClient } from "@/components/kiosk/KioskClient";
import type { KioskSlide, KioskUpsell } from "@/components/kiosk/kiosk-types";

export const metadata: Metadata = { title: "Order here", robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#ffffff" };
export const dynamic = "force-dynamic";

/* The customer display's faces, so the kiosk and the display read as one system. */
const heading = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-cd", display: "swap" });
const script = Kaushan_Script({ subsets: ["latin"], weight: ["400"], variable: "--font-cd-script", display: "swap" });

const POPULAR = 8;
const SLIDES_MAX = 6;

/** Attract-loop slides: the shop's live promo slots, then today's deals, then best sellers - all with a photo. */
function slidesFrom(menu: Menu, slots: Awaited<ReturnType<typeof liveSlots>>): KioskSlide[] {
  const fromSlots: KioskSlide[] = slots.filter((s) => s.imageUrl).map((s) => ({ kicker: "Special offer", headline: s.title, subline: s.subtitle, price: s.price, image: s.imageUrl }));
  const fromDeals: KioskSlide[] = dealsToday(menu.deals).filter((d) => d.image).map((d) => ({ kicker: "Today's deal", headline: d.name, subline: d.description, price: d.price, image: assetUrl(d.image) }));
  const fromSellers: KioskSlide[] = topSellers(menu, SLIDES_MAX).filter((x) => x.product.image).map((x) => ({
    kicker: "Our most popular", headline: x.product.name, subline: x.product.description ?? "", price: minPrice(x.product), image: assetUrl(x.product.image), from: x.product.sizes.length > 1,
  }));
  const seen = new Set<string>();
  return [...fromSlots, ...fromDeals, ...fromSellers].filter((s) => !seen.has(s.image) && seen.add(s.image)).slice(0, SLIDES_MAX);
}

/** "Make it a meal?" candidates: best sellers with a photo, in selling order; the client picks three outside what was just added. */
function upsellFrom(menu: Menu): KioskUpsell[] {
  const photos = new Set<string>(); // never the same photo twice in one row of suggestions
  return topSellers(menu, 500).filter((x) => x.product.image && !photos.has(x.product.image) && photos.add(x.product.image)).map((x) => ({
    slug: x.product.slug, category: x.category.slug, name: x.product.name, detail: x.product.description ?? "", price: minPrice(x.product), image: assetUrl(x.product.image),
  }));
}

/** The mains: the category of the best seller you build (sizes or options) - pizzas, not chips. A deal's upsell skips it. */
function mainsOf(menu: Menu): string {
  const built = topSellers(menu, 100).find((x) => x.product.sizes.length > 1 || x.product.modifierGroups.length > 0);
  return built?.category.slug ?? "";
}

/**
 * Self-service ordering kiosk (POS-PLAN item 35). A landscape tablet or screen at the
 * counter, signed in once with a Kiosk-role PIN (a manager can open it too). All of
 * it is this shop's own config and menu: logo, colours, offers, photos, prices.
 */
export default async function KioskPage() {
  await requireScreen("kiosk");
  // The reader a manager assigned this kiosk: in its signed cookie, set by /api/kiosk/unlock.
  const reader = (await requireRole("admin"))?.rd ?? "";
  const cfg = getConfig();
  const [menu, slots] = await Promise.all([getMenu(), liveSlots().catch(() => [])]);
  const top = topSellers(menu, POPULAR);

  return (
    <div className={`${heading.variable} ${script.variable}`}>
      <KioskClient
        brand={{ shopName: cfg.name, logoUrl: cfg.brand.logo ? assetUrl(cfg.brand.logo) : "", tagline: cfg.brand.tagline }}
        fulfilments={kioskFulfilments({ eatIn: cfg.pos.eatIn, fulfilment: cfg.fulfilment })}
        shopPayments={{ card: cfg.pos.kiosk.card && stripeServerEnabled(), counter: cfg.pos.kiosk.payAtCounter }}
        categories={posCategories(menu).filter((c) => c.products.length)}
        deals={posDeals(menu)}
        popular={top.map((x) => x.product.slug)}
        mainsCategory={mainsOf(menu)}
        slides={slidesFrom(menu, slots)}
        upsell={upsellFrom(menu)}
        loyaltyName={cfg.loyalty.enabled ? cfg.loyalty.name : ""}
        reader={reader}
      />
    </div>
  );
}
