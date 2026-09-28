"use client";
import { useState } from "react";
import { gbp } from "@/lib/money";
import type { PosOrderRef, PosPayment, PosReader } from "@/lib/pos-types";
import { CashPad } from "./CashPad";
import { ReaderPay } from "./ReaderPay";

type Stage = { kind: "choose" } | { kind: "cash" } | { kind: "reader" };

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** Take the balance on an order already in the kitchen (queue item 19) - same
 *  CashPad / ReaderPay the till's own PayPanel uses, aimed at an existing
 *  order id instead of one PayPanel is about to create. */
export function TakePaymentPanel({
  orderId, remaining, readers, onDone, onCancel,
}: {
  orderId: string;
  remaining: number;
  readers: PosReader[];
  onDone: (order: PosOrderRef) => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "choose" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmCash(amount: number, tendered: number) {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "cash", amount, tendered }) });
      const d = (await r.json()) as PosPayment | { error?: string };
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not record the cash payment.");
      onDone((d as PosPayment).order);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (stage.kind === "cash") return <CashPad remaining={remaining} busy={busy} error={error} onConfirm={confirmCash} onBack={() => setStage({ kind: "choose" })} />;
  if (stage.kind === "reader") return <ReaderPay orderId={orderId} remaining={remaining} readers={readers} onSuccess={onDone} onBack={() => setStage({ kind: "choose" })} />;

  return (
    <div style={{ maxWidth: 420 }}>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onCancel}>Back</button>
      <div style={{ textAlign: "center", margin: "16px 0" }}>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>Balance owed</span>
        <span className="pos-bignum" style={{ display: "block" }}>{gbp(remaining)}</span>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 64, fontSize: 17 }} onClick={() => setStage({ kind: "cash" })}>Cash</button>
        <button type="button" className="btn btn-primary" style={{ minHeight: 64, fontSize: 17 }} disabled={!readers.length} onClick={() => setStage({ kind: "reader" })}>
          {readers.length ? "Card reader" : "Card reader (none set up)"}
        </button>
      </div>
    </div>
  );
}
