import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getConfig } from "@/lib/config";
import { getMenu } from "@/lib/menu";
import { toPicker } from "@/lib/picker";
import { abs, breadcrumbJsonLd, pageTitle } from "@/lib/seo";
import { gbpShort } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";
import { DealBuilder, type BuilderDeal } from "@/components/deals/DealBuilder";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ deal: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { deal } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const d = menu.deals.find((x) => x.slug === deal);
  if (!d) return {};
  return { title: { absolute: pageTitle(cfg, `${d.name} deal · ${gbpShort(d.price)}`) }, description: `${d.description} Order the ${d.name} from ${cfg.name} online.`, alternates: { canonical: `/deals/${d.slug}` } };
}

export default async function DealPage({ params }: Params) {
  const { deal } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const d = menu.deals.find((x) => x.slug === deal);
  if (!d) notFound();
  const all = menu.categories.flatMap((c) => c.products.map((p) => ({ p, c })));
  const builder: BuilderDeal = {
    slug: d.slug, name: d.name, price: d.price,
    slots: d.slots.map((s) => ({
      name: s.name, qty: s.qty, sizeKeys: s.sizeKeys,
      options: all
        .filter(({ p, c }) => (s.productSlugs.length ? s.productSlugs.includes(p.slug) : true) && (s.categorySlugs.length ? s.categorySlugs.includes(c.slug) : true))
        .filter(({ p }) => !s.sizeKeys.length || p.sizes.some((z) => s.sizeKeys.includes(z.key)))
        .map(({ p }) => toPicker(p)),
    })),
  };
  const jsonld = {
    "@context": "https://schema.org", "@type": "Offer", name: d.name, description: d.description, url: abs(`/deals/${d.slug}`),
    price: (d.price / 100).toFixed(2), priceCurrency: "GBP", availability: "https://schema.org/InStock", seller: { "@type": "Restaurant", name: cfg.name },
  };
  return (
    <div className="lf-container max-w-2xl">
      <JsonLd data={[jsonld, breadcrumbJsonLd([{ name: "Deals", path: "/deals" }, { name: d.name, path: `/deals/${d.slug}` }])]} />
      <nav className="pt-4 text-sm text-muted"><Link href="/deals">Deals</Link> / {d.name}</nav>
      <h1 className="lf-h1 mt-2">{d.name} <span className="text-brand">{gbpShort(d.price)}</span></h1>
      <p className="text-muted mt-2">{d.description}</p>
      <div className="mt-6"><DealBuilder deal={builder} /></div>
    </div>
  );
}
