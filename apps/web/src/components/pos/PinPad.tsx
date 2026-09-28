"use client";
import { useState } from "react";

/**
 * Numeric keypad for a manager PIN, built from the till's own .pos-keypad /
 * .pos-key styles (see CashPad). This component does not know a valid PIN
 * from an invalid one - the server does, via a 403 with a message - it only
 * collects one and shows whatever `error` the caller passes back.
 */
export function PinPad({
  label = "Manager PIN", busy, error, onSubmit, onCancel,
}: {
  label?: string;
  busy: boolean;
  error: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");

  return (
    <div className="pos-pinpad">
      <span className="pos-pinpad-label">{label}</span>
      <div className="pos-cash-display" style={{ fontSize: 26, letterSpacing: 6, justifyContent: "center" }}>
        {pin ? "•".repeat(pin.length) : " "}
      </div>
      <div className="pos-keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" className="pos-key" onClick={() => setPin((p) => (p.length < 8 ? p + d : p))}>{d}</button>
        ))}
        <button type="button" className="pos-key" style={{ fontSize: 14 }} onClick={() => setPin("")}>Clear</button>
        <button type="button" className="pos-key" onClick={() => setPin((p) => (p.length < 8 ? `${p}0` : p))}>0</button>
        <button type="button" className="pos-key" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Backspace">⌫</button>
      </div>
      {error ? <p className="fp-error">{error}</p> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 56, flex: 1 }} onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" style={{ minHeight: 56, flex: 2 }} disabled={pin.length < 4 || busy} onClick={() => onSubmit(pin)}>
          {busy ? "Checking…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
