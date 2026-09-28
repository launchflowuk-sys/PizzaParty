"use client";
import { useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/money";
import { POS_DISPLAY_CHANNEL, type PosDisplayMessage } from "@/lib/pos-phase4-types";
import "./pos.css";

const IDLE_AFTER_PAID_MS = 8000;
const HERO_SLIDE_MS = 6000;

type Screen = PosDisplayMessage;
type BasketScreen = Extract<Screen, { type: "basket" }>;
type HeroImage = { src: string; alt: string };

/**
 * Customer-facing display (POS-PLAN item 29). Driven purely by BroadcastChannel
 * messages from the till - the shop name/logo/hero rotation/promo line come from
 * the server component (page.tsx) since this window shares no React state with
 * the till.
 *
 * "paying" messages on the wire carry no basket lines (see lib/pos-phase4-types.ts) -
 * the till already showed them once as a "basket" message a moment earlier, so this
 * component just remembers the last one and keeps rendering it while paying, per
 * the "never drop the order summary" requirement.
 */
export function PosDisplayClient({
  shopName, logoUrl, promoLine, heroImages,
}: {
  shopName: string;
  logoUrl: string;
  promoLine: string;
  heroImages: HeroImage[];
}) {
  const [screen, setScreen] = useState<Screen>({ type: "idle", shopName });
  const [basket, setBasket] = useState<BasketScreen | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [countdown, setCountdown] = useState(Math.round(IDLE_AFTER_PAID_MS / 1000));
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const prevLen = useRef(0);
  const linesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(POS_DISPLAY_CHANNEL);
    let idleTimer: number | undefined;
    ch.onmessage = (e) => {
      const msg = e.data as PosDisplayMessage;
      clearTimeout(idleTimer);
      setScreen(msg);
      if (msg.type === "basket") setBasket(msg);
      if (msg.type === "idle") { setBasket(null); prevLen.current = 0; }
      if (msg.type === "paid") {
        idleTimer = window.setTimeout(() => { setScreen({ type: "idle", shopName }); setBasket(null); prevLen.current = 0; }, IDLE_AFTER_PAID_MS);
      }
    };
    return () => { clearTimeout(idleTimer); ch.close(); };
  }, [shopName]);

  // Idle hero rotation (Ken Burns handled in CSS, index just picks the slide).
  useEffect(() => {
    if (screen.type !== "idle" || heroImages.length < 2) return;
    const t = window.setInterval(() => setHeroIndex((i) => (i + 1) % heroImages.length), HERO_SLIDE_MS);
    return () => clearInterval(t);
  }, [screen.type, heroImages.length]);

  // Flash + auto-scroll to the most recently added line.
  useEffect(() => {
    if (screen.type !== "basket") return;
    if (screen.lines.length > prevLen.current) {
      const idx = screen.lines.length - 1;
      setFlashIdx(idx);
      const t = window.setTimeout(() => setFlashIdx((cur) => (cur === idx ? null : cur)), 900);
      linesRef.current?.scrollTo({ top: linesRef.current.scrollHeight, behavior: "smooth" });
      prevLen.current = screen.lines.length;
      return () => clearTimeout(t);
    }
    prevLen.current = screen.lines.length;
  }, [screen]);

  // Cosmetic countdown text on the paid screen - the real return-to-idle timer lives above.
  useEffect(() => {
    if (screen.type !== "paid") return;
    setCountdown(Math.round(IDLE_AFTER_PAID_MS / 1000));
    const t = window.setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [screen.type]);

  if (screen.type === "idle") {
    return <IdleScreen shopName={screen.shopName || shopName} logoUrl={logoUrl} promoLine={promoLine} heroImages={heroImages} heroIndex={heroIndex} />;
  }

  if (screen.type === "paid") {
    return <PaidScreen orderNumber={screen.orderNumber} heroImages={heroImages} countdown={countdown} />;
  }

  // basket or paying: same split layout, the right pane changes.
  const b = screen.type === "basket" ? screen : basket;
  return (
    <OrderScreen
      shopName={shopName}
      logoUrl={logoUrl}
      basket={b}
      flashIdx={screen.type === "basket" ? flashIdx : null}
      linesRef={linesRef}
      paying={screen.type === "paying" ? screen : null}
    />
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
  shopName, logoUrl, basket, flashIdx, linesRef, paying,
}: {
  shopName: string;
  logoUrl: string;
  basket: BasketScreen | null;
  flashIdx: number | null;
  linesRef: React.RefObject<HTMLDivElement | null>;
  paying: Extract<Screen, { type: "paying" }> | null;
}) {
  const lines = basket?.lines ?? [];
  return (
    <div className="pos-display-root pos-display-order" data-paying={paying ? "1" : "0"}>
      <header className="pos-display-band">
        {logoUrl ? <img src={logoUrl} alt={shopName} className="pos-display-logo-sm" /> : null}
        <span className="pos-display-band-name">{basket?.shopName || shopName}</span>
      </header>
      <div className="pos-display-order-body">
        <div className="pos-display-lines" ref={linesRef}>
          {lines.length === 0 ? <p className="pos-display-empty">Building your order…</p> : null}
          {lines.map((l, i) => (
            <div key={i} className="pos-display-line" data-new={i === flashIdx ? "1" : "0"}>
              {l.image ? (
                <img src={l.image} alt="" className="pos-display-thumb" />
              ) : (
                <span className="pos-display-thumb pos-display-thumb-empty" aria-hidden="true" />
              )}
              <span className="pos-display-line-text">
                <span className="pos-display-line-name">{l.qty}× {l.name}</span>
                {l.detail ? <span className="pos-display-line-detail">{l.detail}</span> : null}
              </span>
              <span className="pos-display-line-price">{gbp(l.lineTotal)}</span>
            </div>
          ))}
        </div>

        <aside className="pos-display-summary">
          {paying ? (
            <PaymentPanel paying={paying} />
          ) : (
            <>
              <div className="pos-display-sumrow"><span>Subtotal</span><span>{gbp(basket?.subtotal ?? 0)}</span></div>
              {(basket?.discount ?? 0) > 0 ? <div className="pos-display-sumrow pos-display-sumrow-discount"><span>Discount</span><span>−{gbp(basket!.discount)}</span></div> : null}
              {(basket?.deliveryFee ?? 0) > 0 ? <div className="pos-display-sumrow"><span>Delivery</span><span>{gbp(basket!.deliveryFee)}</span></div> : null}
              <div className="pos-display-total-block">
                <span>Total</span>
                <span className="pos-display-total-num">{gbp(basket?.total ?? 0)}</span>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
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
