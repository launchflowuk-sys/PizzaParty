import type { Metadata } from "next";
import { requireScreen } from "@/lib/session";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, dealsToday, topSellers, minPrice } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { PosDisplayClient } from "@/components/pos/PosDisplayClient";

export const metadata: Metadata = { title: "Customer display", robots: { index: false } };
export const dynamic = "force-dynamic";

const HERO_COUNT = 6;
const UPSELL_COUNT = 12; // the client drops what is already in the basket and shows up to four

/**
 * Customer display (POS-PLAN item 29), on a second monitor or any tablet. Live
 * state (basket/paying/paid) arrives from a till - BroadcastChannel from the same
 * browser, or the server relay from any other device (PosDisplayClient pairs with
 * one). Branding, the hero rotation, the upsell cards and today's deal are read
 * from config/menu here once.
 *
 * Guarded on the kitchen screen, not the till: a tablet facing customers can be
 * signed in with a Kitchen-role PIN, which cannot open the till or its actions.
 * Every role that can use the till can also open the kitchen screen.
 */
export default async function PosDisplayPage() {
  await requireScreen("kitchen");
  const cfg = getConfig();
  const menu = await getMenu();

  const sellers = topSellers(menu, UPSELL_COUNT).filter((x) => x.product.image);
  const heroImages = sellers.slice(0, HERO_COUNT).map((x) => ({ src: assetUrl(x.product.image), alt: x.product.name }));
  const upsell = sellers.map((x) => ({ slug: x.product.slug, name: x.product.name, fromPrice: minPrice(x.product), image: assetUrl(x.product.image) }));

  const todaysDeal = dealsToday(menu.deals)[0];
  const promoLine = todaysDeal ? `${todaysDeal.name} — ${gbp(todaysDeal.price)}` : cfg.brand.tagline || "Welcome";
  const deal = todaysDeal
    ? { name: todaysDeal.name, price: todaysDeal.price, image: todaysDeal.image ? assetUrl(todaysDeal.image) : heroImages[0]?.src ?? "" }
    : null;

  return (
    <PosDisplayClient
      shopName={cfg.name}
      logoUrl={cfg.brand.logo ? assetUrl(cfg.brand.logo) : ""}
      tagline={cfg.brand.tagline}
      promoLine={promoLine}
      heroImages={heroImages}
      upsell={upsell}
      deal={deal}
      loyaltyLine={cfg.loyalty.enabled ? `Collect points with ${cfg.loyalty.name}` : ""}
    />
  );
}
