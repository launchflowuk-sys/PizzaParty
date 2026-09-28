"use client";
import { useState } from "react";
import { gbp } from "@/lib/money";
import { DeliveryFields } from "./DeliveryFields";
import { DiscountPad } from "./DiscountPad";
import { TimePicker } from "./TimePicker";
import type { PosOrderState } from "./usePosOrder";

export function Basket({ order, onCharge }: { order: PosOrderState; onCharge: () => void }) {
  const [showDiscount, setShowDiscount] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!order.orderNote);
  /** Line notes are rare - collapsed to a small "+ Note" toggle so a basket of
   *  plain lines can show 6+ rows at once instead of an empty input each. */
  const [openLineNotes, setOpenLineNotes] = useState<Set<string>>(new Set());
  const { lines, priced, pricingLoading, pricingError } = order;
  const whenLabel = order.scheduledFor
    ? new Date(order.scheduledFor).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "ASAP";

  return (
    <aside className="pos-basket">
      {order.fulfilment === "delivery" ? <DeliveryFields address={order.address} onChange={order.setAddress} /> : null}

      <div className="pos-basket-lines">
        {lines.length === 0 ? <p style={{ color: "var(--color-neutral-700)", padding: "16px 4px" }}>Basket is empty.</p> : null}
        {lines.map((line) => {
          const priceLine = priced?.lines.find((l) => l.key === line.key);
          const noteOpenForLine = openLineNotes.has(line.key) || !!line.notes;
          return (
            <div key={line.key} className="pos-basket-line">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{line.name ?? line.product ?? line.deal}</span>
                <span style={{ fontWeight: 700 }}>{gbp(priceLine?.lineTotal ?? line.lineTotal ?? 0)}</span>
              </div>
              {line.detail ? <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{line.detail}</span> : null}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="pos-qtybtn" onClick={() => order.setQty(line.key, line.qty - 1)} aria-label="Decrease quantity">−</button>
                <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>{line.qty}</span>
                <button type="button" className="pos-qtybtn" onClick={() => order.setQty(line.key, line.qty + 1)} aria-label="Increase quantity">+</button>
                {noteOpenForLine ? null : (
                  <button type="button" className="btn btn-ghost" style={{ minHeight: 36, fontSize: 13 }} onClick={() => setOpenLineNotes((prev) => new Set(prev).add(line.key))}>
                    + Note
                  </button>
                )}
                <button type="button" className="btn btn-ghost" style={{ marginLeft: "auto", minHeight: 44 }} onClick={() => order.removeLine(line.key)}>Remove</button>
              </div>
              {noteOpenForLine ? (
                <input
                  className="input" style={{ minHeight: 40, fontSize: 13 }} placeholder="Line note" autoFocus={!line.notes}
                  value={line.notes ?? ""} onChange={(e) => order.setLineNote(line.key, e.target.value)}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="pos-basket-footer">
        <div className="pos-when-wrap">
          <button type="button" className="btn btn-secondary pos-when-btn" onClick={() => setShowTime((v) => !v)}>
            When: {whenLabel} ▾
          </button>
          {showTime ? (
            <div className="pos-when-popover">
              <TimePicker
                value={order.scheduledFor}
                showLabel={false}
                onChange={(v) => { order.setScheduledFor(v); setShowTime(false); }}
              />
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {noteOpen ? (
            <textarea
              className="input" style={{ minHeight: 44, flex: 1 }} autoFocus placeholder="Order note for the kitchen"
              value={order.orderNote} onChange={(e) => order.setOrderNote(e.target.value)}
            />
          ) : (
            <button type="button" className="btn btn-secondary pos-note-btn" onClick={() => setNoteOpen(true)}>
              {order.orderNote || "Add order note"}
            </button>
          )}
          <button
            type="button" className="btn btn-secondary" style={{ minHeight: 44, flexShrink: 0 }}
            onClick={() => setShowDiscount(true)}
          >
            {order.discount ? (order.discount.kind === "percent" ? `${order.discount.value}% off` : `${gbp(order.discount.value)} off`) : "Discount"}
          </button>
        </div>
        {showDiscount ? <DiscountPad current={order.discount} onApply={order.setDiscount} onClose={() => setShowDiscount(false)} /> : null}

        {pricingError ? <p className="fp-error" style={{ margin: 0, fontSize: 13 }}>{pricingError}</p> : null}
        {priced?.errors.length ? priced.errors.map((e, i) => <p key={i} className="fp-error" style={{ margin: 0, fontSize: 13 }}>{e}</p>) : null}

        <div style={{ borderTop: "1px solid var(--color-divider)", paddingTop: 8, display: "grid", gap: 4, fontSize: 14 }}>
          <Row label="Subtotal" value={priced?.subtotal} />
          {priced?.deliveryFee ? <Row label="Delivery fee" value={priced.deliveryFee} /> : null}
          {priced?.discount ? <Row label="Discount" value={-priced.discount} /> : null}
          {priced?.manualDiscount ? <Row label="Manager discount" value={-priced.manualDiscount} /> : null}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18 }}>
            <span>Total</span>
            <span>{gbp(priced?.total ?? 0)}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ minHeight: 64, fontSize: 17, justifyContent: "center" }}
          disabled={!lines.length || !priced || pricingLoading || !!priced.errors.length}
          onClick={onCharge}
        >
          {pricingLoading ? "Pricing…" : `Charge ${gbp(priced?.total ?? 0)}`}
        </button>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-neutral-700)" }}>
      <span>{label}</span>
      <span>{gbp(value ?? 0)}</span>
    </div>
  );
}
