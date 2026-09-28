"use client";
import { useEffect, useRef, useState } from "react";

/** Payloads from /api/pos/stream and /api/kitchen/stream (lib/realtime.ts). */
export type LiveHandlers = {
  /** An order changed. `kind` is the OrderEvent type: created, placed, paid, amended, refund, driver... */
  order?: (e: { orderId: string; kind: string }) => void;
  /** The back office changed the menu. */
  menu?: () => void;
  /** Events may have been missed (server listener reconnected, or this stream did): refetch everything shown. */
  resync?: () => void;
};

const MAX_BACKOFF_MS = 30_000;

/**
 * Subscribe to a live stream. EventSource's own retry gives up for good on a
 * 401/503, so this closes and reopens it itself with backoff (1s → 30s), and
 * fires `resync` after every reconnect since events were missed in the gap.
 * Coming back to a hidden tab reconnects at once rather than waiting out the
 * backoff. `connected` is for a "Live" / "Reconnecting…" pill and for polling
 * faster while it is false. `url` null = off. Handlers may change every render.
 */
export function useLiveEvents(url: string | null, handlers: LiveHandlers): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!url || typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fails = 0;
    let wasOpen = false;
    let stopped = false;
    const json = (m: MessageEvent) => { try { return JSON.parse(m.data as string) as unknown; } catch { return {}; } };

    const open = () => {
      clearTimeout(timer);
      es?.close();
      const s = new EventSource(url);
      es = s;
      s.onopen = () => {
        fails = 0;
        setConnected(true);
        if (wasOpen) ref.current.resync?.();
        wasOpen = true;
      };
      s.onerror = () => {
        s.close();
        if (es !== s || stopped) return;
        es = null;
        setConnected(false);
        timer = setTimeout(open, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** fails++));
      };
      s.addEventListener("order", (m) => ref.current.order?.(json(m) as { orderId: string; kind: string }));
      s.addEventListener("menu", () => ref.current.menu?.());
      s.addEventListener("resync", () => ref.current.resync?.());
    };
    const onVisible = () => { if (document.visibilityState === "visible" && !es) { fails = 0; open(); } };

    open();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      es?.close();
      document.removeEventListener("visibilitychange", onVisible);
      setConnected(false);
    };
  }, [url]);

  return { connected };
}
