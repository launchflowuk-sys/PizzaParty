"use client";
import { useEffect, useRef, useState } from "react";
import type { PosDisplayMessage } from "@/lib/pos-phase4-types";
import { DISPLAY_HELLO_MS, type DisplayPayMethod, type DisplayRequest } from "@/lib/pos-display-requests";
import type { DisplayExtra } from "./PosDisplayOrder";
import type { CustomerUi } from "./PosDisplayConfirm";

type Basket = Extract<PosDisplayMessage, { type: "basket" }>;
const UNDO_MS = 5000;
/** No "paying" from the till this long after the customer chose: let them choose again. */
const PAY_WAIT_MS = 12_000;

const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
type Body = DisplayRequest extends infer R ? (R extends DisplayRequest ? Omit<R, "tillId" | "id" | "handoff"> : never) : never;

/**
 * The display's side of "customer confirms on display" (POS-PLAN item 29). Says
 * hello to the till it follows every minute (so the till offers the hand-over at
 * all); while a basket carries `handoff`, fetches the add-ons and sends the
 * customer's taps to the server (POST /api/pos/display/request - always the server,
 * so a display on another device works). The till decides; this only shows
 * what the till sends back. `live`: a basket with a hand-over is on screen now.
 */
export function useCustomerDisplay(tillId: string | null, basket: Basket | null, live: boolean): CustomerUi | null {
  const handoff = live ? basket?.handoff : undefined;
  const [step, setStep] = useState<CustomerUi["step"]>("confirm");
  const [wantsMore, setWantsMore] = useState(false);
  const [note, setNote] = useState("");
  const [upsell, setUpsell] = useState<DisplayExtra[]>([]);
  const [recent, setRecent] = useState<{ ref: string; name: string } | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  const send = async (body: Body & { handoff?: string }, id = newId()): Promise<boolean> => {
    if (!tillId) return false;
    try {
      const r = await fetch("/api/pos/display/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, tillId, id }) });
      if (r.ok) return true;
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (body.type !== "hello") setNote(d.error ?? "Sorry, that didn't work - please ask our team.");
    } catch {
      if (body.type !== "hello") setNote("Sorry, that didn't work - please ask our team.");
    }
    return false;
  };

  // "A display follows this till" - on pairing and every minute after.
  useEffect(() => {
    if (!tillId) return;
    void send({ type: "hello" });
    const t = window.setInterval(() => void send({ type: "hello" }), DISPLAY_HELLO_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tillId]);

  // A new hand-over (or none) starts at the question again.
  useEffect(() => { setStep("confirm"); setWantsMore(false); setNote(""); setRecent(null); }, [handoff?.id]);

  const slugs = [...new Set((basket?.lines ?? []).map((l) => l.slug).filter(Boolean))].sort().join(",");
  useEffect(() => {
    if (!handoff?.id) return;
    let stale = false;
    fetch(`/api/pos/display/upsell?slugs=${encodeURIComponent(slugs)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: DisplayExtra[] }) => { if (!stale) setUpsell(d.items); })
      .catch(() => { /* no rail is fine; the order still works */ });
    return () => { stale = true; };
  }, [handoff?.id, slugs]);

  useEffect(() => {
    if (step !== "waiting") return;
    const t = window.setTimeout(() => { setStep("pay"); setNote("Sorry, that didn't go through - please try again or ask our team."); }, PAY_WAIT_MS);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  if (!handoff || !basket) return null;
  const inHandoff = { handoff: handoff.id };
  return {
    step, methods: handoff.methods, pending: !!basket.pending, wantsMore, note, upsell, recent,
    onReady: () => { setNote(""); setStep("pay"); void send({ type: "ready", ...inHandoff }); },
    onMore: () => { setWantsMore(true); void send({ type: "more", ...inHandoff }); },
    onBack: () => { setNote(""); setStep("confirm"); },
    onPay: (method: DisplayPayMethod) => {
      setNote("");
      setStep("waiting");
      void send({ type: "pay", method, total: basket.total, ...inHandoff }).then((ok) => { if (!ok) setStep("pay"); });
    },
    onAdd: (e: DisplayExtra) => {
      setNote("");
      const ref = newId();
      setUpsell((u) => u.filter((x) => x.slug !== e.slug)); // gone at once; the next basket brings the real line
      void send({ type: "add", slug: e.slug, ...inHandoff }, ref).then((ok) => {
        if (!ok) return;
        setRecent({ ref, name: e.name });
        clearTimeout(undoTimer.current);
        undoTimer.current = window.setTimeout(() => setRecent((r) => (r?.ref === ref ? null : r)), UNDO_MS);
      });
    },
    onUndo: () => {
      if (!recent) return;
      setRecent(null);
      void send({ type: "remove", ref: recent.ref, ...inHandoff });
    },
  };
}
