"use client";
import { useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/money";
import type { PosDisplayMessage, PosDisplayTill } from "@/lib/pos-phase4-types";
import { useDisplayFeed } from "./useDisplayFeed";
import "./pos.css";

const IDLE_AFTER_PAID_MS = 8000;
const HERO_SLIDE_MS = 6000;
const UPSELL_SHOWN = 4;
const PICKER_TAPS = 3; // taps on the hidden corner, within PICKER_TAP_WINDOW_MS, to choose another till
const PICKER_TAP_WINDOW_MS = 1500;

type Screen = PosDisplayMessage;
type BasketScreen = Extract<Screen, { type: "basket" }>;
type HeroImage = { src: string; alt: string };
export type UpsellItem = { slug: string; name: string; fromPrice: number; image: string };
export type DisplayDeal = { name: string; price: number; image: string };

/**
 * Customer display (POS-PLAN item 29). Live state comes from one till via
 * useDisplayFeed (same-browser channel or the server relay, so any device
 * works); branding, photos, upsell and today's deal come from the server
 * component (page.tsx). Shows nothing staff-only: no till actions, no customer
 * details - just the order, prices and the menu.
 *
 * "paying" messages carry no basket lines (see lib/pos-phase4-types.ts); the
 * feed keeps the till's last basket so the order summary never drops.
 */
export function PosDisplayClient({
  shopName, logoUrl, tagline, promoLine, heroImages, upsell, deal, loyaltyLine,
}: {
  shopName: string;
  logoUrl: string;
  tagline: string;
  promoLine: string;
  heroImages: HeroImage[];
  upsell: UpsellItem[];
  deal: DisplayDeal | null;
  loyaltyLine: string;
}) {
  const feed = useDisplayFeed();
  const entry = feed.entry;
  const [heroIndex, setHeroIndex] = useState(0);
  const [countdown, setCountdown] = useState(Math.round(IDLE_AFTER_PAID_MS / 1000));
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  const prevLen = useRef(0);
  const linesRef = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);

  // A "paid" goes back to the welcome screen after a while - straight away if it is already old (a display that just connected).
  const paidAt = entry?.msg.type === "paid" ? entry.at : null;
  useEffect(() => {
    if (paidAt === null) return;
    const t = window.setTimeout(() => setExpiredAt(paidAt), Math.max(0, paidAt + IDLE_AFTER_PAID_MS - Date.now()));
    return () => clearTimeout(t);
  }, [paidAt]);

  const screen: Screen = !entry || (paidAt !== null && expiredAt === paidAt) ? { type: "idle", shopName } : entry.msg;
  const basket = screen.type === "idle" || screen.type === "paid" ? null : entry?.basket ?? null;

  // Hero rotation (Ken Burns handled in CSS, index just picks the slide). Also turns the summary photo.
  useEffect(() => {
    if (screen.type === "paid" || heroImages.length < 2) return;
    const t = window.setInterval(() => setHeroIndex((i) => (i + 1) % heroImages.length), HERO_SLIDE_MS);
    return () => clearInterval(t);
  }, [screen.type, heroImages.length]);

  // Flash + auto-scroll to the most recently added line.
  const lineCount = basket?.lines.length ?? 0;
  useEffect(() => {
    if (lineCount > prevLen.current) {
      const idx = lineCount - 1;
      setFlashIdx(idx);
      const t = window.setTimeout(() => setFlashIdx((cur) => (cur === idx ? null : cur)), 900);
      linesRef.current?.scrollTo({ top: linesRef.current.scrollHeight, behavior: "smooth" });
      prevLen.current = lineCount;
      return () => clearTimeout(t);
    }
    prevLen.current = lineCount;
  }, [lineCount]);

  // Cosmetic countdown text on the paid screen - the real return-to-idle timer lives above.
  useEffect(() => {
    if (screen.type !== "paid") return;
    setCountdown(Math.round(IDLE_AFTER_PAID_MS / 1000));
    const t = window.setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [screen.type]);

  const onCornerTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < PICKER_TAP_WINDOW_MS), now];
    if (taps.current.length >= PICKER_TAPS) { taps.current = []; feed.openPicker(); }
  };

  let body: React.ReactNode;
  if (feed.needsPick) {
    body = <TillPicker tills={feed.liveTills} current={feed.follow} onChoose={feed.choose} onCancel={feed.closePicker} logoUrl={logoUrl} shopName={shopName} />;
  } else if (screen.type === "idle") {
    body = <IdleScreen shopName={screen.shopName || shopName} logoUrl={logoUrl} promoLine={promoLine} heroImages={heroImages} heroIndex={heroIndex} />;
  } else if (screen.type === "paid") {
    body = <PaidScreen orderNumber={screen.orderNumber} heroImages={heroImages} countdown={countdown} />;
  } else {
    // basket or paying: same layout, the summary panel changes.
    const inBasket = new Set((basket?.lines ?? []).map((l) => l.slug).filter(Boolean));
    const shown = upsell.filter((u) => !inBasket.has(u.slug)).slice(0, UPSELL_SHOWN);
    // The summary photo avoids repeating a card that is already on screen.
    const spare = heroImages.filter((h) => !shown.some((u) => u.image === h.src));
    const photos = spare.length ? spare : heroImages;
    body = (
      <OrderScreen
        shopName={shopName}
        logoUrl={logoUrl}
        tagline={tagline}
        basket={basket}
        flashIdx={screen.type === "basket" ? flashIdx : null}
        linesRef={linesRef}
        paying={screen.type === "paying" ? screen : null}
        upsell={shown}
        deal={deal}
        promoLine={promoLine}
        photo={photos[heroIndex % Math.max(1, photos.length)]}
        loyaltyLine={loyaltyLine}
      />
    );
  }
  return (
    <>
      {body}
      <button type="button" className="pos-display-corner" aria-label="Choose which till this screen follows" onClick={onCornerTap} />
    </>
  );
}

/** Full-screen "which till?" - only till names, nothing else. */
function TillPicker({ tills, current, onChoose, onCancel, logoUrl, shopName }: {
  tills: PosDisplayTill[]; current: string | null; onChoose: (id: string) => void; onCancel: () => void; logoUrl: string; shopName: string;
}) {
  return (
    <div className="pos-display-root pos-display-picker">
      {logoUrl ? <span className="pos-display-logo-plate"><img src={logoUrl} alt={shopName} className="pos-display-logo-xl" /></span> : null}
      <h1 className="pos-display-picker-title">Which till is this screen for?</h1>
      {tills.length === 0 ? (
        <p className="pos-display-picker-hint">Waiting for a till… Open the till and ring something up, and it will appear here.</p>
      ) : (
        <div className="pos-display-picker-list">
          {tills.map((t) => (
            <button key={t.tillId} type="button" className="pos-display-picker-btn" data-current={t.tillId === current ? "1" : "0"} onClick={() => onChoose(t.tillId)}>
              {t.tillName}
              {tills.filter((x) => x.tillName === t.tillName).length > 1 ? <small> · {t.tillId.slice(0, 4)}</small> : null}
            </button>
          ))}
        </div>
      )}
      {current ? <button type="button" className="pos-display-picker-cancel" onClick={onCancel}>Keep the current till</button> : null}
    </div>
  );
}

function IdleScreen({ shopName, logoUrl, promoLine, heroImages, heroIndex }: { shopName: string; logoUrl: string; promoLine: string; heroImages: HeroImage[]; heroIndex: number }) {
  return (
    <div className="pos-display-root pos-display-idle">
      <div className="pos-display-hero">
        {heroImages.map((img, i) => (
          <div key={img.src} className="pos-display-hero-slide" data-active={i === heroIndex ? "true" : "false"} style={{ backgroundImage: `url(${img.src})` }} aria-hidden="true" />
        ))}
        <div className="pos-display-hero-scrim" />
      </div>
      <div className="pos-display-idle-panel">
        {logoUrl ? (
          <span className="pos-display-logo-plate"><img src={logoUrl} alt={shopName} className="pos-display-logo-xl" /></span>
        ) : (
          <span className="pos-display-shop">{shopName}</span>
        )}
        <p className="pos-display-idle-promo">{promoLine}</p>
      </div>
    </div>
  );
}

function OrderScreen({
  shopName, logoUrl, tagline, basket, flashIdx, linesRef, paying, upsell, deal, promoLine, photo, loyaltyLine,
}: {
  shopName: string;
  logoUrl: string;
  tagline: string;
  basket: BasketScreen | null;
  flashIdx: number | null;
  linesRef: React.RefObject<HTMLDivElement | null>;
  paying: Extract<Screen, { type: "paying" }> | null;
  upsell: UpsellItem[];
  deal: DisplayDeal | null;
  promoLine: string;
  photo: HeroImage | undefined;
  loyaltyLine: string;
}) {
  const lines = basket?.lines ?? [];
  const items = lines.reduce((n, l) => n + l.qty, 0);
  return (
    <div className="pos-display-root pos-display-order" data-paying={paying ? "1" : "0"}>
      <header className="pos-display-band">
        <span className="pos-display-band-name">{basket?.shopName || shopName}</span>
        {tagline ? <span className="pos-display-band-tag">{tagline}</span> : null}
      </header>
      <div className="pos-display-order-body">
        <div className="pos-display-main">
          <div className="pos-display-lines" ref={linesRef}>
            {lines.length === 0 ? <p className="pos-display-empty">Building your order…</p> : null}
            {lines.map((l, i) => (
              <div key={i} className="pos-display-line" data-new={i === flashIdx ? "1" : "0"}>
                {l.image ? (
                  <img src={l.image} alt="" className="pos-display-thumb" />
                ) : (
                  <span className="pos-display-thumb pos-display-thumb-empty" aria-hidden="true">{l.name.slice(0, 1)}</span>
                )}
                <span className="pos-display-line-text">
                  <span className="pos-display-line-name">{l.name}</span>
                  {l.detail ? <span className="pos-display-line-detail">{l.detail}</span> : null}
                </span>
                <span className="pos-display-line-qty">×{l.qty}</span>
                <span className="pos-display-line-price">{gbp(l.lineTotal)}</span>
              </div>
            ))}
            {basket?.truncated ? <p className="pos-display-more">…and more on the till</p> : null}
          </div>
          <Upsell items={upsell} deal={deal} promoLine={promoLine} shopName={shopName} />
        </div>

        <aside className="pos-display-summary">
          <div className="pos-display-sum-head">
            {logoUrl ? <span className="pos-display-sum-logo"><img src={logoUrl} alt={shopName} /></span> : null}
            <span className="pos-display-sum-title">Your order</span>
            <span className="pos-display-sum-sub">{items ? `${items} item${items === 1 ? "" : "s"} · made fresh for you` : "Made fresh for you"}</span>
          </div>
          {paying ? (
            <PaymentPanel paying={paying} />
          ) : (
            <>
              <div className="pos-display-sumrows">
                <div className="pos-display-sumrow"><span>Subtotal</span><span>{gbp(basket?.subtotal ?? 0)}</span></div>
                {(basket?.discount ?? 0) > 0 ? <div className="pos-display-sumrow pos-display-sumrow-discount"><span>Discount</span><span>−{gbp(basket!.discount)}</span></div> : null}
                {(basket?.deliveryFee ?? 0) > 0 ? <div className="pos-display-sumrow"><span>Delivery</span><span>{gbp(basket!.deliveryFee)}</span></div> : null}
              </div>
              {photo ? (
                <div className="pos-display-sum-photo" style={{ backgroundImage: `url(${photo.src})` }} role="img" aria-label={photo.alt} />
              ) : (
                <div className="pos-display-sum-photo pos-display-sum-photo-brand" aria-hidden="true" />
              )}
            </>
          )}
          {loyaltyLine ? <div className="pos-display-loyalty"><span aria-hidden="true">★</span>{loyaltyLine}</div> : null}
          {paying ? null : (
            <div className="pos-display-total-block">
              <span>Total</span>
              <span className="pos-display-total-num">{gbp(basket?.total ?? 0)}</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Fills whatever height the lines leave: two rows of big photo cards, then one
 * row, then just the deal ribbon (CSS container queries on .pos-display-upsell),
 * then nothing once the lines need all of it.
 */
function Upsell({ items, deal, promoLine, shopName }: { items: UpsellItem[]; deal: DisplayDeal | null; promoLine: string; shopName: string }) {
  return (
    <section className="pos-display-upsell" aria-label="You might also like">
      <div className="pos-display-upsell-box">
      {items.length || deal ? (
        <>
          <div className="pos-display-upsell-head">
            <span className="pos-display-upsell-title">You might also like</span>
            <span className="pos-display-upsell-hint">Just ask - we can add it now</span>
          </div>
          <div className="pos-display-upsell-grid" data-deal={deal ? "1" : "0"}>
            {deal ? (
              <article className="pos-display-card pos-display-card-deal" style={deal.image ? { backgroundImage: `url(${deal.image})` } : undefined}>
                <span className="pos-display-card-badge">Today&apos;s deal</span>
                <span className="pos-display-card-name">{deal.name}</span>
                <span className="pos-display-card-price">{gbp(deal.price)}</span>
              </article>
            ) : null}
            {items.map((u) => (
              <article key={u.slug} className="pos-display-card" style={{ backgroundImage: `url(${u.image})` }}>
                <span className="pos-display-card-name">{u.name}</span>
                <span className="pos-display-card-price">from {gbp(u.fromPrice)}</span>
              </article>
            ))}
          </div>
        </>
      ) : null}
      <p className="pos-display-upsell-ribbon">{deal ? `Today's deal: ${promoLine}` : `Thanks for choosing ${shopName}`}</p>
      </div>
    </section>
  );
}

function PaymentPanel({ paying }: { paying: Extract<Screen, { type: "paying" }> }) {
  const hasTendered = paying.method === "cash" && typeof paying.tendered === "number";
  return (
    <div className="pos-display-pay-panel">
      <span className="pos-display-pay-label">Please pay</span>
      <span className="pos-display-pay-total">{gbp(paying.total)}</span>

      {paying.method === "reader" ? (
        <div className="pos-display-card-anim">
          <svg viewBox="0 0 120 100" className="pos-display-card-svg" aria-hidden="true">
            <rect x="8" y="28" width="66" height="46" rx="7" className="pos-display-card-body" />
            <rect x="8" y="40" width="66" height="9" className="pos-display-card-stripe" />
            <path d="M90 34a24 24 0 0 1 0 34" className="pos-display-wave pos-display-wave1" />
            <path d="M99 24a38 38 0 0 1 0 54" className="pos-display-wave pos-display-wave2" />
            <path d="M108 14a52 52 0 0 1 0 74" className="pos-display-wave pos-display-wave3" />
          </svg>
          <span className="pos-display-pay-hint">Tap, insert or swipe your card</span>
        </div>
      ) : hasTendered ? (
        <div className="pos-display-cash-panel">
          <div className="pos-display-cash-row"><span>You gave</span><span>{gbp(paying.tendered ?? 0)}</span></div>
          <div className="pos-display-change-row">
            <span>Your change</span>
            <span className="pos-display-change-num">{gbp(paying.change ?? 0)}</span>
          </div>
        </div>
      ) : (
        <span className="pos-display-pay-hint pos-display-pulse-dot">Paying by cash…</span>
      )}
    </div>
  );
}

function PaidScreen({ orderNumber, heroImages, countdown }: { orderNumber: number; heroImages: HeroImage[]; countdown: number }) {
  return (
    <div className="pos-display-root pos-display-paid" key={orderNumber}>
      <div className="pos-display-paid-bg" style={heroImages[0] ? { backgroundImage: `url(${heroImages[0].src})` } : undefined} />
      <div className="pos-display-paid-scrim" />
      <div className="pos-display-paid-card">
        <svg className="pos-display-tick" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="25" className="pos-display-tick-bg" />
          <path className="pos-display-tick-check" fill="none" d="M14 27l7 7 16-16" />
        </svg>
        <span className="pos-display-thankyou">Thank you!</span>
        <span className="pos-display-order-pill">Order #{orderNumber}</span>
        <p className="pos-display-paid-msg">We&apos;ll call your number when it&apos;s ready</p>
        <div className="pos-display-countdown-track"><div className="pos-display-countdown-bar" /></div>
        <p className="pos-display-countdown-text">Back to welcome screen in {countdown}s</p>
      </div>
    </div>
  );
}
