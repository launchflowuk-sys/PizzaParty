"use client";
import { useEffect, useState } from "react";
import { gbp } from "@/lib/money";
import { Icon } from "@/components/pos/PosDisplayIcons";
import type { KioskBrand, KioskSlide } from "./kiosk-types";

const SLIDE_MS = 6500;

/** Script headline with the last word picked out in the brand colour, as on the customer display's promo panel. */
export function ScriptHeadline({ text, className }: { text: string; className: string }) {
  const words = text.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : undefined;
  return <span className={className}>{words.join(" ")}{last ? <> <em>{last}</em></> : null}</span>;
}

/**
 * Attract loop: nobody is ordering. Full-screen offers - the shop's promo slots, today's
 * deals, best sellers - with a slow Ken Burns on the photo, the headline sliding in and
 * the price popping. Any touch anywhere starts an order. Motion stops under
 * prefers-reduced-motion (the slides still change, without movement).
 */
export function KioskAttract({ brand, slides, note, onStart }: { brand: KioskBrand; slides: KioskSlide[]; note: string; onStart: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [slides.length]);
  const s = slides[i];

  return (
    <div className="cd-root kx-root kx-attract" role="button" tabIndex={0} aria-label="Touch to start your order" onPointerUp={onStart} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onStart(); }}>
      <div className="kx-att-photos" aria-hidden="true">
        {slides.map((x, n) => <div key={x.image} className="kx-att-photo" data-on={n === i ? "1" : "0"} style={{ backgroundImage: `url(${x.image})` }} />)}
      </div>
      <div className="kx-att-panel">
        <div className="kx-att-brand">
          {brand.logoUrl ? <span className="kx-logo-plate"><img src={brand.logoUrl} alt={brand.shopName} /></span> : <span className="cd-name">{brand.shopName}</span>}
        </div>
        {s ? (
          <div className="kx-att-copy" key={i}>
            <span className="kx-att-kicker">{s.kicker}</span>
            <ScriptHeadline text={s.headline} className="kx-att-head" />
            {s.subline ? <span className="kx-att-sub">{s.subline}</span> : null}
            {s.price !== null ? (
              <span className="kx-att-price">{s.from ? <small>from</small> : null}{gbp(s.price)}</span>
            ) : null}
          </div>
        ) : (
          <div className="kx-att-copy"><ScriptHeadline text={brand.tagline || "Order here"} className="kx-att-head" /></div>
        )}
        {slides.length > 1 ? (
          <div className="kx-att-dots" aria-hidden="true">{slides.map((x, n) => <span key={x.image} data-on={n === i ? "1" : "0"} />)}</div>
        ) : null}
      </div>
      <div className="kx-att-cta">
        <span className="kx-att-btn"><span className="kx-att-hand" aria-hidden="true"><Icon name="arrow" /></span>Touch to start your order</span>
        <span className="kx-att-note">{note}</span>
      </div>
    </div>
  );
}
