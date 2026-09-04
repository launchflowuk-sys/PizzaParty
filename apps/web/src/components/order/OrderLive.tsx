"use client";
import { useEffect, useState } from "react";

export type LiveState = { status: string; label: string; etaAt: string | null; etaMinutes: number | null; fulfilment: string; rejectReason: string; scheduledFor: string | null; tz: string };

const STEPS_DELIVERY = ["placed", "accepted", "preparing", "out_for_delivery", "completed"];
const STEPS_COLLECTION = ["placed", "accepted", "preparing", "ready", "completed"];
const LABEL: Record<string, string> = { placed: "Received", accepted: "Accepted", preparing: "In the oven", ready: "Ready", out_for_delivery: "On its way", completed: "Done" };

/** Order tracker from `Farm Pizza.dc.html`: a 4px accent progress rule over a row of
 *  square step markers, the live one pulsing. Updates arrive over SSE, not a timer. */
export function OrderLive({ orderId, initial }: { orderId: string; initial: LiveState }) {
  const [s, setS] = useState(initial);

  useEffect(() => {
    if (["completed", "rejected", "cancelled"].includes(s.status)) return;
    const es = new EventSource(`/api/orders/${orderId}/events`);
    es.onmessage = (e) => { try { setS((prev) => ({ ...prev, ...(JSON.parse(e.data) as Partial<LiveState>) })); } catch { /* ignore */ } };
    es.onerror = () => { /* the browser reconnects on its own */ };
    return () => es.close();
  }, [orderId, s.status]);

  const steps = s.fulfilment === "delivery" ? STEPS_DELIVERY : STEPS_COLLECTION;
  const active = s.status === "ready" && s.fulfilment === "delivery" ? "preparing" : s.status;
  const idx = Math.max(0, steps.indexOf(active));
  const bad = s.status === "rejected" || s.status === "cancelled";
  const pending = s.status === "pending_payment";
  const pct = bad || pending ? 0 : ((idx + 1) / steps.length) * 100;
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: s.tz, ...opts }).format(new Date(iso));
  const eta = s.etaAt ? fmt(s.etaAt, { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div aria-live="polite">
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 56, lineHeight: 1.02, letterSpacing: "-.02em", margin: "0 0 12px", color: bad ? "var(--color-accent-700)" : undefined }}>
        {s.label}{bad && s.rejectReason ? ` — ${s.rejectReason}` : ""}
      </h1>

      <p style={{ fontSize: 15, color: "var(--color-neutral-800)", margin: "0 0 32px" }}>
        {pending ? "Waiting for your payment to confirm. This usually takes a few seconds." : null}
        {eta && !bad && !pending && s.status !== "completed"
          ? <>{s.fulfilment === "delivery" ? "Estimated delivery" : "Ready for collection"} <strong>{eta}</strong></>
          : null}
        {s.scheduledFor && s.status === "placed"
          ? <> &middot; scheduled for {fmt(s.scheduledFor, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</>
          : null}
      </p>

      {!bad ? (
        <>
          <div style={{ height: 4, background: "var(--color-neutral-300)", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: "var(--color-accent)", transition: "width .6s", width: `${pct}%` }} />
          </div>
          <ol className="fp-tracksteps">
            {steps.map((st, i) => {
              const done = i <= idx && !pending;
              const live = i === idx && !pending && s.status !== "completed";
              return (
                <li key={st} style={{ display: "grid", gap: 8, listStyle: "none" }}>
                  <div
                    style={{
                      width: 14, height: 14,
                      border: `2px solid ${done ? "var(--color-accent)" : "var(--color-neutral-400)"}`,
                      background: done ? "var(--color-accent)" : "transparent",
                      animation: live ? "fp-pulse 1.4s ease-in-out infinite" : undefined,
                    }}
                  />
                  <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, color: done ? "var(--color-text)" : "var(--color-neutral-700)" }}>
                    {LABEL[st]}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </div>
  );
}
