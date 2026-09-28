"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/money";
import type { BasketLine } from "@/lib/basket-types";
import type { PosOrderRef, PosReader } from "@/lib/pos-types";
import type {
  PosDriverResult, PosEditResult, PosOrderDetail, PosReprintResult, PosRefundResult, PosStatusMove,
  PrintCopy, QueueDriver, QueueOrder,
} from "@/lib/pos-queue-types";
import { PAID_LABEL, PAID_TAG, SOURCE_LABEL, SOURCE_TAG, STATUS_LABEL, fmtTime } from "./queue-ui";
import { AddItemsPanel } from "./AddItemsPanel";
import { TakePaymentPanel } from "./TakePaymentPanel";
import { RefundPanel } from "./RefundPanel";
import { PinPad } from "./PinPad";
import type { PosCategory, PosDeal } from "./pos-client-types";

const ETA_CHIPS = [15, 20, 30, 45, 60];
const REJECT_REASONS = ["Too busy", "Item unavailable", "Outside delivery area", "Closing soon", "Other"];
const VOID_REASONS = ["Customer changed mind", "Wrong item", "Out of stock", "Other"];
/** Simple one-tap moves. Accept and reject/cancel get their own UI below (ETA chips, reason chips). */
type SimpleStatus = "preparing" | "ready" | "out_for_delivery" | "completed";
const STATUS_ACTION_LABEL: Record<SimpleStatus, string> = {
  preparing: "Start cooking", ready: "Ready", out_for_delivery: "Out for delivery", completed: "Complete",
};
const DETAIL_POLL_MS = 4000;

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}
async function readJson<T>(r: Response): Promise<T | { error: string }> {
  try { return await r.json(); } catch { return { error: "Unexpected response from the server." }; }
}

type Mode = { kind: "detail" } | { kind: "add-items" } | { kind: "pay" } | { kind: "refund" };

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 800 : 400, fontSize: bold ? 16 : 14 }}>
      <span>{label}</span>
      <span>{gbp(value)}</span>
    </div>
  );
}

/**
 * The queue's order panel (queue items 17-22): everything GET
 * /api/pos/orders/:id returns, plus every action gated by that response's own
 * `next` / `editable` / `voidNeedsPin` flags - never a client-side guess at
 * what the order's state allows.
 */
export function OrderPanel({
  orderId, drivers, readers, categories, deals, onClose, onOrderUpdated, onDriversUpdated,
}: {
  orderId: string;
  drivers: QueueDriver[];
  readers: PosReader[];
  categories: PosCategory[];
  deals: PosDeal[];
  onClose: () => void;
  onOrderUpdated: (o: QueueOrder) => void;
  onDriversUpdated: (d: QueueDriver[]) => void;
}) {
  const [detail, setDetail] = useState<PosOrderDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<Mode>({ kind: "detail" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const [rejectPick, setRejectPick] = useState<"rejected" | "cancelled" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectCustom, setRejectCustom] = useState("");
  const [rejectPin, setRejectPin] = useState(false);

  const [voidLineId, setVoidLineId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidCustom, setVoidCustom] = useState("");
  const [voidPin, setVoidPin] = useState(false);

  const onOrderUpdatedRef = useRef(onOrderUpdated);
  onOrderUpdatedRef.current = onOrderUpdated;

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/pos/orders/${orderId}`, { cache: "no-store" });
      const d = await readJson<PosOrderDetail>(r);
      if (!r.ok || "error" in d) { setLoadError((d as { error?: string }).error ?? "Could not load this order."); return; }
      setDetail(d as PosOrderDetail);
      setLoadError("");
      onOrderUpdatedRef.current(d as PosOrderDetail);
    } catch {
      setLoadError("Could not reach the server.");
    }
  }, [orderId]);

  useEffect(() => {
    void load();
    const t = setInterval(load, DETAIL_POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // A different order was opened - drop whatever transient UI (void reasons, reject picker) belonged to the last one.
  useEffect(() => {
    setMode({ kind: "detail" }); setActionError(""); setWarnings([]);
    setRejectPick(null); setRejectReason(""); setRejectCustom(""); setRejectPin(false);
    setVoidLineId(null); setVoidReason(""); setVoidCustom(""); setVoidPin(false);
  }, [orderId]);

  /** Rejecting or cancelling an order with money already taken needs a manager
   *  (owner's call - every refund needs one), same 403 { needsPin: true } shape
   *  as a void past the point the kitchen has started. */
  async function runStatus(move: PosStatusMove) {
    setBusy(true); setActionError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(move) });
      const d = await readJson<QueueOrder>(r);
      if (!r.ok || "error" in d) {
        const err = d as { error?: string; needsPin?: boolean };
        if (err.needsPin) { setRejectPin(true); setActionError(err.error ?? "Manager PIN needed."); return; }
        throw new Error(err.error ?? "Could not update the order.");
      }
      setRejectPick(null); setRejectReason(""); setRejectCustom(""); setRejectPin(false);
      await load();
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runDriver(driverId: string | null) {
    setBusy(true); setActionError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/driver`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ driverId }) });
      const d = await readJson<PosDriverResult>(r);
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not assign the driver.");
      onDriversUpdated((d as PosDriverResult).drivers);
      await load();
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runVoid(orderItemId: string, reason: string, managerPin?: string) {
    setBusy(true); setActionError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/edit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ remove: [{ orderItemId, reason }], managerPin }) });
      const d = await readJson<PosEditResult>(r);
      if (!r.ok || "error" in d) {
        const err = d as { error?: string; needsPin?: boolean };
        if (err.needsPin) { setVoidPin(true); setActionError(err.error ?? "Manager PIN needed."); return; }
        throw new Error(err.error ?? "Could not void that item.");
      }
      const res = d as PosEditResult;
      setDetail(res.order); onOrderUpdatedRef.current(res.order);
      setWarnings(res.warnings);
      setVoidLineId(null); setVoidReason(""); setVoidCustom(""); setVoidPin(false);
      window.open(res.changeTicketUrl, "_blank");
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runAddItems(lines: BasketLine[]) {
    setBusy(true); setActionError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/edit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ add: lines }) });
      const d = await readJson<PosEditResult>(r);
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not add those items.");
      const res = d as PosEditResult;
      setDetail(res.order); onOrderUpdatedRef.current(res.order);
      setWarnings(res.warnings);
      window.open(res.changeTicketUrl, "_blank");
      setMode({ kind: "detail" });
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runRefund(amount: number, reason: string, managerPin: string, paymentId?: string) {
    setBusy(true); setActionError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/refund`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount, reason, managerPin, paymentId }) });
      const d = await readJson<PosRefundResult>(r);
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not process the refund.");
      const res = d as PosRefundResult;
      setDetail(res.order); onOrderUpdatedRef.current(res.order);
      setMode({ kind: "detail" });
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runReprint(copy: PrintCopy) {
    setBusy(true); setActionError("");
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/reprint`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ copy }) });
      const d = await readJson<PosReprintResult>(r);
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not reprint.");
      window.open((d as PosReprintResult).printUrl, "_blank");
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onPaid(_ref: PosOrderRef) {
    setMode({ kind: "detail" });
    void load();
  }

  return (
    <div className="pos-slideover-backdrop" onClick={onClose}>
      <aside className="pos-slideover" onClick={(e) => e.stopPropagation()}>
        <div className="pos-slideover-head">
          <span className="pos-bignum" style={{ fontSize: 26 }}>{detail ? `#${detail.number}` : "…"}</span>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onClose}>Close</button>
        </div>

        {loadError ? <p className="fp-error" style={{ padding: "0 16px" }}>{loadError}</p> : null}

        {!detail ? (
          <p style={{ padding: 16 }}>Loading…</p>
        ) : mode.kind === "add-items" ? (
          <AddItemsPanel categories={categories} deals={deals} busy={busy} onSend={runAddItems} onCancel={() => { setActionError(""); setMode({ kind: "detail" }); }} />
        ) : mode.kind === "pay" ? (
          <div style={{ padding: 16, overflowY: "auto" }}>
            {actionError ? <p className="fp-error">{actionError}</p> : null}
            <TakePaymentPanel orderId={orderId} remaining={detail.balance} readers={readers} onCancel={() => { setActionError(""); setMode({ kind: "detail" }); }} onDone={onPaid} />
          </div>
        ) : mode.kind === "refund" ? (
          <div style={{ padding: 16, overflowY: "auto" }}>
            <RefundPanel refundDue={detail.refundDue} paid={detail.paid} payments={detail.payments} busy={busy} error={actionError} onCancel={() => { setActionError(""); setMode({ kind: "detail" }); }} onConfirm={runRefund} />
          </div>
        ) : (
          <div className="pos-slideover-body">
            <div className="pos-osection">
              <div className="pos-q-card-row">
                <span className={`tag ${SOURCE_TAG[detail.source]}`}>{SOURCE_LABEL[detail.source]}</span>
                <span className="tag tag-neutral">{detail.fulfilment === "delivery" ? "Delivery" : "Collection"}</span>
                <span className={`tag ${PAID_TAG[detail.paidState]}`}>{PAID_LABEL[detail.paidState]}</span>
                {detail.amendedAt ? <span className="tag tag-warn">Amended {fmtTime(detail.amendedAt)}</span> : null}
              </div>
              <span style={{ fontWeight: 700 }}>{detail.customerName} · <a href={`tel:${detail.customerPhone}`}>{detail.customerPhone}</a></span>
              {detail.address ? <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{detail.address}</span> : null}
              {detail.driver ? <span style={{ fontSize: 13 }}>Driver: {detail.driver.name}</span> : null}
              <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                {detail.dueAt ? `${detail.scheduled ? "For" : "Due"} ${fmtTime(detail.dueAt)}` : "ASAP"} · placed {fmtTime(detail.placedAt)}
              </span>
              {detail.notes ? <span style={{ fontSize: 13 }}>Note: {detail.notes}</span> : null}
              {detail.rejectReason ? <span style={{ fontSize: 13, color: "var(--danger)" }}>Rejected: {detail.rejectReason}</span> : null}
            </div>

            {warnings.length ? (
              <div className="pos-osection">
                {warnings.map((w, i) => <p key={i} className="fp-error" style={{ margin: 0 }}>{w}</p>)}
              </div>
            ) : null}

            <div className="pos-osection">
              <span className="pos-osection-label">Items</span>
              {detail.lines.map((line) => (
                <div key={line.id} className="pos-oline">
                  <div className="pos-oline-top">
                    <span>{line.qty}× {line.name}{line.size ? ` (${line.size})` : ""}</span>
                    <span>{gbp(line.lineTotal)}</span>
                  </div>
                  {line.modifiers.length ? <span className="pos-oline-sub">{line.modifiers.join(", ")}</span> : null}
                  {line.components.length ? <span className="pos-oline-sub">{line.components.join(", ")}</span> : null}
                  {line.notes ? <span className="pos-oline-note">&ldquo;{line.notes}&rdquo;</span> : null}

                  {detail.editable ? (
                    voidLineId === line.id ? (
                      <div className="pos-oline-void">
                        {voidPin ? (
                          <PinPad
                            busy={busy}
                            error={actionError}
                            onCancel={() => setVoidPin(false)}
                            onSubmit={(pin) => runVoid(line.id, voidReason === "Other" ? voidCustom.trim() : voidReason, pin)}
                          />
                        ) : (
                          <>
                            <div className="pos-chip-row">
                              {VOID_REASONS.map((r) => (
                                <button key={r} type="button" className="pos-chip" data-state={voidReason === r ? "whole" : undefined} onClick={() => setVoidReason(r)}>{r}</button>
                              ))}
                            </div>
                            {voidReason === "Other" ? (
                              <input className="input" style={{ minHeight: 44, marginTop: 6 }} placeholder="Reason" value={voidCustom} onChange={(e) => setVoidCustom(e.target.value)} />
                            ) : null}
                            {actionError ? <p className="fp-error" style={{ margin: "6px 0 0" }}>{actionError}</p> : null}
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => { setVoidLineId(null); setVoidReason(""); setVoidCustom(""); }}>Cancel</button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ minHeight: 44 }}
                                disabled={busy || !(voidReason === "Other" ? voidCustom.trim() : voidReason)}
                                onClick={() => {
                                  const reason = voidReason === "Other" ? voidCustom.trim() : voidReason;
                                  if (detail.voidNeedsPin) setVoidPin(true);
                                  else void runVoid(line.id, reason);
                                }}
                              >
                                Void
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <button type="button" className="btn btn-ghost" style={{ minHeight: 36, fontSize: 13, alignSelf: "flex-start" }} onClick={() => { setVoidLineId(line.id); setActionError(""); }}>
                        Void
                      </button>
                    )
                  ) : null}
                </div>
              ))}
            </div>

            <div className="pos-osection">
              <Row label="Subtotal" value={detail.subtotal} />
              {detail.deliveryFee ? <Row label="Delivery fee" value={detail.deliveryFee} /> : null}
              {detail.discount ? <Row label="Discount" value={-detail.discount} /> : null}
              {detail.writtenOff ? <Row label="Written off" value={-detail.writtenOff} /> : null}
              <Row label="Total" value={detail.total} bold />
              <Row label="Paid" value={detail.paid} />
              {detail.balance > 0 ? <Row label="Balance owed" value={detail.balance} /> : null}
              {detail.refundDue > 0 ? <Row label="Refund due" value={detail.refundDue} /> : null}
              {detail.refunded > 0 ? <Row label="Refunded" value={detail.refunded} /> : null}
            </div>

            {detail.payments.length ? (
              <div className="pos-osection">
                <span className="pos-osection-label">Payments</span>
                {detail.payments.map((p) => (
                  <div key={p.id} className="pos-oline-top">
                    <span style={{ textTransform: "capitalize" }}>{p.kind}{p.status !== "succeeded" ? ` · ${p.status}` : ""}</span>
                    <span>{gbp(p.amount)}{p.refunded ? ` (${gbp(p.refunded)} refunded)` : ""}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {detail.refunds.length ? (
              <div className="pos-osection">
                <span className="pos-osection-label">Refunds</span>
                {detail.refunds.map((r) => (
                  <div key={r.id} className="pos-oline-top">
                    <span>{gbp(r.amount)} · {r.reason}{r.status !== "succeeded" ? ` (${r.status})` : ""}</span>
                    <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{r.approvedBy}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {detail.next.length ? (
              <div className="pos-osection">
                <span className="pos-osection-label">Status: {STATUS_LABEL[detail.status]}</span>
                {actionError && !rejectPick && !voidLineId ? <p className="fp-error" style={{ margin: 0 }}>{actionError}</p> : null}
                <div className="pos-chip-row">
                  {detail.next.includes("accepted") ? (
                    <>
                      <span style={{ alignSelf: "center", fontSize: 13, color: "var(--color-neutral-700)" }}>Accept in:</span>
                      {ETA_CHIPS.map((m) => (
                        <button key={m} type="button" className="btn btn-primary" style={{ minHeight: 56 }} disabled={busy} onClick={() => runStatus({ to: "accepted", etaMinutes: m })}>
                          {m} min
                        </button>
                      ))}
                    </>
                  ) : null}
                  {detail.next.filter((s): s is SimpleStatus => s in STATUS_ACTION_LABEL).map((s) => (
                    <button key={s} type="button" className="btn btn-primary" style={{ minHeight: 56 }} disabled={busy} onClick={() => runStatus({ to: s })}>
                      {STATUS_ACTION_LABEL[s]}
                    </button>
                  ))}
                  {(["rejected", "cancelled"] as const).filter((s) => detail.next.includes(s)).map((s) => (
                    <button key={s} type="button" className="btn btn-secondary" style={{ minHeight: 56 }} disabled={busy} onClick={() => setRejectPick(s)}>
                      {s === "rejected" ? "Reject" : "Cancel order"}{detail.paid > 0 ? " (manager)" : ""}
                    </button>
                  ))}
                </div>

                {rejectPick ? (
                  <div className="pos-oline-void">
                    {rejectPin ? (
                      <PinPad
                        busy={busy}
                        error={actionError}
                        onCancel={() => setRejectPin(false)}
                        onSubmit={(pin) => runStatus({ to: rejectPick, reason: rejectReason === "Other" ? rejectCustom.trim() : rejectReason, managerPin: pin })}
                      />
                    ) : (
                      <>
                        <div className="pos-chip-row">
                          {REJECT_REASONS.map((r) => (
                            <button key={r} type="button" className="pos-chip" data-state={rejectReason === r ? "whole" : undefined} onClick={() => setRejectReason(r)}>{r}</button>
                          ))}
                        </div>
                        {rejectReason === "Other" ? (
                          <input className="input" style={{ minHeight: 44, marginTop: 6 }} placeholder="Reason" value={rejectCustom} onChange={(e) => setRejectCustom(e.target.value)} />
                        ) : null}
                        {actionError ? <p className="fp-error" style={{ margin: "6px 0 0" }}>{actionError}</p> : null}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button type="button" className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => { setRejectPick(null); setRejectReason(""); setRejectCustom(""); }}>Back</button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ minHeight: 48 }}
                            disabled={busy || !(rejectReason === "Other" ? rejectCustom.trim() : rejectReason)}
                            onClick={() => runStatus({ to: rejectPick, reason: rejectReason === "Other" ? rejectCustom.trim() : rejectReason })}
                          >
                            {rejectPick === "rejected" ? "Confirm reject" : "Confirm cancel"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {detail.fulfilment === "delivery" && detail.status !== "completed" && detail.status !== "rejected" && detail.status !== "cancelled" ? (
              <div className="pos-osection">
                <span className="pos-osection-label">Driver</span>
                <div className="pos-chip-row">
                  {drivers.map((d) => (
                    <button
                      key={d.id} type="button" className="pos-chip" data-state={detail.driver?.id === d.id ? "whole" : undefined}
                      disabled={busy || (d.status === "on_delivery" && detail.driver?.id !== d.id)}
                      onClick={() => runDriver(d.id)}
                    >
                      <span>{d.name}</span>
                      <span className="pos-chip-sub">{d.status === "on_delivery" ? (d.orderNumber ? `out · #${d.orderNumber}` : "out") : d.status}</span>
                    </button>
                  ))}
                  {detail.driver ? <button type="button" className="btn btn-ghost" style={{ minHeight: 48 }} disabled={busy} onClick={() => runDriver(null)}>Unassign</button> : null}
                  {!drivers.length ? <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>No drivers set up.</span> : null}
                </div>
              </div>
            ) : null}

            <div className="pos-osection" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {detail.editable ? <button type="button" className="btn btn-secondary" style={{ minHeight: 56 }} onClick={() => { setActionError(""); setMode({ kind: "add-items" }); }}>Add items</button> : null}
              {detail.balance > 0 ? <button type="button" className="btn btn-primary" style={{ minHeight: 56 }} onClick={() => { setActionError(""); setMode({ kind: "pay" }); }}>Take payment · {gbp(detail.balance)}</button> : null}
              {detail.refundDue > 0 || detail.paid > 0 ? <button type="button" className="btn btn-secondary" style={{ minHeight: 56 }} onClick={() => { setActionError(""); setMode({ kind: "refund" }); }}>Refund</button> : null}
            </div>

            <div className="pos-osection" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span className="pos-osection-label" style={{ width: "100%" }}>Reprint</span>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => runReprint("kitchen")}>Kitchen</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => runReprint("customer")}>Customer</button>
              {detail.fulfilment === "delivery" ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => runReprint("driver")}>Driver</button> : null}
            </div>

            <details className="pos-osection">
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>History ({detail.events.length})</summary>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {detail.events.map((e) => (
                  <div key={e.id} style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                    <strong>{fmtTime(e.createdAt)}</strong> · {e.actor} · {e.message}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </aside>
    </div>
  );
}
