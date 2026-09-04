"use client";
import { useEffect, useState } from "react";

export type LiveState = { status: string; label: string; etaAt: string | null; etaMinutes: number | null; fulfilment: string; rejectReason: string; scheduledFor: string | null; tz: string };

const STEPS_DELIVERY = ["placed", "accepted", "preparing", "out_for_delivery", "completed"];
const STEPS_COLLECTION = ["placed", "accepted", "preparing", "ready", "completed"];
const LABEL: Record<string, string> = { placed: "Received", accepted: "Accepted", preparing: "Cooking", ready: "Ready", out_for_delivery: "On its way", completed: "Done" };

export function OrderLive({ orderId, initial }: { orderId: string; initial: LiveState }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    if (["completed", "rejected", "cancelled"].includes(s.status)) return;
    const es = new EventSource(`/api/orders/${orderId}/events`);
    es.onmessage = (e) => { try { setS((prev) => ({ ...prev, ...(JSON.parse(e.data) as Partial<LiveState>) })); } catch { /* ignore */ } };
    es.onerror = () => { /* browser auto-reconnects */ };
    return () => es.close();
  }, [orderId, s.status]);

  const steps = s.fulfilment === "delivery" ? STEPS_DELIVERY : STEPS_COLLECTION;
  const idx = Math.max(0, steps.indexOf(s.status === "ready" && s.fulfilment === "delivery" ? "preparing" : s.status));
  const bad = s.status === "rejected" || s.status === "cancelled";
  const eta = s.etaAt ? new Intl.DateTimeFormat("en-GB", { timeZone: s.tz, hour: "2-digit", minute: "2-digit" }).format(new Date(s.etaAt)) : null;

  return (
    <div className="lf-card p-4 mt-4" aria-live="polite">
      <p className={`text-lg font-extrabold ${bad ? "text-danger" : ""}`}>{s.label}{bad && s.rejectReason ? ` — ${s.rejectReason}` : ""}</p>
      {s.status === "pending_payment" ? <p className="text-sm text-muted mt-1">Waiting for your payment to confirm. This usually takes a few seconds.</p> : null}
      {eta && !bad && s.status !== "completed" ? <p className="text-sm mt-1">{s.fulfilment === "delivery" ? "Estimated delivery" : "Ready for collection"} <span className="font-bold">{eta}</span></p> : null}
      {s.scheduledFor && s.status === "placed" ? <p className="text-sm text-muted mt-1">Scheduled for {new Intl.DateTimeFormat("en-GB", { timeZone: s.tz, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(s.scheduledFor))}</p> : null}
      {!bad ? (
        <ol className="mt-4 grid grid-cols-5 gap-1 text-[11px] text-center">
          {steps.map((st, i) => (
            <li key={st} className={i <= idx && s.status !== "pending_payment" ? "text-brand font-bold" : "text-muted"}>
              <div className={`h-1.5 rounded-full mb-1 ${i <= idx && s.status !== "pending_payment" ? "bg-brand" : "bg-line"}`} />{LABEL[st]}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
