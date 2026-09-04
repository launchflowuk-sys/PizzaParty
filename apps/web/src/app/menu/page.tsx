import type { Metadata } from "next";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, productPath } from "@/lib/menu";
import { menuJsonLd, pageTitle } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { MenuBrowser, type TileCategory, type TileItem } from "@/components/menu/MenuBrowser";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  return {
    title: { absolute: pageTitle(cfg, "Menu") },
    description: `Full ${cfg.name} menu with prices. Order ${cfg.seo.cuisine.toLowerCase()} online for delivery or collection in ${cfg.seo.locality.join(" & ")}.`,
    alternates: { canonical: "/menu" },
  };
}

export default async function MenuPage() {
  const cfg = getConfig();
  const menu = await getMenu();

  const categories: TileCategory[] = menu.categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    count: c.products.length,
  }));

  const items: TileItem[] = menu.categories.flatMap((c) =>
    c.products.map((p) => {
      const prices = p.sizes.map((s) => s.price);
      const from = prices.length ? Math.min(...prices) : 0;
      // A group with minSelect > 0 must be answered, so the product cannot be
      // added to the basket without opening it first.
      const needsChoice = p.modifierGroups.some((g) => g.group.minSelect > 0) || p.sizes.length > 1;
      return {
        slug: p.slug,
        categorySlug: c.slug,
        name: p.name,
        description: p.description,
        href: productPath(c, p),
        image: assetUrl(p.image),
        tags: p.tags,
        soldOut: p.soldOut,
        fromPrice: from,
        sizeNote: p.sizes.length > 1 ? `${p.sizes.length} sizes from ${p.sizes[0]?.name ?? ""}` : (p.sizes[0]?.name ?? ""),
        firstSizeKey: p.sizes[0]?.key ?? "",
        needsChoice,
      };
    }),
  );

  return (
    <>
      {/* The browser filters client-side like the prototype, so the complete menu is
          published here for search engines regardless of what is on screen. */}
      <JsonLd data={menuJsonLd(cfg, menu)} />
      <MenuBrowser categories={categories} items={items} />
    </>
  );
}
