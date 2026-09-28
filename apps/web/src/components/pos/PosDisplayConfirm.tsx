"use client";
import { gbp } from "@/lib/money";
import type { DisplayPayMethod } from "@/lib/pos-display-requests";
import type { DisplayExtra } from "./PosDisplayOrder";
import { Icon } from "./PosDisplayIcons";

/** What the customer can do while the till has handed them the order (POS-PLAN item 29). State lives in useCustomerDisplay. */
export type CustomerUi = {
  step: "confirm" | "pay" | "waiting";
  methods: DisplayPayMethod[];
  pending: boolean;
  wantsMore: boolean;
  note: string;
  upsell: DisplayExtra[];
  recent: { name: string } | null;
  onReady: () => void;
  onMore: () => void;
  onBack: () => void;
  onPay: (m: DisplayPayMethod) => void;
  onAdd: (e: DisplayExtra) => void;
  onUndo: () => void;
};

/** Middle column under the total: "Is your order complete?" then "How would you like to pay?". */
export function CustomerActions({ ui }: { ui: CustomerUi }) {
  if (ui.step === "waiting") {
    return <div className="cd-status" data-state="reader" role="status"><span>Starting your payment…</span></div>;
  }
  if (ui.step === "pay") {
    const card = ui.methods.includes("card");
    return (
      <>
        <div className="cd-ask">How would you like to pay?</div>
        {ui.note ? <p className="cd-note" role="alert">{ui.note}</p> : null}
        <div className="cd-tiles" data-n={card ? 4 : 1}>
          {card ? (
            <>
              <button type="button" className="cd-tile cd-tile-btn" disabled={ui.pending} onClick={() => ui.onPay("card")}>
                <Icon name="card" /><span className="cd-tile-label">Card</span><span className="cd-tile-sub">Contactless or chip</span>
              </button>
              <button type="button" className="cd-tile cd-tile-btn" disabled={ui.pending} onClick={() => ui.onPay("card")}><Icon name="apple" /><span className="cd-tile-label">Apple Pay</span></button>
              <button type="button" className="cd-tile cd-tile-btn" disabled={ui.pending} onClick={() => ui.onPay("card")}><Icon name="google" /><span className="cd-tile-label">Google Pay</span></button>
            </>
          ) : null}
          {ui.methods.includes("cash") ? (
            <button type="button" className="cd-tile cd-tile-btn cd-tile-cash" disabled={ui.pending} onClick={() => ui.onPay("cash")}><Icon name="cash" /><span className="cd-tile-label">Cash</span></button>
          ) : null}
        </div>
        <button type="button" className="cd-btn-ghost" onClick={ui.onBack}><Icon name="back" />Back to my order</button>
      </>
    );
  }
  return (
    <>
      {ui.note ? <p className="cd-note" role="alert">{ui.note}</p> : null}
      <button type="button" className="cd-status cd-btn-go" disabled={ui.pending} onClick={ui.onReady}>
        <span>{ui.pending ? "Updating your total…" : "Yes, I'm ready to pay"}</span>
        {ui.pending ? null : <Icon name="arrow" />}
      </button>
      <button type="button" className="cd-btn-more" onClick={ui.onMore}><Icon name="plus" />Add something else</button>
    </>
  );
}

/** Right-hand panel while handed over: one-tap add-ons, big photos and a big +. */
export function UpsellPanel({ ui }: { ui: CustomerUi }) {
  return (
    <aside className="cd-right cd-upsell" data-more={ui.wantsMore ? "1" : "0"}>
      <span className="cd-upsell-kicker">Goes great with your order</span>
      <span className="cd-upsell-title">Anything else?</span>
      <div className="cd-upsell-grid">
        {ui.upsell.map((e) => (
          <button key={e.slug} type="button" className="cd-upsell-card" aria-label={`Add ${e.name}, ${gbp(e.price)}`} onClick={() => ui.onAdd(e)}>
            {e.image ? <img src={e.image} alt="" /> : <span className="cd-upsell-noimg" aria-hidden="true">{e.name.slice(0, 1)}</span>}
            <span className="cd-upsell-name">{e.name}</span>
            <span className="cd-upsell-foot">
              <span className="cd-price-red">{gbp(e.price)}</span>
              <span className="cd-plus" aria-hidden="true"><Icon name="plus" /></span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

/** "Added ✓ - Undo" for a few seconds after a tap on an add-on. */
export function AddedToast({ ui }: { ui: CustomerUi }) {
  if (!ui.recent) return null;
  return (
    <div className="cd-added" role="status">
      <Icon name="check" />
      <span>Added {ui.recent.name}</span>
      <button type="button" onClick={ui.onUndo}>Undo</button>
    </div>
  );
}
