import Link from "next/link";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, getLocations, topSellers, productPath } from "@/lib/menu";
import { availability } from "@/lib/availability";
import { restaurantJsonLd } from "@/lib/seo";
import { gbpShort } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";
import { Photo } from "@/components/Photo";

export const dynamic = "force-dynamic";

/** Home A - "Ruled grid", the default home direction in `Farm Pizza.dc.html`.
 *  Layout, type and rules follow the prototype; the content is this client's real
 *  menu, shops and opening hours rather than the prototype's sample data. */
export default async function Home() {
  const cfg = getConfig();
  const [menu, locations] = await Promise.all([getMenu(), getLocations()]);
  const primary = locations[0];
  const avail = primary ? availability(primary) : null;
  const featured = topSellers(menu, 4);
  const deals = menu.deals.slice(0, 4);
  const towns = cfg.seo.locality.join(" · ");

  return (
    <>
      <JsonLd data={restaurantJsonLd(cfg, locations)} />

      {/* hero */}
      <section
        className="fp-wrap fp-split-hero"
        style={{ padding: "72px 32px 56px" }}
      >
        <div className="fp-hero-copy">
          <span className="fp-kicker" style={{ marginBottom: 20 }}>{towns}</span>
          <h1 className="fp-hero-title">
            Real pizza.<br />From a real farm.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, maxWidth: "50ch", margin: "0 0 28px", color: "var(--color-neutral-800)" }}>
            {cfg.brand.tagline || `Order direct from ${cfg.name}. Fresh, fast and no app fees.`}
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/menu" className="btn btn-primary">See the menu</Link>
            <Link href="/deals" className="btn btn-ghost">Tonight&rsquo;s deals &rarr;</Link>
          </div>
        </div>
        <div className="fp-hero-photo">
          <Photo
            src={assetUrl(cfg.brand.hero)}
            alt={`${cfg.name} kitchen`}
            caption="hero photograph &middot; pizza on the pass &middot; b/w"
            height={440}
            priority
            sizes="(max-width: 1000px) 100vw, 450px"
          />
        </div>
      </section>

      <div className="fp-rule" />

      {/* the numbers */}
      <section className="fp-wrap fp-stats" style={{ padding: "40px 32px" }}>
        {[
          [primary ? `${primary.deliveryMinutes} min` : "—", "Average delivery time"],
          [featured[0] ? gbpShort(featured[0].product.sizes[0]?.price ?? 0) : "—", `A ${featured[0]?.product.name ?? "pizza"}, always`],
          ["0", "Frozen ingredients on site"],
          [avail?.open ? "Open" : "Pre-order", avail?.open ? "Taking orders right now" : "Order ahead for later"],
        ].map(([big, label]) => (
          <div key={label}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 44, lineHeight: 1, color: "var(--color-accent)", letterSpacing: "-.02em" }}>{big}</div>
            <div style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-700)", marginTop: 10 }}>{label}</div>
          </div>
        ))}
      </section>

      <div className="fp-rule" />

      {/* tonight's menu */}
      <section className="fp-wrap" style={{ padding: "56px 32px" }}>
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <span className="fp-kicker" style={{ marginBottom: 10 }}>Tonight&rsquo;s menu</span>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 36, letterSpacing: "-.02em", margin: 0, lineHeight: 1.05 }}>
              {featured.length} pizzas. No filler.
            </h2>
          </div>
          <Link href="/menu" style={{ fontSize: 14 }}>Full menu &rarr;</Link>
        </div>
        <div className="fp-grid fp-grid-4">
          {featured.map(({ product, category }, i) => (
            <div key={product.slug} className="fp-cell">
              <Photo
                src={assetUrl(product.image)}
                alt={product.name}
                caption={`photo · ${product.name.toLowerCase()} · b/w`}
                priority={i < 4}
              />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{product.name}</span>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17 }}>{gbpShort(product.sizes[0]?.price ?? 0)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--color-neutral-700)", flex: 1 }}>{product.description}</p>
              <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>
                {product.sizes.length > 1 ? `${product.sizes.length} sizes from ${product.sizes[0]?.name}` : product.sizes[0]?.name}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={productPath(category, product)} className="btn btn-primary">Add</Link>
                <Link href={productPath(category, product)} className="btn btn-secondary">Customise</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* deals */}
      {deals.length ? (
        <section className="fp-wrap" style={{ padding: "0 32px 64px" }}>
          <span className="fp-kicker" style={{ marginBottom: 12 }}>Deals this week</span>
          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {deals.map((d) => (
              <div
                key={d.slug}
                className="fp-dealrow"
                style={{ padding: "20px 0", borderBottom: "2px solid var(--color-divider)" }}
              >
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 32, letterSpacing: "-.02em", color: "var(--color-accent)" }}>
                  {gbpShort(d.price)}
                </span>
                <div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, lineHeight: 1.1 }}>{d.name}</div>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-800)" }}>{d.description}</p>
                <Link href={`/deals/${d.slug}`} className="btn btn-secondary">Add the deal</Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* the one red field on the page */}
      <section style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}>
        <div className="fp-wrap" style={{ padding: "64px 32px", display: "flex", alignItems: "end", justifyContent: "space-between", gap: 48 }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 64, lineHeight: 1, letterSpacing: "-.02em", margin: 0, marginLeft: "-.05em" }}>
            Order tonight.<br />Eat tonight.
          </h2>
          <Link href="/menu" className="btn" style={{ background: "var(--color-bg)", color: "var(--color-accent-700)", padding: "10px 16px" }}>
            Start an order &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
