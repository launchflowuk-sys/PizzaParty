"use client";
import { gbp } from "@/lib/money";
import type { PosDisplayLine, PosDisplayMessage } from "@/lib/pos-phase4-types";
import { Icon } from "./PosDisplayIcons";
import { AddedToast, CustomerActions, UpsellPanel, type CustomerUi } from "./PosDisplayConfirm";
import "./pos-display.css";

type Basket = Extract<PosDisplayMessage, { type: "basket" }>;
type Paying = Extract<PosDisplayMessage, { type: "paying" }>;
export type DisplayOrderType = "eat_in" | "collection" | "delivery";
export type DisplayExtra = { slug: string; name: string; detail: string; price: number; image: string };
export type DisplayPromo = { headline: string; subline: string; price: number | null; image: string };
export type DisplayBrand = { shopName: string; logoUrl: string; tagline: string };

const EXTRAS_SHOWN = 3;
const SUGGESTIONS = 3;
const ORDER_TYPE_LABEL: Record<DisplayOrderType, { label: string; icon: "dine" | "bag" | "scooter" }> = {
  eat_in: { label: "Dine In", icon: "dine" },
  collection: { label: "Takeaway", icon: "bag" },
  delivery: { label: "Delivery", icon: "scooter" },
};

/**
 * Customer display, basket and paying (POS-PLAN item 29): header with the shop's
 * order types, the order as photo cards, the summary with a status bar and the
 * payment methods the shop takes, and a promo + "Popular extras" panel. All
 * driven by config/menu - see app/pos/display/page.tsx.
 */
export function OrderScreen({
  brand, basket, paying, flashIdx, linesRef, orderTypes, cardAccepted, loyaltyName, promo, extras, descriptions, customer,
}: {
  brand: DisplayBrand;
  basket: Basket | null;
  paying: Paying | null;
  flashIdx: number | null;
  linesRef: React.RefObject<HTMLDivElement | null>;
  orderTypes: DisplayOrderType[];
  cardAccepted: boolean;
  loyaltyName: string;
  promo: DisplayPromo | null;
  extras: DisplayExtra[];
  descriptions: Record<string, string>;
  /** Handed to the customer by the till: they confirm, add extras and choose how to pay here (PosDisplayConfirm.tsx). */
  customer?: CustomerUi | null;
}) {
  const lines = basket?.lines ?? [];
  const inBasket = new Set(lines.map((l) => l.slug).filter(Boolean));
  const offer = extras.filter((e) => !inBasket.has(e.slug));
  return (
    <div className="cd-root cd-order" data-paying={paying ? "1" : "0"}>
      <div className="cd-main">
        <Header brand={brand} orderTypes={orderTypes} current={basket?.fulfilment} />
        <section className="cd-left">
          <h1 className="cd-h1">Your Order</h1>
          <p className="cd-sub">
            {customer
              ? customer.wantsMore ? "Pick something from the right, or tell our team what you'd like." : "Is your order complete, or would you like to add something else?"
              : paying ? "Almost there…" : "We're adding your items…"}
          </p>
          <div className="cd-lines" ref={linesRef}>
            {lines.map((l, i) => <LineCard key={i} line={l} description={l.slug ? descriptions[l.slug] : undefined} isNew={i === flashIdx} />)}
            {basket?.truncated ? <p className="cd-more">…and more on the till</p> : null}
          </div>
          {customer ? <div className="cd-suggest" /> : <Suggestions items={offer.slice(EXTRAS_SHOWN, EXTRAS_SHOWN + SUGGESTIONS)} />}
          {loyaltyName ? <Rewards name={loyaltyName} /> : null}
        </section>
        <section className="cd-mid">
          <Summary basket={basket} paying={paying} />
          {customer ? <CustomerActions ui={customer} /> : (
            <>
              <StatusBar paying={paying} />
              <PayTiles cardAccepted={cardAccepted} paying={paying} />
            </>
          )}
        </section>
      </div>
      {customer?.upsell.length ? <UpsellPanel ui={customer} /> : <PromoPanel promo={promo} extras={offer.slice(0, EXTRAS_SHOWN)} />}
      {customer ? <AddedToast ui={customer} /> : null}
    </div>
  );
}

function Header({ brand, orderTypes, current }: { brand: DisplayBrand; orderTypes: DisplayOrderType[]; current?: DisplayOrderType }) {
  const [first, ...rest] = brand.shopName.split(" ");
  return (
    <header className="cd-header">
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="cd-logo" /> : null}
      <div className="cd-brand">
        {/* Two-tone name: the first word in the accent green, the rest in the brand colour. */}
        <span className="cd-name">{rest.length ? <><span className="cd-name-a">{first}</span> {rest.join(" ")}</> : brand.shopName}</span>
        {brand.tagline ? <span className="cd-tagline">{brand.tagline}</span> : null}
      </div>
      {orderTypes.length > 1 ? (
        <div className="cd-types" aria-label="Order type">
          {orderTypes.map((t) => (
            <span key={t} className="cd-type" data-on={t === current ? "1" : "0"}>
              <Icon name={ORDER_TYPE_LABEL[t].icon} />
              {ORDER_TYPE_LABEL[t].label}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}

/** One order line as a photo card. `children`: the kiosk's qty and remove buttons, under the extras. */
export function LineCard({ line, description, isNew, children }: { line: PosDisplayLine; description?: string; isNew: boolean; children?: React.ReactNode }) {
  // Paid extras only: the free defaults (standard base, the usual crust) are noise to a customer.
  const mods = (line.modifiers ?? []).filter((m) => m.name && m.price > 0);
  const unit = line.unitPrice ?? Math.round(line.lineTotal / Math.max(1, line.qty));
  const base = unit - mods.reduce((a, m) => a + m.price, 0);
  // Without the priced detail (offline, or a deal), the one-line summary stands in for size + extras.
  const sub = line.size ?? (line.unitPrice === undefined || !mods.length ? line.detail : "");
  return (
    <article className="cd-line" data-new={isNew ? "1" : "0"}>
      {line.image ? <img src={line.image} alt="" className="cd-thumb" /> : <span className="cd-thumb cd-thumb-empty" aria-hidden="true">{line.name.slice(0, 1)}</span>}
      <span className="cd-qty">{line.qty}</span>
      <div className="cd-line-head">
        <span className="cd-line-name">{line.name}</span>
        {sub ? <span className="cd-line-size">{sub}</span> : null}
        {description ? <span className="cd-line-desc">{description}</span> : null}
      </div>
      <div className="cd-line-price">
        <span>{gbp(mods.length ? base : unit)}</span>
        {line.qty > 1 ? <span>{gbp(line.lineTotal)}</span> : null}
      </div>
      {mods.length ? (
        <ul className="cd-mods">
          {mods.map((m, i) => (
            <li key={i}><span><b aria-hidden="true">+</b>{m.name}</span>{m.price ? <span>{gbp(m.price)}</span> : null}</li>
          ))}
        </ul>
      ) : null}
      {children ? <div className="cd-line-actions">{children}</div> : null}
    </article>
  );
}

/** Fills the room under a short order; a size container, so it steps aside as lines arrive. */
function Suggestions({ items }: { items: DisplayExtra[] }) {
  return (
    <div className="cd-suggest">
      {items.map((e, i) => (
        <div key={e.slug} className="cd-suggest-card" data-i={i}>
          <img src={e.image} alt="" />
          <div>
            <span className="cd-suggest-kicker">{i === 0 ? "Add a side?" : "Or try"}</span>
            <span className="cd-suggest-name">{e.name}</span>
            <span className="cd-price-red">{gbp(e.price)}</span>
          </div>
          <span className="cd-plus" aria-hidden="true"><Icon name="plus" /></span>
        </div>
      ))}
    </div>
  );
}

function Rewards({ name }: { name: string }) {
  return (
    <div className="cd-rewards">
      <Icon name="gift" />
      <div>
        <span className="cd-rewards-title">Earn rewards on every order!</span>
        <span className="cd-rewards-sub">Ask about {name}, our loyalty club.</span>
      </div>
      <Icon name="chevron" />
    </div>
  );
}

function Summary({ basket, paying }: { basket: Basket | null; paying: Paying | null }) {
  const total = paying?.total ?? basket?.total ?? 0;
  return (
    <div className="cd-summary">
      <div className="cd-row"><span>Subtotal</span><b>{gbp(basket?.subtotal ?? 0)}</b></div>
      {(basket?.discount ?? 0) > 0 ? <div className="cd-row cd-row-green"><span>Discount</span><b>-{gbp(basket!.discount)}</b></div> : null}
      {basket?.fulfilment === "delivery" || (basket?.deliveryFee ?? 0) > 0 ? <div className="cd-row"><span>Delivery</span><b>{gbp(basket?.deliveryFee ?? 0)}</b></div> : null}
      <hr />
      <span className="cd-total-label">Total to pay</span>
      <span className="cd-total">{gbp(total)}</span>
    </div>
  );
}

/** Looks like a button, is not one: it tells the customer where the order is up to. */
function StatusBar({ paying }: { paying: Paying | null }) {
  const text = !paying ? "Proceed to payment"
    : paying.method === "reader" ? "Tap your card on the reader"
    : (paying.change ?? 0) > 0 ? "Cash payment" : "Please pay at the counter";
  return (
    <div className="cd-status" data-state={paying ? paying.method : "basket"} role="status">
      <span>{text}</span>
      {paying ? null : <Icon name="arrow" />}
    </div>
  );
}

function PayTiles({ cardAccepted, paying }: { cardAccepted: boolean; paying: Paying | null }) {
  const card = paying?.method === "reader";
  const cash = paying?.method === "cash";
  const tendered = cash && typeof paying.tendered === "number";
  return (
    <div className="cd-tiles" data-n={cardAccepted ? 4 : 1}>
      {cardAccepted ? (
        <>
          <div className="cd-tile" data-on={card ? "1" : "0"}>
            <Icon name={card ? "contactless" : "card"} />
            <span className="cd-tile-label">Card</span>
            <span className="cd-tile-sub">Contactless or chip</span>
          </div>
          <div className="cd-tile" data-on={card ? "1" : "0"}><Icon name="apple" /><span className="cd-tile-label">Apple Pay</span></div>
          <div className="cd-tile" data-on={card ? "1" : "0"}><Icon name="google" /><span className="cd-tile-label">Google Pay</span></div>
        </>
      ) : null}
      <div className="cd-tile cd-tile-cash" data-on={cash ? "1" : "0"}>
        {tendered ? (
          <>
            <span className="cd-tile-sub">You gave <b>{gbp(paying.tendered ?? 0)}</b></span>
            <span className="cd-tile-label">Change</span>
            <span className="cd-change">{gbp(paying.change ?? 0)}</span>
          </>
        ) : (
          <><Icon name="cash" /><span className="cd-tile-label">Cash</span></>
        )}
      </div>
    </div>
  );
}

/** Right-hand panel: the live promo (or today's deal), then three popular extras not in the basket. `onPick` makes the extras tappable (the kiosk). */
export function PromoPanel({ promo, extras, onPick }: { promo: DisplayPromo | null; extras: DisplayExtra[]; onPick?: (slug: string) => void }) {
  const words = promo?.headline.trim().split(/\s+/) ?? [];
  const last = words.length > 1 ? words.pop() : undefined;
  return (
    <aside className="cd-right">
      {promo ? (
        <div className="cd-promo" style={promo.image ? { backgroundImage: `url(${promo.image})` } : undefined}>
          <div className="cd-promo-text">
            <span className="cd-promo-head">{words.join(" ")}{last ? <> <em>{last}</em></> : null}</span>
            {promo.subline ? <span className="cd-promo-sub">{promo.subline}</span> : null}
            {promo.price !== null ? <span className="cd-promo-price">{gbp(promo.price)}</span> : null}
          </div>
        </div>
      ) : <div className="cd-promo" />}
      {extras.length ? (
        <div className="cd-extras">
          <span className="cd-extras-title">Popular Extras</span>
          {extras.map((e) => {
            const body = (
              <>
                <img src={e.image} alt="" />
                <div>
                  <span className="cd-extra-name">{e.name}</span>
                  {e.detail ? <span className="cd-extra-detail">{e.detail}</span> : null}
                  <span className="cd-price-red">{gbp(e.price)}</span>
                </div>
                <span className="cd-plus" aria-hidden="true"><Icon name="plus" /></span>
              </>
            );
            return onPick
              ? <button key={e.slug} type="button" className="cd-extra" aria-label={`Add ${e.name}`} onClick={() => onPick(e.slug)}>{body}</button>
              : <div key={e.slug} className="cd-extra">{body}</div>;
          })}
        </div>
      ) : null}
    </aside>
  );
}

/** Thank-you, in the same language: white, logo, tick, the order number big, the promo panel alongside. */
export function ThankYouScreen({ brand, orderNumber, countdown, promo, extras }: { brand: DisplayBrand; orderNumber: number; countdown: number; promo: DisplayPromo | null; extras: DisplayExtra[] }) {
  return (
    <div className="cd-root cd-order cd-paid" key={orderNumber}>
      <div className="cd-thanks">
        {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.shopName} className="cd-thanks-logo" /> : <span className="cd-name">{brand.shopName}</span>}
        <svg className="cd-tick" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="25" />
          <path fill="none" d="M14 27l7 7 16-16" />
        </svg>
        <span className="cd-thanks-title">Thank you!</span>
        <span className="cd-thanks-label">Your order number</span>
        <span className="cd-thanks-num">#{orderNumber}</span>
        <p className="cd-thanks-msg">We&apos;ll call your number when it&apos;s ready</p>
        <div className="cd-countdown"><div /></div>
        <p className="cd-countdown-text">Back to the welcome screen in {countdown}s</p>
      </div>
      <PromoPanel promo={promo} extras={extras.slice(0, EXTRAS_SHOWN)} />
    </div>
  );
}
