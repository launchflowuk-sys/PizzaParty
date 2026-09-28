"use client";
import { useEffect, useMemo, useState } from "react";
import { gbp } from "@/lib/money";

/**
 * Next four "nice" round amounts above `total`, e.g. £12 -> £15, £20, £30, £50 -
 * the notes a till drawer actually holds, not just "total + a fiver".
 * ponytail: a rounding heuristic (nearest £5, then £10, then +£10, then next
 * £50), not a real denomination optimiser - good enough for a quick-cash row.
 */
/** No till takes more than £1,000 in notes for one order; stops a stuck key running away. */
const MAX_TENDER = 100_000;

function quickCashAmounts(totalPence: number): number[] {
  const a1 = Math.ceil((totalPence + 1) / 500) * 500;
  let a2 = Math.ceil((a1 + 1) / 1000) * 1000;
  if (a2 <= a1) a2 += 1000;
  const a3 = a2 + 1000;
  const a4 = a3 < 5000 ? 5000 : Math.ceil((a3 + 1) / 5000) * 5000;
  return [a1, a2, a3, a4];
}

/** Cash panel. `remaining` is what is still owed on the order; `amount` (editable,
 *  defaults to all of it) is how much this cash payment covers - lower it for a
 *  split, leaving the rest for a reader payment. Tendered is built digit-by-digit
 *  from a numeric keypad, pence in from the right (like a real till), and change
 *  is tendered minus amount, shown very large per the spec. */
export function CashPad({ remaining, busy, error, onConfirm, onBack, onTenderChange }: { remaining: number; busy: boolean; error: string; onConfirm: (amount: number, tendered: number) => void; onBack: () => void; onTenderChange?: (amount: number, tendered: number, change: number) => void }) {
  const [amount, setAmount] = useState(remaining);
  const [tendered, setTendered] = useState(remaining);
  // The first key press replaces the prefilled amount instead of appending to it.
  const [typing, setTyping] = useState(false);

  const change = Math.max(0, tendered - amount);
  const short = Math.max(0, amount - tendered);
  const canConfirm = amount > 0 && amount <= remaining && tendered >= amount;
  const quick = useMemo(() => quickCashAmounts(amount), [amount]);

  // Customer display (POS-PLAN item 29): mirror the tendered/change figures live
  // as staff type, lightly debounced so every single keypress doesn't post a
  // display message (channel + server relay).
  useEffect(() => {
    if (!onTenderChange) return;
    const t = setTimeout(() => onTenderChange(amount, tendered, change), 120);
    return () => clearTimeout(t);
  }, [amount, tendered, change, onTenderChange]);

  // Enter confirms (POS-PLAN item 33) - never while typing into the amount field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (e.key !== "Enter" || tag === "input" || tag === "textarea" || !canConfirm || busy) return;
      e.preventDefault();
      onConfirm(amount, tendered);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canConfirm, busy, amount, tendered, onConfirm]);

  function key(next: (prev: number) => number) {
    setTendered((prev) => Math.min(MAX_TENDER, next(typing ? prev : 0)));
    setTyping(true);
  }
  function pick(pence: number) { setTendered(pence); setTyping(false); }

  return (
    <div className="pos-cash">
      <div>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onBack}>Back</button>
      <h3 style={{ marginTop: 8 }}>Cash</h3>

      {remaining > amount || amount !== remaining ? (
        <label className="field">
          <span>Amount to take now (of {gbp(remaining)} owed)</span>
          <input
            className="input" style={{ minHeight: 52, fontSize: 18 }} inputMode="numeric"
            value={(amount / 100).toFixed(2)}
            onChange={(e) => { const p = Math.round(Number(e.target.value) * 100); if (!Number.isNaN(p)) { setAmount(Math.min(p, remaining)); pick(Math.min(p, remaining)); } }}
          />
        </label>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        {quick.map((q) => (
          <button key={q} type="button" className="btn btn-secondary" style={{ minHeight: 60, flex: 1 }} onClick={() => pick(q)}>{gbp(q)}</button>
        ))}
        <button type="button" className="btn btn-secondary" style={{ minHeight: 60, flex: 1 }} onClick={() => pick(amount)}>Exact</button>
      </div>

      <div className="pos-cash-display">
        <span>{gbp(tendered)}</span>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 36, fontSize: 13 }} onClick={() => pick(0)}>Clear</button>
      </div>

      <div className="pos-keypad" style={{ margin: "10px 0" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" className="pos-key" onClick={() => key((t) => t * 10 + d)}>{d}</button>
        ))}
        <button type="button" className="pos-key" onClick={() => key((t) => t * 100)}>00</button>
        <button type="button" className="pos-key" onClick={() => key((t) => t * 10)}>0</button>
        <button type="button" className="pos-key" onClick={() => key((t) => Math.floor(t / 10))} aria-label="Backspace">⌫</button>
      </div>
      </div>

      <div className="pos-cash-result">
      <div style={{ textAlign: "center" }}>
        {short > 0 ? (
          <>
            <span style={{ fontSize: 13, color: "var(--color-neutral-700)", display: "block" }}>SHORT</span>
            <span className="pos-bignum fp-error">{gbp(short)} short</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, color: "var(--color-neutral-700)", display: "block" }}>CHANGE DUE</span>
            <span className="pos-bignum" style={{ color: "var(--color-action)" }}>{gbp(change)}</span>
          </>
        )}
      </div>

      {error ? <p className="fp-error">{error}</p> : null}

      <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 64, fontSize: 17, justifyContent: "center", marginTop: 16 }} disabled={!canConfirm || busy} onClick={() => onConfirm(amount, tendered)}>
        {busy ? "Recording…" : `Confirm ${gbp(amount)} cash`}
      </button>
      </div>
    </div>
  );
}
