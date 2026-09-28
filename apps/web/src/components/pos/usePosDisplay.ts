"use client";
import { useEffect, useRef } from "react";
import { POS_DISPLAY_CHANNEL, type PosDisplayEnvelope, type PosDisplayMessage } from "@/lib/pos-phase4-types";
import { getTillId, getTillName } from "./till-identity";

const POST_DEBOUNCE_MS = 150;

/**
 * Till side of the customer display (POS-PLAN item 29). Each message goes out
 * twice: BroadcastChannel (instant, a second window of this browser) and
 * POST /api/pos/display, which the server relays to a display on any other
 * device. The POST is debounced and skipped when nothing changed; a change of
 * message type (basket → paying → paid) flushes at once so no step is lost.
 * Nothing is posted while offline - the latest message goes as soon as the
 * till is back.
 */
export function usePosDisplay(offline = false): (msg: PosDisplayMessage) => void {
  const ch = useRef<BroadcastChannel | null>(null);
  const pending = useRef<PosDisplayEnvelope | null>(null);
  const lastPosted = useRef("");
  const timer = useRef<number | undefined>(undefined);
  const offlineRef = useRef(offline);
  offlineRef.current = offline;

  const flush = () => {
    clearTimeout(timer.current);
    const env = pending.current;
    if (!env || offlineRef.current) return;
    pending.current = null;
    const key = JSON.stringify({ n: env.tillName, m: env.msg });
    if (key === lastPosted.current) return;
    lastPosted.current = key;
    void fetch("/api/pos/display", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(env), keepalive: true })
      .then((r) => { if (!r.ok) lastPosted.current = ""; })
      .catch(() => { lastPosted.current = ""; });
  };

  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") ch.current = new BroadcastChannel(POS_DISPLAY_CHANNEL);
    return () => { clearTimeout(timer.current); ch.current?.close(); ch.current = null; };
  }, []);

  // Back online: send whatever the display missed.
  useEffect(() => { if (!offline) flush(); }, [offline]);

  return (msg: PosDisplayMessage) => {
    const env: PosDisplayEnvelope = { tillId: getTillId(), tillName: getTillName(), at: Date.now(), msg };
    ch.current?.postMessage(env);
    if (pending.current && pending.current.msg.type !== msg.type) flush();
    pending.current = env;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, POST_DEBOUNCE_MS);
  };
}
