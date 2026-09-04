import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, productPath } from "@/lib/menu";
import { breadcrumbJsonLd, menuSectionJsonLd, pageTitle } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { CategoryChips } from "@/components/CategoryChips";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const c = menu.categories.find((x) => x.slug === category);
  if (!c) return {};
  return {
    title: { absolute: pageTitle(cfg, `${c.name} in ${cfg.seo.locality.join(" & ")}`) },
    description: c.description || `Order ${c.name.toLowerCase()} from ${cfg.name} for delivery or collection. ${c.products.length} items from ${cfg.seo.locality[0]}.`,
    alternates: { canonical: `/menu/${c.slug}` },
  };
}

export default async function CategoryPage({ params }: Params) {
  const { category } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const c = menu.categories.find((x) => x.slug === category);
  if (!c) notFound();
  return (
    <div className="lf-container">
      <JsonLd data={[{ "@context": "https://schema.org", ...menuSectionJsonLd(c) }, breadcrumbJsonLd([{ name: "Menu", path: "/menu" }, { name: c.name, path: `/menu/${c.slug}` }])]} />
      <nav className="pt-4 text-sm text-muted"><Link href="/menu">Menu</Link> / {c.name}</nav>
      <h1 className="lf-h1 mt-2">{c.name}</h1>
      {c.description ? <p className="text-muted mt-2 max-w-prose">{c.description}</p> : null}
      <CategoryChips categories={menu.categories} active={c.slug} />
      <div className="grid gap-3 mt-4 sm:grid-cols-2">
        {c.products.map((p) => <ProductCard key={p.id} product={p} href={productPath(c, p)} image={assetUrl(p.image)} />)}
      </div>
      <p className="mt-10 text-sm text-muted">{c.products.length} {c.name.toLowerCase()} available for delivery in {cfg.seo.locality.join(" and ")} and collection from {cfg.name}.</p>
    </div>
  );
}
