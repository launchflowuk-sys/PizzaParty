import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { getConfig, assetUrl, localityPath } from "@/lib/config";
import { getMenu, getLocations, topSellers, productPath } from "@/lib/menu";
import { availability } from "@/lib/availability";
import { restaurantJsonLd } from "@/lib/seo";
import { gbpShort } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";
import { OpenPill } from "@/components/OpenPill";
import { PostcodeCheck } from "@/components/PostcodeCheck";
import { ProductCard } from "@/components/ProductCard";
import { CategoryChips } from "@/components/CategoryChips";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cfg = getConfig();
  const [menu, locations, jar] = await Promise.all([getMenu(), getLocations(), cookies()]);
  const primary = locations[0];
  const avail = primary ? availability(primary) : null;
  const deal = menu.deals.find((d) => d.featured) ?? menu.deals[0];
  const sellers = topSellers(menu, 6);
  const lastPostcode = jar.get("lf_postcode")?.value ?? "";

  return (
    <>
      <JsonLd data={restaurantJsonLd(cfg, locations)} />
      <section className="relative bg-ink text-white">
        <div className="absolute inset-0 opacity-60">
          <Image src={assetUrl(cfg.brand.hero)} alt="" fill priority sizes="100vw" className="object-cover" unoptimized={cfg.brand.hero.endsWith(".svg")} />
        </div>
        <div className="relative lf-container py-12 sm:py-20 max-w-2xl">
          {avail && primary ? <OpenPill a={avail} tz={primary.timezone} etaMinutes={primary.deliveryMinutes} /> : null}
          <h1 className="lf-h1 mt-4">{cfg.seo.cuisine} delivery in {cfg.seo.locality.join(" & ")}</h1>
          <p className="mt-3 text-white/85 text-lg">{cfg.brand.tagline || `Order direct from ${cfg.name}. Fresh, fast and no app fees.`}</p>
          <div className="mt-6 lf-card p-3 text-ink">
            <PostcodeCheck initial={lastPostcode} />
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link href="/menu" className="lf-btn lf-btn-primary">Order now</Link>
            {cfg.fulfilment.includes("collection") ? <Link href="/menu?fulfilment=collection" className="lf-btn lf-btn-ghost text-white border-white/40">Collect in {primary?.prepMinutes ?? 15} min</Link> : null}
          </div>
        </div>
      </section>

      <div className="lf-container">
        <CategoryChips categories={menu.categories} />

        {deal ? (
          <section className="mt-6">
            <Link href={`/deals/${deal.slug}`} className="lf-card block p-5 bg-brand text-brand-ink hover:brightness-95">
              <p className="text-xs font-bold uppercase tracking-wide">Today&apos;s deal</p>
              <p className="text-2xl font-extrabold mt-1">{deal.name} · {gbpShort(deal.price)}</p>
              <p className="mt-1 opacity-90">{deal.description}</p>
              <span className="lf-btn lf-btn-secondary mt-4">Build this deal</span>
            </Link>
          </section>
        ) : null}

        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="lf-h2">Most popular</h2>
            <Link href="/menu" className="text-sm font-semibold text-brand">Full menu →</Link>
          </div>
          <div className="grid gap-3 mt-4 sm:grid-cols-2">
            {sellers.map(({ product, category }) => (
              <ProductCard key={product.id} product={product} href={productPath(category, product)} image={assetUrl(product.image)} />
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { t: "Order direct, pay less", d: "No marketplace fees. Same prices as the shop." },
            { t: "Apple Pay & Google Pay", d: "Checkout in one tap. Guest checkout, no account needed." },
            { t: "Live order tracking", d: "See when the kitchen accepts, cooks and sends your food." },
          ].map((x) => (
            <div key={x.t} className="lf-card p-4"><p className="font-bold">{x.t}</p><p className="text-sm text-muted mt-1">{x.d}</p></div>
          ))}
        </section>

        <section className="mt-12">
          <h2 className="lf-h2">We deliver to</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cfg.seo.locality.map((l) => (
              <li key={l}><Link href={localityPath(cfg, l)} className="lf-pill bg-surface border border-line">{cfg.seo.cuisine} delivery {l}</Link></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
