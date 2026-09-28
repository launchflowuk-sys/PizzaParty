"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { gbp } from "@/lib/money";
import { CategoryIcon } from "@/components/FoodIcon";
import { Icon } from "@/components/pos/PosDisplayIcons";
import { kioskCount, kioskTotal, type KioskFulfilment } from "@/lib/kiosk-rules";
import type { PosCategory, PosDeal, PosProduct } from "@/components/pos/pos-client-types";
import type { KioskBrand, KioskLine, KioskSlide } from "./kiosk-types";
import { ScriptHeadline } from "./KioskAttract";

export type KioskHeaderProps = {
  brand: KioskBrand; fulfilment: KioskFulfilment; fulfilments: KioskFulfilment[];
  onFulfilment: (f: KioskFulfilment) => void; onStartOver: () => void;
};
const TYPE_LABEL: Record<KioskFulfilment, { label: string; icon: "dine" | "bag" }> = { eat_in: { label: "Eat in", icon: "dine" }, collection: { label: "Take away", icon: "bag" } };
const DESC_MAX = 84;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The customer display's header: logo, two-tone name, the order-type switch - plus "Start over". */
export function KioskHeader({ brand, fulfilment, fulfilments, onFulfilment, onStartOver }: KioskHeaderProps) {
  const [first, ...rest] = brand.shopName.split(" ");
  return (
    <header className="cd-header kx-header">
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="cd-logo" /> : null}
      <div className="cd-brand">
        <span className="cd-name">{rest.length ? <><span className="cd-name-a">{first}</span> {rest.join(" ")}</> : brand.shopName}</span>
        {brand.tagline ? <span className="cd-tagline">{brand.tagline}</span> : null}
      </div>
      <div className="kx-header-right">
        {fulfilments.length > 1 ? (
          <div className="cd-types" role="radiogroup" aria-label="Eat in or take away">
            {fulfilments.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={t === fulfilment} className="cd-type" data-on={t === fulfilment ? "1" : "0"} onClick={() => onFulfilment(t)}>
                <Icon name={TYPE_LABEL[t].icon} />{TYPE_LABEL[t].label}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="kx-ghost kx-startover" onClick={onStartOver}><Icon name="close" />Start over</button>
      </div>
    </header>
  );
}

type Cat = { key: string; name: string; kind: "popular" | "deals" | "category"; products: PosProduct[] };

/** Menu: category rail on the left (Popular, Deals, then the shop's own), big photo cards, and the order bar along the bottom. */
export function KioskMenu({ header, categories, deals, popular, lines, banner, onPick, onDeal, onView }: {
  header: KioskHeaderProps; categories: PosCategory[]; deals: PosDeal[]; popular: string[]; lines: KioskLine[]; banner: KioskSlide | null;
  onPick: (slug: string) => void; onDeal: (d: PosDeal) => void; onView: () => void;
}) {
  const cats = useMemo<Cat[]>(() => {
    const all = categories.flatMap((c) => c.products);
    const pop = popular.map((s) => all.find((p) => p.slug === s)).filter((p): p is PosProduct => !!p);
    return [
      ...(pop.length ? [{ key: "popular", name: "Popular", kind: "popular" as const, products: pop }] : []),
      ...(deals.length ? [{ key: "deals", name: "Deals", kind: "deals" as const, products: [] }] : []),
      ...categories.map((c) => ({ key: c.key, name: c.name, kind: "category" as const, products: c.products })),
    ];
  }, [categories, deals.length, popular]);
  const [active, setActive] = useState(cats[0]?.key ?? "");
  const cat = cats.find((c) => c.key === active) ?? cats[0];
  const mainRef = useRef<HTMLDivElement>(null);
  const popularSet = useMemo(() => new Set(popular.slice(0, 4)), [popular]);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [active]);

  return (
    <div className="cd-root kx-root kx-menu">
      <KioskHeader {...header} />
      <div className="kx-menu-body">
        <nav className="kx-rail" aria-label="Menu categories">
          {cats.map((c) => (
            <button key={c.key} type="button" className="kx-rail-btn" data-on={c.key === cat?.key ? "1" : "0"} onClick={() => setActive(c.key)}>
              <span className="kx-rail-icon" data-kind={c.kind} aria-hidden="true">
                {c.kind === "popular" ? <Icon name="star" /> : c.kind === "deals" ? <Icon name="tag" /> : <CategoryIcon slug={c.key} size={40} />}
              </span>
              <span className="kx-rail-name">{c.name}</span>
            </button>
          ))}
        </nav>
        <main className="kx-main" ref={mainRef}>
          {cat?.kind === "popular" && banner ? (
            <div className="kx-banner" style={{ backgroundImage: `url(${banner.image})` }}>
              <div className="kx-banner-copy">
                <span className="kx-banner-kicker">{banner.kicker}</span>
                <ScriptHeadline text={banner.headline} className="kx-banner-head" />
              </div>
              {banner.price !== null ? <span className="kx-banner-price">{banner.from ? <small>from</small> : null}{gbp(banner.price)}</span> : null}
            </div>
          ) : null}
          <h1 className="kx-h1">{cat?.kind === "popular" ? "Our most popular" : cat?.name}</h1>
          <p className="kx-sub">{cat?.kind === "deals" ? "Build your deal and save" : cat?.kind === "popular" ? "The favourites everyone orders" : "Tap an item to add it"}</p>
          <div className="kx-grid">
            {cat?.kind === "deals"
              ? deals.map((d) => <DealCard key={d.slug} deal={d} onTap={() => onDeal(d)} />)
              : cat?.products.map((p) => <ProductCard key={p.slug} p={p} hot={popularSet.has(p.slug)} onTap={() => onPick(p.slug)} />)}
          </div>
        </main>
      </div>
      <OrderBar lines={lines} onView={onView} />
    </div>
  );
}

function ProductCard({ p, hot, onTap }: { p: PosProduct; hot: boolean; onTap: () => void }) {
  const from = p.sizes.length > 1;
  return (
    <button type="button" className="kx-card" data-soldout={p.soldOut ? "1" : "0"} disabled={p.soldOut} onClick={onTap} aria-label={`${p.name}, ${from ? "from " : ""}${gbp(p.minPrice)}${p.soldOut ? ", sold out" : ""}`}>
      <span className="kx-card-photo">
        {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="kx-card-noimg"><CategoryIcon slug={p.categoryKey} size={72} /></span>}
        {p.soldOut ? <span className="kx-card-flag kx-card-flag-out">Sold out</span> : hot ? <span className="kx-card-flag"><Icon name="star" />Popular</span> : null}
      </span>
      <span className="kx-card-body">
        <span className="kx-card-name">{p.name}</span>
        {p.description ? <span className="kx-card-desc">{clip(p.description, DESC_MAX)}</span> : null}
        <span className="kx-card-foot">
          <span className="kx-card-price">{from ? <small>from</small> : null}{gbp(p.minPrice)}</span>
          <span className="cd-plus" aria-hidden="true"><Icon name="plus" /></span>
        </span>
      </span>
    </button>
  );
}

function DealCard({ deal, onTap }: { deal: PosDeal; onTap: () => void }) {
  const img = deal.image ?? deal.slots.flatMap((s) => s.options).find((o) => o.image)?.image;
  return (
    <button type="button" className="kx-card kx-card-deal" onClick={onTap}>
      <span className="kx-card-photo">
        {img ? <img src={img} alt="" loading="lazy" /> : null}
        <span className="kx-card-flag kx-card-flag-deal"><Icon name="tag" />Deal</span>
      </span>
      <span className="kx-card-body">
        <span className="kx-card-name">{deal.name}</span>
        <span className="kx-card-desc">{clip(deal.description || deal.slots.map((s) => `${s.qty > 1 ? `${s.qty} × ` : ""}${s.name}`).join(" + "), DESC_MAX)}</span>
        <span className="kx-card-foot">
          <span className="kx-card-price">{gbp(deal.price)}</span>
          <span className="cd-plus" aria-hidden="true"><Icon name="plus" /></span>
        </span>
      </span>
    </button>
  );
}

/** "View order (3) · £24.50 →", always along the bottom of the menu. */
export function OrderBar({ lines, onView }: { lines: KioskLine[]; onView: () => void }) {
  const n = kioskCount(lines);
  return (
    <div className="kx-bar" role="region" aria-label="Your order" data-empty={n ? "0" : "1"}>
      <div className="kx-bar-left">
        {n ? (
          <>
            <span className="kx-bar-thumbs" aria-hidden="true">
              {lines.slice(-4).map((l) => (l.view.image ? <img key={l.key} src={l.view.image} alt="" /> : <span key={l.key}>{l.name.slice(0, 1)}</span>))}
            </span>
            <span className="kx-bar-text"><b>Your order</b><span>{lines.map((l) => `${l.qty > 1 ? `${l.qty}× ` : ""}${l.name}`).join(", ")}</span></span>
          </>
        ) : (
          <span className="kx-bar-text"><b>Your order is empty</b><span>Tap any item to add it</span></span>
        )}
      </div>
      <button type="button" className="kx-go kx-bar-go" disabled={!n} onClick={onView}>
        <span>View order{n ? ` (${n})` : ""}</span>
        {n ? <><b aria-hidden="true">·</b><span>{gbp(kioskTotal(lines))}</span></> : null}
        <Icon name="arrow" />
      </button>
    </div>
  );
}
