import type { Metadata } from "next";
import { Kaushan_Script, Poppins } from "next/font/google";
import { requireScreen } from "@/lib/session";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, dealsToday, topSellers, minPrice, type Menu } from "@/lib/menu";
import { liveSlots } from "@/lib/promo-slots";
import { stripeServerEnabled } from "@/lib/stripe";
import { gbp } from "@/lib/money";
import { PosDisplayClient } from "@/components/pos/PosDisplayClient";
import type { DisplayExtra, DisplayOrderType, DisplayPromo } from "@/components/pos/PosDisplayOrder";

export const metadata: Metadata = { title: "Customer display", robots: { index: false } };
export const dynamic = "force-dynamic";

/* The customer display's own faces: a bold sans for the order, a script for the promo headline. */
const heading = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-cd", display: "swap" });
const script = Kaushan_Script({ subsets: ["latin"], weight: ["400"], variable: "--font-cd-script", display: "swap" });

const HERO_COUNT = 6;
const EXTRAS_COUNT = 10; // the client drops what is already in the basket and shows three, plus "Add a side?"
const DESCRIPTION_MAX = 90;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * "Popular extras": best sellers with a photo from outside the best seller's own
 * category (the mains), so the list offers wings and desserts, not a second pizza.
 */
function extrasFrom(menu: Menu): DisplayExtra[] {
  const all = topSellers(menu, 500).filter((x) => x.product.image);
  const mains = all[0]?.category.slug;
  const pool = all.filter((x) => x.category.slug !== mains);
  // One per category first (wings, a dessert, a side - not three boxes), never the same photo twice.
  const seen = new Set<string>();
  const firstOfEach = pool.filter((x) => !seen.has(x.category.slug) && seen.add(x.category.slug));
  const photos = new Set<string>();
  const pick = [...firstOfEach, ...pool.filter((x) => !firstOfEach.includes(x))].filter((x) => !photos.has(x.product.image) && photos.add(x.product.image));
  return (pick.length >= 3 ? pick : all).slice(0, EXTRAS_COUNT).map((x) => ({
    slug: x.product.slug, name: x.product.name, detail: clip(x.product.description ?? "", 40), price: minPrice(x.product), image: assetUrl(x.product.image),
  }));
}

/**
 * Customer display (POS-PLAN item 29), on a second monitor or any tablet. Live
 * state (basket/paying/paid) arrives from a till - BroadcastChannel from the same
 * browser, or the server relay from any other device (PosDisplayClient pairs with
 * one). Everything else is this shop's own config and menu, read here once:
 * branding, order types offered, payment methods, the promo (a live promo slot,
 * else today's deal), popular extras and product descriptions.
 *
 * Guarded on the kitchen screen, not the till: a tablet facing customers can be
 * signed in with a Kitchen-role PIN, which cannot open the till or its actions.
 * Every role that can use the till can also open the kitchen screen.
 */
export default async function PosDisplayPage() {
  await requireScreen("kitchen");
  const cfg = getConfig();
  const [menu, slots] = await Promise.all([getMenu(), liveSlots().catch(() => [])]);

  const sellers = topSellers(menu, HERO_COUNT * 2).filter((x) => x.product.image);
  const heroImages = sellers.slice(0, HERO_COUNT).map((x) => ({ src: assetUrl(x.product.image), alt: x.product.name }));
  const descriptions: Record<string, string> = {};
  for (const c of menu.categories) for (const p of c.products) if (p.description) descriptions[p.slug] = clip(p.description, DESCRIPTION_MAX);

  const todaysDeal = dealsToday(menu.deals)[0];
  const promoLine = todaysDeal ? `${todaysDeal.name} — ${gbp(todaysDeal.price)}` : cfg.brand.tagline || "Welcome";
  const slot = slots[0];
  const promo: DisplayPromo | null = slot
    ? { headline: slot.title, subline: slot.subtitle, price: slot.price, image: slot.imageUrl }
    : todaysDeal
      ? { headline: todaysDeal.name, subline: "Today's deal", price: todaysDeal.price, image: todaysDeal.image ? assetUrl(todaysDeal.image) : heroImages[0]?.src ?? "" }
      : heroImages[0]
        ? { headline: heroImages[0].alt, subline: "Our most popular", price: sellers[0] ? minPrice(sellers[0].product) : null, image: heroImages[0].src }
        : null;

  const orderTypes: DisplayOrderType[] = [
    ...(cfg.pos.eatIn ? (["eat_in"] as const) : []),
    ...(cfg.fulfilment.includes("collection") ? (["collection"] as const) : []),
    ...(cfg.fulfilment.includes("delivery") ? (["delivery"] as const) : []),
  ];

  return (
    <div className={`${heading.variable} ${script.variable}`}>
      <PosDisplayClient
        shopName={cfg.name}
        logoUrl={cfg.brand.logo ? assetUrl(cfg.brand.logo) : ""}
        tagline={cfg.brand.tagline}
        promoLine={promoLine}
        heroImages={heroImages}
        promo={promo}
        extras={extrasFrom(menu)}
        descriptions={descriptions}
        orderTypes={orderTypes}
        // The till always takes cash; card (and the wallets a contactless reader takes) needs Stripe.
        cardAccepted={stripeServerEnabled()}
        loyaltyName={cfg.loyalty.enabled ? cfg.loyalty.name : ""}
      />
    </div>
  );
}
