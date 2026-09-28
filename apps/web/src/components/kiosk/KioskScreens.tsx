"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/pos/PosDisplayIcons";
import { PromoPanel, type DisplayExtra } from "@/components/pos/PosDisplayOrder";
import { KIOSK_DONE_MS, KIOSK_STILL_THERE_S, type KioskFulfilment, type KioskOrderRef } from "@/lib/kiosk-rules";
import type { KioskBrand, KioskSlide, KioskUpsell } from "./kiosk-types";

const TYPE_COPY: Record<KioskFulfilment, { title: string; sub: string; icon: "dine" | "bag" }> = {
  eat_in: { title: "Eat in", sub: "Enjoy it here with us", icon: "dine" },
  collection: { title: "Take away", sub: "Packed up to go", icon: "bag" },
};

export const promoOf = (s: KioskSlide | null) => (s ? { headline: s.headline, subline: s.kicker, price: s.price, image: s.image } : null);
export const extrasOf = (items: KioskUpsell[]): DisplayExtra[] => items.map((u) => ({ slug: u.slug, name: u.name, detail: u.detail.length > 40 ? `${u.detail.slice(0, 39).trimEnd()}…` : u.detail, price: u.price, image: u.image }));

/** "Eating in or taking away?" - two big photo cards, only the ones this shop offers at the counter. */
export function KioskType({ brand, fulfilments, slides, onChoose, onStartOver }: {
  brand: KioskBrand; fulfilments: KioskFulfilment[]; slides: KioskSlide[]; onChoose: (f: KioskFulfilment) => void; onStartOver: () => void;
}) {
  return (
    <div className="cd-root kx-root kx-type">
      <header className="kx-type-head">
        {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.shopName} className="kx-type-logo" /> : <span className="cd-name">{brand.shopName}</span>}
        <button type="button" className="kx-ghost" onClick={onStartOver}><Icon name="back" />Start over</button>
      </header>
      <h1 className="kx-type-title">Eating in or taking away?</h1>
      <p className="kx-type-sub">Choose one to start your order</p>
      <div className="kx-type-cards" data-n={fulfilments.length}>
        {fulfilments.map((f, n) => {
          const img = slides[n % Math.max(1, slides.length)]?.image;
          return (
            <button key={f} type="button" className="kx-type-card" onClick={() => onChoose(f)}>
              <span className="kx-type-photo" style={img ? { backgroundImage: `url(${img})` } : undefined} aria-hidden="true" />
              <span className="kx-type-icon" aria-hidden="true"><Icon name={TYPE_COPY[f].icon} /></span>
              <span className="kx-type-label">{TYPE_COPY[f].title}</span>
              <span className="kx-type-note">{TYPE_COPY[f].sub}</span>
              <span className="kx-type-go" aria-hidden="true"><Icon name="arrow" /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The order number, big. Pay-at-counter orders say so plainly; card orders say paid. Back to the offers after ~20s. */
export function KioskDone({ brand, order, name, paid, promo, extras, onNew }: {
  brand: KioskBrand; order: KioskOrderRef; name: string; paid: boolean; promo: KioskSlide | null; extras: KioskUpsell[]; onNew: () => void;
}) {
  const [left, setLeft] = useState(Math.round(KIOSK_DONE_MS / 1000));
  useEffect(() => {
    const t = window.setInterval(() => setLeft((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="cd-root kx-root cd-order cd-paid kx-done">
      <div className="cd-thanks">
        {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.shopName} className="cd-thanks-logo" /> : <span className="cd-name">{brand.shopName}</span>}
        <svg className="cd-tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="25" /><path fill="none" d="M14 27l7 7 16-16" /></svg>
        <span className="cd-thanks-title">Thank you{name ? `, ${name}` : ""}!</span>
        <span className="cd-thanks-label">Your order number</span>
        <span className="cd-thanks-num">#{order.number}</span>
        {paid ? (
          <span className="kx-done-pill" data-tone="paid"><Icon name="check" />Paid — thank you</span>
        ) : (
          <span className="kx-done-pill" data-tone="counter"><Icon name="cash" />Please pay at the counter</span>
        )}
        <p className="cd-thanks-msg">We&apos;ll call your number when it&apos;s ready</p>
        <div className="cd-countdown kx-countdown"><div style={{ animationDuration: `${KIOSK_DONE_MS}ms` }} /></div>
        <button type="button" className="kx-go kx-done-new" onClick={onNew}>Start a new order <small>({left}s)</small></button>
      </div>
      <PromoPanel promo={promoOf(promo)} extras={extrasOf(extras)} />
    </div>
  );
}

/** Sixty seconds without a touch: a big question and a countdown, then the order is cleared. */
export function KioskStillThere({ onStay, onTimeout }: { onStay: () => void; onTimeout: () => void }) {
  const [left, setLeft] = useState(KIOSK_STILL_THERE_S);
  useEffect(() => {
    const t = window.setInterval(() => setLeft((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (left <= 0) onTimeout(); }, [left, onTimeout]);
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="kx-modal-back" role="alertdialog" aria-labelledby="kx-still-title">
      <div className="kx-still">
        <svg className="kx-still-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r={r} className="kx-still-track" />
          <circle cx="60" cy="60" r={r} className="kx-still-bar" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, left) / KIOSK_STILL_THERE_S)} />
          <text x="60" y="60" dominantBaseline="central" textAnchor="middle">{Math.max(0, left)}</text>
        </svg>
        <h2 id="kx-still-title" className="kx-still-title">Are you still there?</h2>
        <p className="kx-still-sub">Your order will be cleared in {Math.max(0, left)} seconds.</p>
        <button type="button" className="kx-go kx-still-yes" onClick={onStay}>Yes, I&apos;m still ordering</button>
        <button type="button" className="kx-ghost" onClick={onTimeout}>Start over</button>
      </div>
    </div>
  );
}
