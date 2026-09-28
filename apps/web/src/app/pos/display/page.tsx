import type { Metadata } from "next";
import { requireScreen } from "@/lib/session";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, dealsToday, topSellers } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { PosDisplayClient } from "@/components/pos/PosDisplayClient";

export const metadata: Metadata = { title: "Customer display", robots: { index: false } };
export const dynamic = "force-dynamic";

const HERO_COUNT = 6;

/**
 * Second-screen customer display (POS-PLAN item 29). Staff open it from the
 * till's TopBar ("Open customer display") and drag it to the customer-facing
 * monitor. Its live state (basket/paying/paid) arrives over BroadcastChannel
 * from whichever till window is open; everything else - branding, the idle
 * hero rotation, the promo line - is read from config/menu here once, same
 * as the till page does, since this is its own server component.
 */
export default async function PosDisplayPage() {
  await requireScreen("pos");
  const cfg = getConfig();
  const menu = await getMenu();

  const heroImages = topSellers(menu, HERO_COUNT)
    .filter((x) => x.product.image)
    .map((x) => ({ src: assetUrl(x.product.image), alt: x.product.name }));

  const todaysDeal = dealsToday(menu.deals)[0];
  const promoLine = todaysDeal ? `${todaysDeal.name} — ${gbp(todaysDeal.price)}` : cfg.brand.tagline || "Welcome";

  return (
    <PosDisplayClient
      shopName={cfg.name}
      logoUrl={cfg.brand.logo ? assetUrl(cfg.brand.logo) : ""}
      promoLine={promoLine}
      heroImages={heroImages}
    />
  );
}
