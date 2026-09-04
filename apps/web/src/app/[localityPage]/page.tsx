import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getConfig, localityCopy, localityPath, localitySlug, assetUrl } from "@/lib/config";
import { getMenu, getLocations, topSellers, productPath } from "@/lib/menu";
import { availability, formatHours } from "@/lib/availability";
import { extractFaqs, renderMarkdown } from "@/lib/markdown";
import { faqJsonLd, fill, localBusinessJsonLd, seoVars } from "@/lib/seo";
import { gbpShort } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";
import { OpenPill } from "@/components/OpenPill";
import { PostcodeCheck } from "@/components/PostcodeCheck";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ localityPage: string }> };

function resolve(slug: string) {
  const cfg = getConfig();
  return cfg.seo.locality.find((l) => localityPath(cfg, l) === `/${slug}`) ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { localityPage } = await params;
  const locality = resolve(localityPage);
  if (!locality) return {};
  const cfg = getConfig();
  const vars = seoVars(cfg, { locality });
  return {
    title: { absolute: fill(cfg.seo.homeTitle, vars) },
    description: fill(cfg.seo.homeDescription, vars),
    alternates: { canonical: localityPath(cfg, locality) },
  };
}

export default async function LocalityPage({ params }: Params) {
  const { localityPage } = await params;
  const locality = resolve(localityPage);
  if (!locality) notFound();
  const cfg = getConfig();
  const [menu, locations] = await Promise.all([getMenu(), getLocations()]);
  const loc = locations.find((l) => l.key === localitySlug(locality)) ?? locations.find((l) => l.name.toLowerCase() === locality.toLowerCase()) ?? locations[0] ?? null;
  const md = localityCopy(locality) ?? "";
  const faqs = extractFaqs(md);
  const sellers = topSellers(menu, 6);
  const avail = loc ? availability(loc) : null;

  return (
    <div className="lf-container max-w-3xl">
      <JsonLd data={[localBusinessJsonLd(cfg, locality, loc), ...(faqs.length ? [faqJsonLd(faqs)] : [])]} />
      <header className="pt-8">
        {avail && loc ? <OpenPill a={avail} tz={loc.timezone} etaMinutes={loc.deliveryMinutes} /> : null}
        <h1 className="lf-h1 mt-3">{cfg.seo.cuisine} delivery in {locality}</h1>
        <p className="text-muted mt-2 text-lg">Order online from {cfg.name}{loc ? ` ${loc.name}` : ""}. {loc ? `${gbpShort(loc.deliveryFee)} delivery, ${gbpShort(loc.minOrder)} minimum, about ${loc.deliveryMinutes} minutes.` : ""}</p>
        <div className="lf-card p-3 mt-5"><PostcodeCheck /></div>
      </header>

      {loc?.postcodePrefixes.length ? (
        <section className="mt-8">
          <h2 className="lf-h2">Delivery area</h2>
          <p className="mt-2">We deliver to postcodes starting: {loc.postcodePrefixes.map((p) => <span key={p} className="lf-pill bg-surface border border-line mr-1">{p}</span>)}</p>
        </section>
      ) : null}

      {md ? <section className="lf-prose mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} /> : null}

      <section className="mt-10">
        <h2 className="lf-h2">Popular in {locality}</h2>
        <div className="grid gap-3 mt-4 sm:grid-cols-2">
          {sellers.map(({ product, category }) => <ProductCard key={product.id} product={product} href={productPath(category, product)} image={assetUrl(product.image)} />)}
        </div>
        <Link href="/menu" className="lf-btn lf-btn-primary mt-5">See the full menu</Link>
      </section>

      {loc ? (
        <section className="mt-10">
          <h2 className="lf-h2">Opening hours · {loc.name}</h2>
          <table className="mt-3 text-sm w-full max-w-sm"><tbody>{formatHours(loc.hours).map((h) => <tr key={h.day} className="border-b border-line"><td className="py-1.5 font-semibold">{h.day}</td><td className="py-1.5 text-right">{h.text}</td></tr>)}</tbody></table>
          {loc.address ? <p className="text-muted mt-3">{loc.address}</p> : null}
        </section>
      ) : null}

      <section className="mt-10 text-sm text-muted">
        Also delivering to: {cfg.seo.locality.filter((l) => l !== locality).map((l) => <Link key={l} href={localityPath(cfg, l)} className="underline mr-2">{l}</Link>)}
      </section>
    </div>
  );
}
