"use client";
import { useState } from "react";
import { gbp } from "@/lib/money";

/** No till figure (float, pay-in/out, counted, settle) needs more than this. */
const MAX_AMOUNT = 100_000;

/**
 * A single-amount numeric keypad - pence in from the right, like CashPad's
 * tendered side, but with no tendered/change split. Reused wherever the till
 * just needs one pence figure: the drawer's float, a pay-in/pay-out, a count,
 * a driver settle.
 */
export function AmountKeypad({
  initial = 0, max = MAX_AMOUNT, confirmLabel, busy, error, onConfirm, onBack,
}: {
  initial?: number;
  max?: number;
  confirmLabel: (amount: number) => string;
  busy: boolean;
  error: string;
  onConfirm: (amount: number) => void;
  onBack: () => void;
}) {
  const [amount, setAmount] = useState(initial);
  const [typing, setTyping] = useState(false);

  function key(next: (prev: number) => number) {
    setAmount((prev) => Math.min(max, next(typing ? prev : 0)));
    setTyping(true);
  }

  return (
    <div style={{ maxWidth: 340 }}>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onBack}>Back</button>

      <div className="pos-cash-display" style={{ marginTop: 12 }}>
        <span>{gbp(amount)}</span>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 36, fontSize: 13 }} onClick={() => { setAmount(0); setTyping(true); }}>Clear</button>
      </div>

      <div className="pos-keypad" style={{ margin: "10px 0" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" className="pos-key" onClick={() => key((t) => t * 10 + d)}>{d}</button>
        ))}
        <button type="button" className="pos-key" onClick={() => key((t) => t * 100)}>00</button>
        <button type="button" className="pos-key" onClick={() => key((t) => t * 10)}>0</button>
        <button type="button" className="pos-key" onClick={() => key((t) => Math.floor(t / 10))} aria-label="Backspace">⌫</button>
      </div>

      {error ? <p className="fp-error">{error}</p> : null}
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ minHeight: 64, justifyContent: "center", marginTop: 12 }}
        disabled={amount <= 0 || busy}
        onClick={() => onConfirm(amount)}
      >
        {busy ? "Working…" : confirmLabel(amount)}
      </button>
    </div>
  );
}
