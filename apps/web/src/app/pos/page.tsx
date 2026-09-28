import type { Metadata } from "next";
import { requireScreen } from "@/lib/session";
import { getMenu } from "@/lib/menu";
import { posCategories, posDeals } from "@/lib/pos-catalogue";
import { getConfig, assetUrl } from "@/lib/config";
import { PosScreen } from "@/components/pos/PosScreen";

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
  const cfg = getConfig();

  const menu = await getMenu();
  const categories = posCategories(menu);
  const deals = posDeals(menu);

  return <PosScreen staffName={staff.name} staffRole={staff.role} categories={categories} deals={deals} logoUrl={cfg.brand.logo ? assetUrl(cfg.brand.logo) : ""} />;
}
