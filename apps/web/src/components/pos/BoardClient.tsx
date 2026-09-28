"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardOrder } from "@/lib/pos-board-types";
import { PromoPanel, type DisplayExtra, type DisplayPromo } from "./PosDisplayOrder";
import { SourceIcon, BandIcon } from "./BoardIcons";
import { useBoard } from "./useBoard";
import "./board.css";

const SOUND_KEY = "lf-board-sound";
const PROMO_MS = 9000;

/** A soft two-note chime - distinct from the till's own sharper "new order" beep. */
function chime(ctx: AudioContext) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  g.gain.value = 0.16;
  o.connect(g);
  g.connect(ctx.destination);
  o.frequency.setValueAtTime(660, ctx.currentTime);
  o.frequency.setValueAtTime(880, ctx.currentTime + 0.14);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
  o.stop(ctx.currentTime + 0.7);
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Order status board (POS-PLAN item 36): "Preparing" / "Ready to collect" for a TV by
 * the kiosk. Live data via useBoard (GET /api/pos/board, pushed by /api/kitchen/stream).
 * Sound is opt-in - autoplay is blocked until a tap, and a shop floor chiming on every
 * order by default is its own kind of nuisance - remembered in localStorage once given.
 */
export function BoardClient({ shopName, logoUrl, tagline, promos, extras, loyaltyName, appUrl }: {
  shopName: string;
  logoUrl: string;
  tagline: string;
  promos: DisplayPromo[];
  extras: DisplayExtra[];
  /** Config `loyalty.name` when the scheme is on; empty string turns the band's rewards line off. */
  loyaltyName: string;
  /** Only set once a shop config actually has an app store link; the band skips that line without one. */
  appUrl?: string;
}) {
  const [soundOn, setSoundOn] = useState(false);
  const soundOnRef = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { try { setSoundOn(localStorage.getItem(SOUND_KEY) === "1"); } catch { /* private mode */ } }, []);

  const onReady = useCallback((ids: string[]) => {
    if (!soundOnRef.current) return;
    if (!audio.current) audio.current = new AudioContext();
    ids.forEach(() => chime(audio.current!));
  }, []);
  const { orders, connected, justReady } = useBoard(onReady);

  const enableSound = () => {
    if (!audio.current) audio.current = new AudioContext();
    void audio.current.resume();
    setSoundOn(true);
    try { localStorage.setItem(SOUND_KEY, "1"); } catch { /* private mode: asks again next visit */ }
  };

  const reducedMotion = useReducedMotion();
  const [promoIdx, setPromoIdx] = useState(0);
  useEffect(() => {
    if (promos.length < 2 || reducedMotion) return;
    const t = setInterval(() => setPromoIdx((i) => (i + 1) % promos.length), PROMO_MS);
    return () => clearInterval(t);
  }, [promos.length, reducedMotion]);
  const promo = promos[Math.min(promoIdx, promos.length - 1)] ?? null;
  // The script headline sizes down as it gets longer, so a title like "Any 2 Pizzas -
  // Medium" doesn't collide with the subline in the board's shorter panel (bd-promo
  // in board.css keys off this rather than the panel guessing from the raw string).
  const headlineLen = promo?.headline.trim().length ?? 0;
  const headlineBucket = headlineLen > 20 ? "l" : headlineLen > 12 ? "m" : "s";

  const preparing = orders.filter((o) => o.state === "preparing");
  const ready = orders.filter((o) => o.state === "ready");
  const empty = orders.length === 0;

  return (
    <div className="bd-root">
      <header className="bd-header">
        {logoUrl ? <img src={logoUrl} alt={shopName} className="bd-logo" /> : <span className="bd-shop">{shopName}</span>}
        <div className="bd-brand">
          <span className="bd-name">{shopName}</span>
          {tagline ? <span className="bd-tagline">{tagline}</span> : null}
        </div>
        <div className="bd-header-right">
          {!soundOn ? (
            <button type="button" className="bd-sound-btn" onClick={enableSound}>Enable sound</button>
          ) : null}
          <span className="bd-live-pill" data-connected={connected ? "1" : "0"}>
            <span className="bd-live-dot" />
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </div>
      </header>

      {empty ? (
        <div className="bd-empty">
          <p className="bd-empty-title">Order at the kiosk or the counter</p>
          <p className="bd-empty-sub">Your order number will show up here.</p>
        </div>
      ) : (
        <div className="bd-content">
          <div className="bd-columns">
            <section className="bd-col bd-col-prep">
              <h2 className="bd-col-title">Preparing</h2>
              {preparing.length ? (
                <div className="bd-grid">
                  {preparing.map((o) => <OrderCard key={o.id} order={o} />)}
                </div>
              ) : <p className="bd-col-empty">Nothing on right now</p>}
            </section>
            <section className="bd-col bd-col-ready">
              <h2 className="bd-col-title">Ready to collect</h2>
              {ready.length ? (
                <div className="bd-grid">
                  {ready.map((o) => <OrderCard key={o.id} order={o} justReady={justReady.has(o.id)} />)}
                </div>
              ) : <p className="bd-col-empty">Nothing waiting</p>}
            </section>
          </div>
          <aside className="bd-promo" data-headline-len={headlineBucket}>
            <PromoPanel promo={promo} extras={extras} />
          </aside>
        </div>
      )}

      <footer className="bd-band">
        <span className="bd-band-item">
          <BandIcon name="kiosk" />
          <span>Order at the kiosk — skip the queue</span>
        </span>
        {appUrl ? (
          <span className="bd-band-item">
            <BandIcon name="app" />
            <span>Download our app</span>
          </span>
        ) : null}
        {loyaltyName ? (
          <span className="bd-band-item">
            <BandIcon name="gift" />
            <span>Earn rewards with {loyaltyName}</span>
          </span>
        ) : null}
      </footer>
    </div>
  );
}

function OrderCard({ order, justReady }: { order: BoardOrder; justReady?: boolean }) {
  return (
    <article className="bd-card" data-new={justReady ? "1" : "0"}>
      <span className="bd-card-source"><SourceIcon source={order.source} /></span>
      <span className="bd-card-num">#{order.number}</span>
      {order.name ? <span className="bd-card-name">{order.name}</span> : null}
    </article>
  );
}
