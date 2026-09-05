import Link from "next/link";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, getLocations, topSellers, productPath, dealsToday } from "@/lib/menu";
import { availability } from "@/lib/availability";
import { restaurantJsonLd } from "@/lib/seo";
import { gbpShort } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";
import Image from "next/image";
import { Photo } from "@/components/Photo";
import { MenuSearchPill, type SearchItem } from "@/components/MenuSearchPill";
import { ReviewStrip } from "@/components/ReviewStrip";
import { HomeStory } from "@/components/HomeStory";
import { publicReviews, reviewSummary } from "@/lib/google-reviews";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { HeroStamp } from "@/components/HeroStamp";

export const dynamic = "force-dynamic";

/** Home A - "Ruled grid", the default home direction in `Farm Pizza.dc.html`.
 *  Layout, type and rules follow the prototype; the content is this client's real
 *  menu, shops and opening hours rather than the prototype's sample data. */
export default async function Home() {
  const cfg = getConfig();
  const [menu, locations, reviews, reviewStats] = await Promise.all([
    getMenu(), getLocations(), publicReviews(12), reviewSummary(),
  ]);
  const primary = locations[0];
  const avail = primary ? availability(primary) : null;
  const featured = topSellers(menu, 4);
  const deals = dealsToday(menu.deals).slice(0, 4);
  const towns = cfg.seo.locality.join(" · ");
  // Chips under the search bar: the shop's own best sellers, so the suggestions
  // are things it actually makes rather than generic pizza words.
  const heroSuggestions = featured.slice(0, 4).map((f) => f.product.name);
  // The headline is "Tonight, it's <thing>", so the rotating half has to be a
  // noun that finishes that sentence. Best sellers first, then a spread across
  // the rest of the menu so it is not eight pizzas in a row.
  // Every pizza on the menu, best sellers first so the good ones are seen even
  // if nobody watches the whole cycle.
  // A compact index for the hero search dropdown: names and prices only, so it
  // is a few KB rather than the whole menu with descriptions and photographs.
  const searchItems: SearchItem[] = menu.categories.flatMap((c) =>
    c.products.map((p) => {
      const prices = p.sizes.map((sz) => sz.price);
      return {
        slug: p.slug,
        name: p.name,
        category: c.name,
        href: productPath(c, p),
        description: p.description,
        tags: p.tags,
        fromPrice: prices.length ? Math.min(...prices) : 0,
        sizeNote: p.sizes.length > 1 ? `${p.sizes.length} sizes` : (p.sizes[0]?.name ?? ""),
        soldOut: p.soldOut,
      };
    }),
  );

  // Counted from the live menu so the band cannot drift out of date.
  const pizzaCategory = menu.categories.find((c) => c.slug === "pizzas");
  const pizzaCount = pizzaCategory?.products.length ?? 0;
  const itemCount = menu.categories.reduce((n, c) => n + c.products.length, 0);
  // The largest size anywhere on the menu, if there is one worth boasting about.
  const biggestSize = (() => {
    const inches = menu.categories
      .flatMap((c) => c.products)
      .flatMap((p) => p.sizes)
      .map((sz) => Number(/(\d+)\s*"/.exec(sz.name)?.[1] ?? 0))
      .filter((n) => n > 0);
    const max = inches.length ? Math.max(...inches) : 0;
    return max >= 16 ? `${max}"` : "";
  })();

  const heroRotation = (() => {
    const top = featured.map((f) => f.product.name);
    const rest = (menu.categories.find((c) => c.slug === "pizzas")?.products ?? [])
      .map((p) => p.name)
      .filter((n) => !top.includes(n));
    return [...top, ...rest];
  })();

  return (
    <>
      <JsonLd data={restaurantJsonLd(cfg, locations)} />

      {/* hero — full-bleed photograph, because the first thing that sells a
          takeaway is the food, not a paragraph about it */}
      <section className="fp-hero">
        <Image
          src={assetUrl(cfg.brand.hero)}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={82}
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
        {/* Steam. Three slow, blurred plumes rising off the pizza - pure CSS,
            so it costs nothing to download and stops dead for anyone who has
            asked for reduced motion. */}
        <div className="fp-hero-steam" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="fp-hero-scrim" />

        <div className="fp-wrap fp-hero-inner">
          <HeroStamp />

          <span className="fp-hero-kicker">
            {towns}
            {avail ? <> &middot; {avail.open ? "Open now" : "Pre-order for later"}</> : null}
          </span>

          <TypewriterTitle prefix="Tonight, it&rsquo;s" items={heroRotation} />

          <p className="fp-hero-sub">Order direct. No app fees, no middleman.</p>

          <div className="fp-hero-cta">
            <Link href="/menu" className="btn btn-primary">Start your order</Link>
            <Link href="/deals" className="btn btn-hero-ghost">Tonight&rsquo;s deals</Link>
          </div>

          <MenuSearchPill suggestions={heroSuggestions} items={searchItems} />
        </div>
      </section>

      <div className="fp-rule" />

      {/* The four numbers.
          Every one is live: the wait comes from this shop's own settings, the
          price from the cheapest size of a real pizza, the rating from reviews
          actually left, and the status from today's opening hours. They were
          set as bare figures on the page ground, which made them read as
          decoration - so they get a cell each, a rule of accent above, and the
          status carries a pulsing dot while the shop is actually taking orders. */}
      <section className="fp-wrap fp-nums">
        {[
          { big: primary ? `${primary.deliveryMinutes}` : "—", unit: primary ? "min" : "", label: "Typical delivery", sub: primary ? `to ${primary.name}` : "" },
          { big: featured[0] ? gbpShort(featured[0].product.sizes[0]?.price ?? 0) : "—", unit: "", label: "Pizzas from", sub: featured[0]?.product.name ?? "" },
          { big: reviewStats.count > 0 ? `${reviewStats.average}` : "—", unit: reviewStats.count > 0 ? "/5" : "", label: "Customers rate us", sub: reviewStats.count > 0 ? `${reviewStats.count} reviews` : "no reviews yet" },
          { big: avail?.open ? "Open" : "Pre-order", unit: "", label: avail?.open ? "Taking orders now" : "Order ahead", sub: avail?.open ? "kitchen is on" : "for later today", live: !!avail?.open },
        ].map((n) => (
          <div key={n.label} className="fp-num" data-live={n.live ? "1" : undefined}>
            <span className="fp-num-big">
              {n.big}{n.unit ? <small>{n.unit}</small> : null}
            </span>
            <span className="fp-num-label">
              {n.live ? <i className="fp-num-dot" aria-hidden="true" /> : null}
              {n.label}
            </span>
            {n.sub ? <span className="fp-num-sub">{n.sub}</span> : null}
          </div>
        ))}
      </section>

      <div className="fp-rule" />

      {/* Deals, as cards with the photograph on them.
          They were a ruled list of price, name and description under the menu -
          the cheapest way to order from this shop, set out like a price list and
          placed after the thing it undercuts. The photographs existed and were
          never rendered anywhere, which is the actual reason they could not be
          seen. Cards, with the picture, above the menu. */}
      {deals.length ? (
        <section className="fp-wrap fp-dealsec">
          <span className="fp-kicker" style={{ marginBottom: 10 }}>Better together</span>
          <h2 className="fp-deals-h2">
            Deals this week.
            <span>{deals.length} of them, on tonight.</span>
          </h2>

          <div className="fp-dealgrid">
            {deals.map((d) => (
              <article key={d.slug} className="fp-dealcard">
                <div className="fp-dealcard-media">
                  <Link href={`/deals/${d.slug}`} className="fp-dealcard-imglink" aria-hidden="true" tabIndex={-1}>
                    {d.image ? (
                      <Image
                        src={assetUrl(d.image)}
                        alt=""
                        fill
                        sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw"
                        style={{ objectFit: "cover" }}
                      />
                    ) : null}
                  </Link>
                  <span className="fp-dealcard-price">{gbpShort(d.price)}</span>
                </div>
                <div className="fp-dealcard-body">
                  <h3>{d.name}</h3>
                  {d.description ? <p>{d.description}</p> : null}
                  {d.slots.length ? (
                    <ul className="fp-dealcard-slots">
                      {d.slots.map((sl) => <li key={sl.id}>{sl.qty} &times; {sl.name}</li>)}
                    </ul>
                  ) : null}
                  <Link href={`/deals/${d.slug}`} className="btn btn-primary fp-dealcard-cta">
                    Build this deal
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <Link href="/deals" className="btn btn-secondary" style={{ marginTop: 20 }}>See every deal</Link>
        </section>
      ) : null}

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

      {/* the one red field on the page */}
      <div className="fp-rule" />

      <HomeStory
        pizzaCount={pizzaCount}
        itemCount={itemCount}
        biggestSize={biggestSize}
        towns={cfg.seo.locality}
        referral={
          cfg.referral.enabled
            ? {
                refereeDiscount: `£${cfg.referral.refereeDiscount.toFixed(2)}`,
                referrerReward: `£${cfg.referral.referrerReward.toFixed(2)}`,
                minOrder: `£${cfg.referral.minOrder.toFixed(2)}`,
              }
            : null
        }
      />

      <div className="fp-rule" />

      <ReviewStrip reviews={reviews} summary={reviewStats} reviewUrl={cfg.contact.reviewUrl} />

      {/* The closing band was a flat red rectangle with white text and a small
          button - the last thing on the page and the least interesting. It is
          the place somebody decides, so it gets the weight: a deep charcoal
          ground with the accent bled through it, a slow drifting check like a
          pizzeria tablecloth, and the same typewriter as the hero naming what
          is actually going in the oven. */}
      <section className="fp-close">
        <div className="fp-close-check" aria-hidden="true" />
        <div className="fp-close-glow" aria-hidden="true" />
        <div className="fp-wrap fp-close-inner">
          <div>
            <span className="fp-kicker fp-close-kicker">Still deciding?</span>
            <TypewriterTitle
              as="h2"
              className="fp-close-h2"
              prefix="Order tonight. Eat"
              items={heroRotation}
            />
          </div>
          <div className="fp-close-cta">
            <Link href="/menu" className="btn btn-primary fp-cta-lg">Start an order &rarr;</Link>
            <Link href="/deals" className="btn btn-hero-ghost fp-cta-lg">See tonight&rsquo;s deals</Link>
          </div>
        </div>
      </section>
    </>
  );
}
