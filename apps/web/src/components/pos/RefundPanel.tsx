"use client";
import { useState } from "react";
import { gbp } from "@/lib/money";
import type { PosOrderPayment } from "@/lib/pos-queue-types";
import { PinPad } from "./PinPad";

const REASONS = ["Customer complaint", "Order cancelled", "Item missing", "Goodwill", "Overcharged", "Other"];

/** Amount keypad -> which payment (if more than one can cover it) -> reason ->
 *  manager PIN -> POST .../refund. Manager PIN is always required (contract). */
export function RefundPanel({
  refundDue, paid, payments, busy, error, onConfirm, onCancel,
}: {
  refundDue: number;
  paid: number;
  payments: PosOrderPayment[];
  busy: boolean;
  error: string;
  onConfirm: (amount: number, reason: string, managerPin: string, paymentId?: string) => void;
  onCancel: () => void;
}) {
  const refundable = payments.filter((p) => p.refundable > 0);
  const defaultAmount = refundDue > 0 ? refundDue : paid;
  const [amountStr, setAmountStr] = useState((defaultAmount / 100).toFixed(2));
  const [paymentId, setPaymentId] = useState<string | undefined>(refundable.length === 1 ? refundable[0]!.id : undefined);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [showPin, setShowPin] = useState(false);

  const amount = Math.round((Number(amountStr) || 0) * 100);
  const finalReason = (reason === "Other" ? customReason : reason).trim();
  const cap = paymentId
    ? (refundable.find((p) => p.id === paymentId)?.refundable ?? 0)
    : Math.max(0, ...refundable.map((p) => p.refundable));
  const canSubmit = amount > 0 && amount <= cap && finalReason.length > 1;

  if (showPin) {
    return (
      <PinPad
        label={`Refund ${gbp(amount)}`}
        busy={busy}
        error={error}
        onCancel={() => setShowPin(false)}
        onSubmit={(pin) => onConfirm(amount, finalReason, pin, paymentId)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 440 }}>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onCancel}>Back</button>
      <h3 style={{ marginTop: 8 }}>Refund</h3>

      {refundable.length === 0 ? (
        <p className="fp-error">Nothing on this order can be refunded.</p>
      ) : (
        <>
          <label className="field">
            <span>Amount</span>
            <input className="input" style={{ minHeight: 52, fontSize: 18 }} inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
          </label>
          {cap > 0 ? <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "4px 0 0" }}>Up to {gbp(cap)} on {paymentId ? "that payment" : "a single payment"}.</p> : null}

          {refundable.length > 1 ? (
            <div className="pos-chip-row">
              {refundable.map((p) => (
                <button key={p.id} type="button" className="pos-chip" data-state={paymentId === p.id ? "whole" : undefined} onClick={() => setPaymentId(p.id)}>
                  <span style={{ textTransform: "capitalize" }}>{p.kind}</span>
                  <span className="pos-chip-sub">{gbp(p.refundable)} left</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="pos-chip-row" style={{ marginTop: 10 }}>
            {REASONS.map((r) => (
              <button key={r} type="button" className="pos-chip" data-state={reason === r ? "whole" : undefined} onClick={() => setReason(r)}>{r}</button>
            ))}
          </div>
          {reason === "Other" ? (
            <input className="input" style={{ minHeight: 48, marginTop: 8 }} placeholder="Reason" value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
          ) : null}

          {error ? <p className="fp-error">{error}</p> : null}
          <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 64, justifyContent: "center", marginTop: 16 }} disabled={!canSubmit} onClick={() => setShowPin(true)}>
            Continue to manager PIN
          </button>
        </>
      )}
    </div>
  );
}
