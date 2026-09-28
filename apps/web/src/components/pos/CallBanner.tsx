"use client";
import type { LiveCall } from "./useCallerId";

/** Incoming-call banners (POS-PLAN item 28), stacked - slides down over the till, never blocks it. */
export function CallBanner({ calls, onDismiss, onTakeOrder }: { calls: LiveCall[]; onDismiss: (id: string) => void; onTakeOrder: (call: LiveCall) => void }) {
  if (!calls.length) return null;
  return (
    <div className="pos-call-stack">
      {calls.map((c) => (
        <div key={c.id} className="pos-call-banner">
          <span className="pos-call-icon" aria-hidden>☎</span>
          <span className="pos-call-text">
            Incoming call · {c.phone}
            {c.customerName ? ` · ${c.customerName}` : ""}
            {typeof c.ordersCount === "number" ? ` · ${c.ordersCount} orders` : ""}
          </span>
          <button type="button" className="btn btn-primary" style={{ minHeight: 48 }} onClick={() => onTakeOrder(c)}>Take order</button>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => onDismiss(c.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
