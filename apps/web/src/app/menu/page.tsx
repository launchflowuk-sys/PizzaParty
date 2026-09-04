import type { Metadata } from "next";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, productPath } from "@/lib/menu";
import { menuJsonLd, pageTitle } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { CategoryChips } from "@/components/CategoryChips";
import { ProductCard } from "@/components/ProductCard";
import Link from "next/link";
import { gbpShort } from "@/lib/money";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  return { title: { absolute: pageTitle(cfg, "Menu") }, description: `Full ${cfg.name} menu with prices. Order ${cfg.seo.cuisine.toLowerCase()} online for delivery or collection in ${cfg.seo.locality.join(" & ")}.`, alternates: { canonical: "/menu" } };
}

export default async function MenuPage() {
  const cfg = getConfig();
  const menu = await getMenu();
  return (
    <div className="lf-container">
      <JsonLd data={menuJsonLd(cfg, menu)} />
      <h1 className="lf-h1 pt-6">Menu</h1>
      <CategoryChips categories={menu.categories} anchor />
      {menu.deals.length ? (
        <section className="mt-6">
          <h2 className="lf-h2" id="deals">Deals</h2>
          <div className="grid gap-3 mt-3 sm:grid-cols-2">
            {menu.deals.map((d) => (
              <Link key={d.id} href={`/deals/${d.slug}`} className="lf-card p-4 border-l-4 border-brand">
                <p className="font-bold">{d.name} · {gbpShort(d.price)}</p>
                <p className="text-sm text-muted mt-1">{d.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {menu.categories.map((c) => (
        <section key={c.id} id={c.slug} className="mt-10 scroll-mt-28">
          <h2 className="lf-h2"><Link href={`/menu/${c.slug}`}>{c.name}</Link></h2>
          {c.description ? <p className="text-muted mt-1">{c.description}</p> : null}
          <div className="grid gap-3 mt-4 sm:grid-cols-2">
            {c.products.map((p) => <ProductCard key={p.id} product={p} href={productPath(c, p)} image={assetUrl(p.image)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
