"use client";
import { useEffect, useRef, useState } from "react";
import type { PosDisplayMessage, PosDisplayTill } from "@/lib/pos-phase4-types";
import { useDisplayFeed } from "./useDisplayFeed";
import { useCustomerDisplay } from "./useCustomerDisplay";
import { OrderScreen, ThankYouScreen, type DisplayExtra, type DisplayOrderType, type DisplayPromo } from "./PosDisplayOrder";
import "./pos.css";

const IDLE_AFTER_PAID_MS = 8000;
const HERO_SLIDE_MS = 6000;
const PICKER_TAPS = 3; // taps on the hidden corner, within PICKER_TAP_WINDOW_MS, to choose another till
const PICKER_TAP_WINDOW_MS = 1500;

type Screen = PosDisplayMessage;
type HeroImage = { src: string; alt: string };

/**
 * Customer display (POS-PLAN item 29). Live state comes from one till via
 * useDisplayFeed (same-browser channel or the server relay, so any device
 * works); branding, photos, the promo, extras and payment methods come from the
 * server component (page.tsx). Basket/paying/thank-you: PosDisplayOrder.tsx. Shows nothing staff-only: no till actions, no customer
 * details - just the order, prices and the menu.
 *
 * "paying" messages carry no basket lines (see lib/pos-phase4-types.ts); the
 * feed keeps the till's last basket so the order summary never drops.
 */
export function PosDisplayClient({
  shopName, logoUrl, tagline, promoLine, heroImages, promo, extras, descriptions, orderTypes, cardAccepted, loyaltyName,
}: {
  shopName: string;
  logoUrl: string;
  tagline: string;
  promoLine: string;
  heroImages: HeroImage[];
  promo: DisplayPromo | null;
  extras: DisplayExtra[];
  descriptions: Record<string, string>;
  orderTypes: DisplayOrderType[];
  cardAccepted: boolean;
  loyaltyName: string;
}) {
  const feed = useDisplayFeed();
  const brand = { shopName, logoUrl, tagline };
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
  // Handed over by the till: the customer confirms, adds extras and picks how to pay (item 29).
  const customer = useCustomerDisplay(feed.follow, entry?.basket ?? null, screen.type === "basket" && !feed.needsPick);

  // Idle hero rotation (Ken Burns handled in CSS, index just picks the slide).
  useEffect(() => {
    if (screen.type !== "idle" || heroImages.length < 2) return;
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
    body = <ThankYouScreen brand={brand} orderNumber={screen.orderNumber} countdown={countdown} promo={promo} extras={extras} />;
  } else {
    // basket or paying: same layout, the status bar and payment tiles follow the payment.
    body = (
      <OrderScreen
        brand={brand}
        basket={basket}
        paying={screen.type === "paying" ? screen : null}
        flashIdx={screen.type === "basket" ? flashIdx : null}
        linesRef={linesRef}
        orderTypes={orderTypes}
        cardAccepted={cardAccepted}
        loyaltyName={loyaltyName}
        promo={promo}
        extras={extras}
        descriptions={descriptions}
        customer={customer}
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
