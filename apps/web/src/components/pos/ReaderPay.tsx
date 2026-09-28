"use client";
import { useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/money";
import type { PosOrderRef, PosPayment, PosReader } from "@/lib/pos-types";

const LAST_READER_KEY = "pos-last-reader";
const POLL_MS = 1500;
/** Live event kinds worth an immediate status check - a webhook landed, no need to wait for the next tick. */
const LIVE_KINDS = new Set(["paid", "payment_failed", "payment_cancelled"]);

/** Stripe Terminal, server-driven per docs/POS-PLAN.md §5: this panel only starts
 *  the payment and polls its status - the reader itself, and the webhook that
 *  actually places the order, are entirely server-side. `liveEvent` (the SSE
 *  stream) short-circuits the 1.5s poll the moment a matching webhook lands;
 *  the poll itself stays as-is since it is what actually asks Stripe. */
export function ReaderPay({
  orderId, remaining, readers, onSuccess, onBack, liveEvent,
}: {
  orderId: string;
  remaining: number;
  readers: PosReader[];
  onSuccess: (order: PosOrderRef) => void;
  onBack: () => void;
  liveEvent?: { orderId: string; kind: string } | null;
}) {
  const [readerId, setReaderId] = useState(() => {
    try { return localStorage.getItem(LAST_READER_KEY) ?? readers[0]?.id ?? ""; } catch { return readers[0]?.id ?? ""; }
  });
  const [payment, setPayment] = useState<PosPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start() {
    setBusy(true); setError("");
    try { localStorage.setItem(LAST_READER_KEY, readerId); } catch { /* private browsing */ }
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "reader", amount: remaining, readerId }) });
      const d = (await r.json()) as PosPayment | { error?: string };
      if (!r.ok || "error" in d) { setError((d as { error?: string }).error ?? "Could not start the reader payment."); return; }
      setPayment(d as PosPayment);
      poll((d as PosPayment).id);
    } catch {
      setError("Could not reach the reader.");
    } finally {
      setBusy(false);
    }
  }

  async function checkOnce(paymentId: string) {
    try {
      const r = await fetch(`/api/pos/orders/${orderId}/pay/${paymentId}`);
      const d = (await r.json()) as PosPayment;
      setPayment(d);
      if (d.status === "succeeded") { clear(); onSuccess(d.order); }
      else if (d.status === "failed" || d.status === "cancelled") clear();
    } catch { /* keep polling - a dropped poll is not a dropped payment */ }
  }
  function poll(paymentId: string) {
    timer.current = setInterval(() => void checkOnce(paymentId), POLL_MS);
  }
  function clear() { if (timer.current) { clearInterval(timer.current); timer.current = null; } }

  useEffect(() => {
    if (!liveEvent || !payment) return;
    if (liveEvent.orderId !== orderId || !LIVE_KINDS.has(liveEvent.kind)) return;
    void checkOnce(payment.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvent]);

  async function cancel() {
    if (!payment) return;
    clear();
    try { await fetch(`/api/pos/orders/${orderId}/pay/${payment.id}/cancel`, { method: "POST" }); } catch { /* best effort */ }
    setPayment((p) => (p ? { ...p, status: "cancelled" } : p));
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onBack}>Back</button>
      <h3 style={{ marginTop: 8 }}>Card reader — {gbp(remaining)}</h3>

      {!payment ? (
        <>
          <select className="input" style={{ minHeight: 52 }} value={readerId} onChange={(e) => setReaderId(e.target.value)}>
            {readers.map((r) => (
              <option key={r.id} value={r.id} disabled={r.status === "offline"}>
                {r.label}{r.simulated ? " (simulated)" : ""}{r.status === "offline" ? " — offline" : ""}
              </option>
            ))}
          </select>
          {error ? <p className="fp-error">{error}</p> : null}
          <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 64, marginTop: 12 }} disabled={!readerId || busy} onClick={start}>
            {busy ? "Starting…" : "Send to reader"}
          </button>
        </>
      ) : payment.status === "waiting" ? (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <p className="pos-bignum" style={{ fontSize: 22 }}>Tap card on reader</p>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 60, marginTop: 16 }} onClick={cancel}>Cancel</button>
        </div>
      ) : payment.status === "failed" || payment.status === "cancelled" ? (
        <div>
          <p className="fp-error">{payment.message ?? (payment.status === "cancelled" ? "Cancelled." : "Payment failed.")}</p>
          <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 60 }} onClick={() => setPayment(null)}>Try again</button>
        </div>
      ) : null}
    </div>
  );
}
