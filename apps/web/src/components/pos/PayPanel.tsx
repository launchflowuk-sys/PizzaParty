"use client";
import { useState } from "react";
import { gbp } from "@/lib/money";
import type { PosBootstrap, PosCreateOrder, PosOrderRef, PosPayment, PosPaymentKind } from "@/lib/pos-types";
import { CashPad } from "./CashPad";
import { ReaderPay } from "./ReaderPay";
import type { PosOrderState } from "./usePosOrder";
import type { OrderTypeTab } from "./pos-client-types";

type Stage = { kind: "choose" } | { kind: "cash" } | { kind: "reader" } | { kind: "done" };

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/**
 * Charge screen. Creates the order once (with whatever payment method was
 * picked first), then - for cash or reader - takes the actual payment against
 * it. A split simply means: pay part of it, land back on "choose" with the
 * order's own paid/total telling us what's left, pay the rest a different way.
 */
export function PayPanel({ order, orderType, boot, onDone, onBack }: { order: PosOrderState; orderType: OrderTypeTab; boot: PosBootstrap | null; onDone: () => void; onBack: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: "choose" });
  const [orderRef, setOrderRef] = useState<PosOrderRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = order.priced?.total ?? 0;
  const remaining = orderRef ? orderRef.total - orderRef.paid : total;

  async function chooseMethod(payment: PosPaymentKind) {
    if (orderRef) {
      // Order already exists (this is a split's second leg) - go straight to
      // taking the payment, no second order to create.
      setStage(payment === "cash" ? { kind: "cash" } : { kind: "reader" });
      return;
    }
    setBusy(true); setError("");
    try {
      const body: PosCreateOrder = {
        ...order.posBasket,
        source: orderType === "phone" ? "phone" : "pos",
        customer: { name: order.customer?.name || order.walkInName || "Walk-in", phone: order.customer?.phone, email: order.customer?.email || undefined },
        address: order.fulfilment === "delivery" ? { line1: order.address.line1, line2: order.address.line2 || undefined, city: order.address.city || undefined, postcode: order.address.postcode } : undefined,
        notes: order.orderNote || undefined,
        scheduledFor: order.scheduledFor,
        payment,
      };
      const r = await fetch("/api/pos/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json()) as PosOrderRef | { error?: string };
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not create the order.");
      setOrderRef(d as PosOrderRef);
      setStage(payment === "later" ? { kind: "done" } : payment === "cash" ? { kind: "cash" } : { kind: "reader" });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCash(amount: number, tendered: number) {
    if (!orderRef) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderRef.id}/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "cash", amount, tendered }) });
      const d = (await r.json()) as PosPayment | { error?: string };
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not record the cash payment.");
      const nextRef = (d as PosPayment).order;
      setOrderRef(nextRef);
      setStage(nextRef.paid >= nextRef.total ? { kind: "done" } : { kind: "choose" });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (stage.kind === "done" && orderRef) {
    return (
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <span className="pos-bignum">#{orderRef.number}</span>
        <p style={{ marginTop: 8 }}>Order taken. Kitchen ticket is printing.</p>
        <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "center" }}>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 60 }} onClick={() => window.open(`/kitchen/print/${orderRef.id}?copy=customer`, "_blank")}>
            Print receipt
          </button>
          <button type="button" className="btn btn-primary" style={{ minHeight: 60 }} onClick={onDone}>New order</button>
        </div>
      </div>
    );
  }

  if (stage.kind === "cash") return <CashPad remaining={remaining} busy={busy} error={error} onConfirm={confirmCash} onBack={() => setStage({ kind: "choose" })} />;

  if (stage.kind === "reader") {
    return (
      <ReaderPay
        orderId={orderRef!.id}
        remaining={remaining}
        readers={boot?.readers ?? []}
        onSuccess={(o) => { setOrderRef(o); setStage(o.paid >= o.total ? { kind: "done" } : { kind: "choose" }); }}
        onBack={() => setStage({ kind: "choose" })}
      />
    );
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onBack}>Back to order (Esc)</button>
      <div style={{ textAlign: "center", margin: "16px 0" }}>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{orderRef ? "Remaining" : "Total"}</span>
        <span className="pos-bignum" style={{ display: "block" }}>{gbp(remaining)}</span>
      </div>
      {error ? <p className="fp-error">{error}</p> : null}
      <div style={{ display: "grid", gap: 12 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 64, fontSize: 17 }} disabled={busy} onClick={() => chooseMethod("cash")}>Cash</button>
        <button type="button" className="btn btn-primary" style={{ minHeight: 64, fontSize: 17 }} disabled={busy} onClick={() => chooseMethod("reader")}>Card reader</button>
        {orderType === "phone" && !orderRef ? (
          <button type="button" className="btn btn-secondary" style={{ minHeight: 64, fontSize: 17 }} disabled={busy} onClick={() => chooseMethod("later")}>
            Pay on collection / delivery
          </button>
        ) : null}
      </div>
    </div>
  );
}
