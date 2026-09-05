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
      {/* The page ran as one column of headings a fixed gap apart, so the three
          numbers a customer actually wants - what it costs, what the minimum is,
          how long it takes - were a sentence in a paragraph. They are the answer
          to "will you deliver to me", so they lead. */}
      <header className="fp-loc-head">
        {avail && loc ? <OpenPill a={avail} tz={loc.timezone} etaMinutes={loc.deliveryMinutes} /> : null}
        <h1 className="lf-h1 mt-3">{cfg.seo.cuisine} delivery in {locality}</h1>
        <p className="text-muted mt-2 text-lg">
          Order online from {cfg.name}{loc ? ` ${loc.name}` : ""}.
        </p>

        {loc ? (
          <div className="fp-loc-facts">
            <div><span className="n">{gbpShort(loc.deliveryFee)}</span><span className="l">Delivery</span></div>
            <div><span className="n">{gbpShort(loc.minOrder)}</span><span className="l">Minimum order</span></div>
            <div><span className="n">{loc.deliveryMinutes}<small> min</small></span><span className="l">Typical wait</span></div>
          </div>
        ) : null}

        <div className="fp-loc-check">
          <span className="fp-kicker" style={{ marginBottom: 8 }}>Check your postcode</span>
          <PostcodeCheck />
        </div>
      </header>

      {loc?.postcodePrefixes.length ? (
        <section className="fp-loc-sec">
          <span className="fp-kicker">Delivery area</span>
          <h2 className="fp-loc-h2">Where we come to.</h2>
          <div className="fp-loc-pcs">
            {loc.postcodePrefixes.map((p) => <span key={p} className="fp-loc-pc">{p}</span>)}
          </div>
          <p className="fp-loc-note">
            If your postcode starts with one of these we deliver to you. Not sure? Put it in the box
            above and it will tell you straight away, along with what it costs from your street.
          </p>
        </section>
      ) : null}

      {md ? <section className="lf-prose fp-loc-sec" dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} /> : null}

      <section className="fp-loc-sec">
        <span className="fp-kicker">Most ordered</span>
        <h2 className="fp-loc-h2">Popular in {locality}</h2>
        <div className="grid gap-3 mt-4 sm:grid-cols-2">
          {sellers.map(({ product, category }) => <ProductCard key={product.id} product={product} href={productPath(category, product)} image={assetUrl(product.image)} />)}
        </div>
        <Link href="/menu" className="btn btn-primary fp-cta-lg" style={{ marginTop: 20 }}>See the full menu</Link>
      </section>

      {loc ? (
        <section className="fp-loc-sec">
          <span className="fp-kicker">When we are open</span>
          <h2 className="fp-loc-h2">{loc.name} opening hours</h2>
          <div className="fp-loc-hours">
            {formatHours(loc.hours).map((h) => (
              <div key={h.day}><span>{h.day}</span><span>{h.text}</span></div>
            ))}
          </div>
          {loc.address ? <p className="fp-loc-note">{loc.address}</p> : null}
        </section>
      ) : null}

      {cfg.seo.locality.filter((l) => l !== locality).length ? (
        <section className="fp-loc-sec">
          <span className="fp-kicker">Also delivering to</span>
          <h2 className="fp-loc-h2">Somewhere else?</h2>
          <div className="fp-loc-pcs">
            {cfg.seo.locality.filter((l) => l !== locality).map((l) => (
              <Link key={l} href={localityPath(cfg, l)} className="fp-loc-area">{l}</Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
