"use client";
import { useMemo, useState } from "react";
import { gbp } from "@/lib/money";
import type { PosBootstrap, PosCreateOrder, PosOrderRef, PosPayment, PosPaymentKind } from "@/lib/pos-types";
import type { PosCreateOrderExtras, PosDisplayMessage } from "@/lib/pos-phase4-types";
import { CashPad } from "./CashPad";
import { ReaderPay } from "./ReaderPay";
import type { PosOrderState } from "./usePosOrder";
import type { OrderTypeTab, PosCategory, PosDeal } from "./pos-client-types";
import { priceOffline } from "./offline-pricing";
import { saveOfflineOrder } from "./offline-store";
import { printOfflineTicket } from "./offline-ticket";

type Stage = { kind: "choose" } | { kind: "cash" } | { kind: "reader" } | { kind: "done" } | { kind: "offline-done" };

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** PosBasket.fulfilment is already PosFulfilment (lib/pos-queue-types.ts), so
 *  PosCreateOrder needs no field override here any more - just the Phase 4 extras. */
type PosCreateOrderPhase4 = PosCreateOrder & PosCreateOrderExtras;

/**
 * Charge screen. Creates the order once (with whatever payment method was
 * picked first), then - for cash or reader - takes the actual payment against
 * it. A split simply means: pay part of it, land back on "choose" with the
 * order's own paid/total telling us what's left, pay the rest a different way.
 *
 * Offline (POS-PLAN item 30): no order is created at all until the till is
 * back online - "choose" skips straight to a local save, priced from the
 * menu data already on the page (offline-pricing.ts) rather than the server.
 */
export function PayPanel({
  order, orderType, boot, onDone, onBack, liveEvent, offline, categories, deals, display, onOfflineSaved, logoUrl,
}: {
  order: PosOrderState;
  orderType: OrderTypeTab;
  boot: PosBootstrap | null;
  onDone: () => void;
  onBack: () => void;
  liveEvent?: { orderId: string; kind: string } | null;
  offline?: boolean;
  categories: PosCategory[];
  deals: PosDeal[];
  display?: (msg: PosDisplayMessage) => void;
  /** Tells the TopBar's unsent-order badge (PosScreen's useOfflineQueue) to recount right away, rather than waiting for the till to come back online. */
  onOfflineSaved?: () => void;
  /** Shop logo, shown on the order-taken success screen. */
  logoUrl?: string;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "choose" });
  const [orderRef, setOrderRef] = useState<PosOrderRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offlineChange, setOfflineChange] = useState<number | null>(null);

  const offlinePriced = useMemo(() => (offline ? priceOffline(order.lines, categories, deals) : null), [offline, order.lines, categories, deals]);
  const total = offline ? (offlinePriced?.total ?? 0) : (order.priced?.total ?? 0);
  const remaining = orderRef ? orderRef.total - orderRef.paid : total;
  const shopName = boot?.shopName ?? "";

  function buildBody(payment: PosPaymentKind, clientRequestId: string, createdOfflineAt?: string): PosCreateOrderPhase4 {
    return {
      ...order.posBasket,
      fulfilment: orderType === "eat_in" ? "eat_in" : order.posBasket.fulfilment,
      tableNumber: orderType === "eat_in" ? order.tableNumber : undefined,
      clientRequestId,
      createdOfflineAt,
      source: orderType === "phone" ? "phone" : "pos",
      customer: { name: order.customer?.name || order.walkInName || "Walk-in", phone: order.customer?.phone || order.offlinePhone || undefined, email: order.customer?.email || undefined },
      address: order.fulfilment === "delivery" ? { line1: order.address.line1, line2: order.address.line2 || undefined, city: order.address.city || undefined, postcode: order.address.postcode } : undefined,
      notes: order.orderNote || undefined,
      scheduledFor: order.scheduledFor,
      payment,
    };
  }

  async function chooseMethod(payment: PosPaymentKind) {
    if (offline) {
      if (payment === "later") {
        setBusy(true); setError("");
        try {
          const id = crypto.randomUUID();
          const at = new Date().toISOString();
          await saveOfflineOrder({ clientRequestId: id, createdOfflineAt: at, body: buildBody("later", id, at), offlineTotal: total, synced: false });
          display?.({ type: "idle", shopName });
          onOfflineSaved?.();
          setStage({ kind: "offline-done" });
        } catch {
          setError("Could not save this order offline.");
        } finally {
          setBusy(false);
        }
        return;
      }
      setStage({ kind: "cash" });
      return;
    }
    if (orderRef) {
      // Order already exists (this is a split's second leg) - go straight to
      // taking the payment, no second order to create.
      setStage(payment === "cash" ? { kind: "cash" } : { kind: "reader" });
      return;
    }
    setBusy(true); setError("");
    try {
      const body: PosCreateOrderPhase4 = buildBody(payment, crypto.randomUUID());
      const r = await fetch("/api/pos/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json()) as PosOrderRef | { error?: string };
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not create the order.");
      setOrderRef(d as PosOrderRef);
      if (payment === "cash") display?.({ type: "paying", total: remaining, method: "cash" });
      if (payment === "reader") display?.({ type: "paying", total: remaining, method: "reader" });
      setStage(payment === "later" ? { kind: "done" } : payment === "cash" ? { kind: "cash" } : { kind: "reader" });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCash(amount: number, tendered: number) {
    if (offline) {
      setBusy(true); setError("");
      try {
        const id = crypto.randomUUID();
        const at = new Date().toISOString();
        await saveOfflineOrder({ clientRequestId: id, createdOfflineAt: at, body: buildBody("cash", id, at), cash: { amount, tendered }, offlineTotal: total, synced: false });
        setOfflineChange(Math.max(0, tendered - amount));
        display?.({ type: "idle", shopName });
        onOfflineSaved?.();
        setStage({ kind: "offline-done" });
      } catch {
        setError("Could not save this order offline.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!orderRef) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderRef.id}/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "cash", amount, tendered }) });
      const d = (await r.json()) as PosPayment | { error?: string };
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not record the cash payment.");
      const nextRef = (d as PosPayment).order;
      setOrderRef(nextRef);
      if (nextRef.paid >= nextRef.total) display?.({ type: "paid", orderNumber: nextRef.number, change: Math.max(0, tendered - amount) });
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
        {logoUrl ? <img src={logoUrl} alt="" className="pos-success-logo" /> : null}
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

  if (stage.kind === "offline-done") {
    const label = orderType === "eat_in" ? `Eat in${order.tableNumber ? ` · Table ${order.tableNumber}` : ""}` : orderType === "phone" ? "Phone" : "Collection";
    return (
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <span className="pos-bignum" style={{ fontSize: 32 }}>Saved offline</span>
        <p style={{ marginTop: 8 }}>This order is queued and will send the moment the till is back online.</p>
        {offlineChange !== null && offlineChange > 0 ? <p style={{ fontWeight: 800, fontSize: 20 }}>Change due: {gbp(offlineChange)}</p> : null}
        <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "center" }}>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 60 }} onClick={() => offlinePriced && printOfflineTicket(shopName, label, offlinePriced, order.orderNote)}>
            Print offline ticket
          </button>
          <button type="button" className="btn btn-primary" style={{ minHeight: 60 }} onClick={onDone}>New order</button>
        </div>
      </div>
    );
  }

  if (stage.kind === "cash") {
    return (
      <CashPad
        remaining={remaining} busy={busy} error={error} onConfirm={confirmCash} onBack={() => setStage({ kind: "choose" })}
        onTenderChange={(cashAmount, tendered, change) => display?.({ type: "paying", total: cashAmount, method: "cash", tendered, change })}
      />
    );
  }

  if (stage.kind === "reader") {
    return (
      <ReaderPay
        orderId={orderRef!.id}
        remaining={remaining}
        readers={boot?.readers ?? []}
        onSuccess={(o) => { setOrderRef(o); if (o.paid >= o.total) display?.({ type: "paid", orderNumber: o.number }); setStage(o.paid >= o.total ? { kind: "done" } : { kind: "choose" }); }}
        onBack={() => setStage({ kind: "choose" })}
        liveEvent={liveEvent}
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
        {!offline ? (
          <button type="button" className="btn btn-primary" style={{ minHeight: 64, fontSize: 17 }} disabled={busy} onClick={() => chooseMethod("reader")}>Card reader</button>
        ) : null}
        {(offline || (orderType === "phone" && !orderRef)) ? (
          <button type="button" className="btn btn-secondary" style={{ minHeight: 64, fontSize: 17 }} disabled={busy} onClick={() => chooseMethod("later")}>
            Pay on collection / delivery
          </button>
        ) : null}
      </div>
    </div>
  );
}
