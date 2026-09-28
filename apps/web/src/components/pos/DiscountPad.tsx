"use client";
import { useState } from "react";
import type { PosDiscount } from "@/lib/pos-types";

/** Percent/amount, a reason, and a manager PIN - sent as-is in PosBasket.discount.
 *  The PIN is checked server-side; this panel does not know a valid PIN from an
 *  invalid one, it only collects one. */
export function DiscountPad({ current, onApply, onClose }: { current: PosDiscount | undefined; onApply: (d: PosDiscount | undefined) => void; onClose: () => void }) {
  const [kind, setKind] = useState<PosDiscount["kind"]>(current?.kind ?? "percent");
  const [value, setValue] = useState(current ? String(current.value) : "");
  const [reason, setReason] = useState(current?.reason ?? "");
  const [pin, setPin] = useState("");

  const numeric = Number(value);
  const canApply = numeric > 0 && reason.trim().length > 0 && pin.length >= 4;

  return (
    <div className="card" style={{ marginTop: 12, border: "2px solid var(--color-divider)", padding: 16 }}>
      <span style={{ fontWeight: 800, fontSize: 15 }}>Manager discount</span>

      <div className="seg" style={{ marginTop: 10 }}>
        <label className="seg-opt" style={{ minHeight: 48 }}>
          <input type="radio" checked={kind === "percent"} onChange={() => setKind("percent")} /> %
        </label>
        <label className="seg-opt" style={{ minHeight: 48 }}>
          <input type="radio" checked={kind === "amount"} onChange={() => setKind("amount")} /> £
        </label>
      </div>

      <input
        className="input" style={{ minHeight: 52, marginTop: 10 }} inputMode="decimal"
        placeholder={kind === "percent" ? "e.g. 10" : "e.g. 5.00"}
        value={value} onChange={(e) => setValue(e.target.value)}
      />
      <input className="input" style={{ minHeight: 52, marginTop: 10 }} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <input
        className="input" style={{ minHeight: 52, marginTop: 10 }} type="password" inputMode="numeric" maxLength={8}
        placeholder="Manager PIN" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {current ? (
          <button type="button" className="btn btn-secondary" style={{ minHeight: 52 }} onClick={() => { onApply(undefined); onClose(); }}>
            Remove discount
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" style={{ minHeight: 52 }} onClick={onClose}>Cancel</button>
        <button
          type="button" className="btn btn-primary" style={{ minHeight: 52, marginLeft: "auto" }}
          disabled={!canApply}
          onClick={() => {
            onApply({ kind, value: kind === "percent" ? numeric : Math.round(numeric * 100), reason: reason.trim(), managerPin: pin });
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
