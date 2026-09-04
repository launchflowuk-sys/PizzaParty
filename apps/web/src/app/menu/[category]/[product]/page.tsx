import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, productPath } from "@/lib/menu";
import { toPicker } from "@/lib/picker";
import { breadcrumbJsonLd, pageTitle, productJsonLd } from "@/lib/seo";
import { gbpShort } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";
import { AddToBasket } from "@/components/product/AddToBasket";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ category: string; product: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category, product } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const c = menu.categories.find((x) => x.slug === category);
  const p = c?.products.find((x) => x.slug === product);
  if (!c || !p) return {};
  const min = Math.min(...p.sizes.map((s) => s.price));
  return {
    title: { absolute: pageTitle(cfg, `${p.name} — ${c.name}`) },
    description: `${p.description || p.name} ${p.sizes.length > 1 ? "from" : ""} ${gbpShort(min)}. Order online from ${cfg.name} for delivery in ${cfg.seo.locality.join(" & ")} or collection.`,
    alternates: { canonical: productPath(c, p) },
    openGraph: { images: [`/og?product=${p.slug}`] },
  };
}

export default async function ProductPage({ params }: Params) {
  const { category, product } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const c = menu.categories.find((x) => x.slug === category);
  const p = c?.products.find((x) => x.slug === product);
  if (!c || !p) notFound();
  const related = c.products.filter((x) => x.slug !== p.slug).slice(0, 4);
  return (
    <div className="lf-container max-w-2xl">
      <JsonLd data={[productJsonLd(cfg, c, p), breadcrumbJsonLd([{ name: "Menu", path: "/menu" }, { name: c.name, path: `/menu/${c.slug}` }, { name: p.name, path: productPath(c, p) }])]} />
      <nav className="pt-4 text-sm text-muted"><Link href="/menu">Menu</Link> / <Link href={`/menu/${c.slug}`}>{c.name}</Link></nav>
      {p.image ? (
        <div className="relative aspect-[4/3] mt-3 rounded-2xl overflow-hidden bg-surface-2">
          <Image src={assetUrl(p.image)} alt={p.name} fill priority sizes="(max-width: 672px) 100vw, 672px" className="object-cover" unoptimized={p.image.endsWith(".svg")} />
        </div>
      ) : null}
      <h1 className="lf-h1 mt-4">{p.name}</h1>
      {p.description ? <p className="text-muted mt-2">{p.description}</p> : null}
      <p className="mt-2 text-sm">
        {p.tags.map((t) => <span key={t} className="lf-pill bg-surface-2 mr-1 capitalize">{t}</span>)}
        {p.allergens.length ? <span className="text-muted">Contains: {p.allergens.join(", ")}. <Link href="/allergens" className="underline">Allergen info</Link></span> : null}
      </p>
      <div className="mt-6">
        <AddToBasket product={toPicker(p)} />
      </div>
      {related.length ? (
        <section className="mt-16">
          <h2 className="lf-h2">More {c.name.toLowerCase()}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id}><Link href={productPath(c, r)} className="lf-card block p-3 text-sm"><span className="font-semibold">{r.name}</span> <span className="text-muted">· {r.sizes.length > 1 ? "from " : ""}{gbpShort(Math.min(...r.sizes.map((s) => s.price)))}</span></Link></li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
