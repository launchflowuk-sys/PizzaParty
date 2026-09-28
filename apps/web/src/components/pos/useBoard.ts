"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardOrder, BoardResponse } from "@/lib/pos-board-types";
import { useLiveEvents } from "@/lib/use-live-events";

const POLL_MS = 5000;
const SAFETY_POLL_MS = 30000;

/**
 * Polls GET /api/pos/board and refetches at once on /api/kitchen/stream's order
 * events - the same push-plus-safety-poll shape as the till's queue (useQueue.ts)
 * and the customer display (useDisplayFeed.ts), reusing the kitchen stream rather
 * than opening a third SSE endpoint. The board's own payload is small (today's open
 * non-delivery orders only), so unlike the queue this just replaces the whole list
 * each time instead of tracking a cursor.
 *
 * `onReady(ids)` fires once per poll for orders that were "preparing" last time and
 * are "ready" now - the chime and the card animation hang off it.
 */
export function useBoard(onReady?: (ids: string[]) => void) {
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [justReady, setJustReady] = useState<Set<string>>(new Set());
  const known = useRef<Map<string, BoardOrder["state"]>>(new Map());
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/pos/board", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as BoardResponse;
      const turned: string[] = [];
      for (const o of d.orders) {
        if (known.current.get(o.id) === "preparing" && o.state === "ready") turned.push(o.id);
        known.current.set(o.id, o.state);
      }
      for (const id of known.current.keys()) if (!d.orders.some((o) => o.id === id)) known.current.delete(id);
      setOrders(d.orders);
      if (turned.length) {
        onReadyRef.current?.(turned);
        setJustReady((prev) => new Set([...prev, ...turned]));
        window.setTimeout(() => setJustReady((prev) => { const n = new Set(prev); turned.forEach((id) => n.delete(id)); return n; }), 2600);
      }
    } catch {
      // A dropped poll leaves the board as it was; the next tick (or the safety poll, via the "Live"/"Reconnecting" pill) catches it up.
    }
  }, []);

  const inFlight = useRef(false);
  const again = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) { again.current = true; return; }
    inFlight.current = true;
    await poll();
    if (again.current) { again.current = false; await poll(); }
    inFlight.current = false;
  }, [poll]);

  const live = useLiveEvents("/api/kitchen/stream", { order: () => void refresh(), resync: () => void refresh() });

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, live.connected ? SAFETY_POLL_MS : POLL_MS);
    return () => clearInterval(t);
  }, [refresh, live.connected]);

  return { orders, connected: live.connected, justReady };
}
