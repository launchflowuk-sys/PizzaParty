"use client";
import { useEffect, useState } from "react";
import { gbp } from "@/lib/money";
import { Icon } from "@/components/pos/PosDisplayIcons";
import { LineCard, PromoPanel } from "@/components/pos/PosDisplayOrder";
import { kioskCount, kioskTotal, KIOSK_MAX_QTY, type KioskPriced } from "@/lib/kiosk-rules";
import type { KioskLine, KioskSlide, KioskUpsell } from "./kiosk-types";
import { KioskHeader, type KioskHeaderProps } from "./KioskMenu";
import { extrasOf, promoOf } from "./KioskScreens";
import { viewOf } from "./kiosk-lines";
import { kioskPost } from "./KioskStaff";

const PRICE_DEBOUNCE_MS = 250;

/**
 * The basket, laid out like the customer display's order column: photo cards with
 * qty and remove, the summary, the loyalty banner, and the promo panel with tappable
 * extras. Priced by the server on every change - it removes anything that has sold
 * out and says so - and the total shown is the total charged.
 */
export function KioskBasket({ header, lines, setLines, device, loyaltyName, promo, extras, onPick, onQty, onMore, onCheckout }: {
  header: KioskHeaderProps; lines: KioskLine[]; setLines: React.Dispatch<React.SetStateAction<KioskLine[]>>; device: string; loyaltyName: string;
  promo: KioskSlide | null; extras: KioskUpsell[]; onPick: (slug: string) => void;
  onQty: (key: string, qty: number) => void; onMore: () => void; onCheckout: () => void;
}) {
  const priced = useServerPrice(lines, setLines, device, header.fulfilment);
  const n = kioskCount(lines);
  const blocked = !priced || priced.errors.length > 0 || !lines.length;
  return (
    <div className="cd-root kx-root cd-order kx-basket">
      <div className="cd-main">
        <KioskHeader {...header} />
        <section className="cd-left">
          <h1 className="cd-h1">Your Order</h1>
          <p className="cd-sub">{n ? `${n} item${n === 1 ? "" : "s"} · ${header.fulfilment === "eat_in" ? "Eating in" : "Taking away"}` : "Your order is empty"}</p>
          <div className="cd-lines">
            {lines.map((l) => (
              <LineCard key={l.key} line={viewOf(l)} isNew={false}>
                <div className="kx-stepper kx-stepper-sm" role="group" aria-label={`How many ${l.name}`}>
                  <button type="button" onClick={() => onQty(l.key, l.qty - 1)} aria-label={l.qty === 1 ? `Remove ${l.name}` : "One fewer"}>{l.qty === 1 ? <Icon name="trash" /> : <Icon name="minus" />}</button>
                  <span>{l.qty}</span>
                  <button type="button" onClick={() => onQty(l.key, l.qty + 1)} disabled={l.qty >= KIOSK_MAX_QTY} aria-label="One more"><Icon name="plus" /></button>
                </div>
                <button type="button" className="kx-remove" onClick={() => onQty(l.key, 0)}><Icon name="trash" />Remove</button>
              </LineCard>
            ))}
            {!lines.length ? <button type="button" className="kx-empty" onClick={onMore}><Icon name="plus" />Add something to your order</button> : null}
          </div>
          {priced?.errors.length ? <p className="kx-error" role="alert">{priced.errors[0]}</p> : null}
          {loyaltyName ? (
            <div className="cd-rewards">
              <Icon name="gift" />
              <div>
                <span className="cd-rewards-title">Earn rewards on every order!</span>
                <span className="cd-rewards-sub">Ask at the counter about {loyaltyName}, our loyalty club.</span>
              </div>
              <Icon name="chevron" />
            </div>
          ) : null}
        </section>
        <section className="cd-mid">
          <div className="cd-summary">
            <div className="cd-row"><span>Subtotal</span><b>{gbp(priced?.subtotal ?? kioskTotal(lines))}</b></div>
            {(priced?.discount ?? 0) > 0 ? <div className="cd-row cd-row-green"><span>Discount</span><b>-{gbp(priced!.discount)}</b></div> : null}
            <hr />
            <span className="cd-total-label">Total to pay</span>
            {/* Until the server answers, the running total the menu showed - the server's figure replaces it. */}
            <span className="cd-total" aria-live="polite" data-pending={priced ? "0" : "1"}>{gbp(priced?.total ?? kioskTotal(lines))}</span>
          </div>
          <button type="button" className="kx-go kx-checkout" disabled={blocked} onClick={onCheckout}><span>Checkout</span><Icon name="arrow" /></button>
          <button type="button" className="kx-ghost kx-more" onClick={onMore}><Icon name="back" />Add more items</button>
        </section>
      </div>
      <PromoPanel promo={promoOf(promo)} extras={extrasOf(extras)} onPick={(slug) => { onPick(slug); onMore(); }} />
    </div>
  );
}

/**
 * The server's price for the basket, refreshed on every change. It is the only
 * price that counts: line prices are corrected from it, and anything the server
 * removed (sold out since it was added) leaves the basket.
 */
function useServerPrice(lines: KioskLine[], setLines: React.Dispatch<React.SetStateAction<KioskLine[]>>, device: string, fulfilment: string): KioskPriced | null {
  const [priced, setPriced] = useState<KioskPriced | null>(null);
  const sig = JSON.stringify(lines.map((l) => [l.key, l.qty]));
  useEffect(() => {
    if (!lines.length) { setPriced({ lines: [], subtotal: 0, discount: 0, total: 0, errors: [], removedKeys: [] }); return; }
    let live = true;
    const t = window.setTimeout(async () => {
      const r = await kioskPost<KioskPriced>("/api/kiosk/price", device, { fulfilment, lines: lines.map(({ view: _v, category: _c, ...l }) => l) });
      if (!live) return;
      if (!r.ok) { setPriced({ lines: [], subtotal: 0, discount: 0, total: 0, errors: [r.error], removedKeys: [] }); return; }
      const byKey = new Map(r.data.lines.map((l) => [l.key, l]));
      setLines((prev) => prev
        .filter((l) => !r.data.removedKeys.includes(l.key))
        .map((l) => { const p = byKey.get(l.key); return p && (p.unitPrice !== l.unitPrice || p.lineTotal !== l.lineTotal) ? { ...l, unitPrice: p.unitPrice, lineTotal: p.lineTotal } : l; }));
      setPriced(r.data);
    }, PRICE_DEBOUNCE_MS);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-price when the items or quantities change, not on every price correction
  }, [sig, fulfilment, device]);
  return priced;
}
