"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QueueDriver, QueueOrder, QueueResponse } from "@/lib/pos-queue-types";

const POLL_MS = 4000;
/** A counter or phone order was just rung up by whoever is looking at this
 *  screen - only web/app arrivals are a surprise worth a chime. */
const ALERT_SOURCES = new Set(["web", "app"]);
/** How long a just-arrived card keeps flashing. */
const FLASH_MS = 3000;

function beep(ctx: AudioContext) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = 740;
  g.gain.value = 0.18;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.frequency.setValueAtTime(920, ctx.currentTime + 0.12);
  o.stop(ctx.currentTime + 0.28);
}

/**
 * Polls GET /api/pos/queue every few seconds and merges the delta in, per the
 * cursor contract in lib/pos-queue-types.ts. Runs for the whole time the till
 * is open (mounted once in PosScreen, not just while the Orders view is on
 * screen) so a new web/app order still chimes while someone is ringing up a
 * counter sale.
 */
export function useQueue() {
  const [orders, setOrders] = useState<Record<string, QueueOrder>>({});
  const [drivers, setDrivers] = useState<QueueDriver[]>([]);
  const [now, setNow] = useState<string>(() => new Date().toISOString());
  const [connected, setConnected] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [justArrived, setJustArrived] = useState<Set<string>>(new Set());

  const cursor = useRef<string | undefined>(undefined);
  const known = useRef<Set<string>>(new Set());
  const first = useRef(true);
  const audio = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(false);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  const poll = useCallback(async () => {
    try {
      const url = cursor.current ? `/api/pos/queue?since=${encodeURIComponent(cursor.current)}` : "/api/pos/queue";
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) { setConnected(false); return; }
      const d = (await r.json()) as QueueResponse;

      const fresh: string[] = [];
      setOrders((prev) => {
        const next = d.full ? {} : { ...prev };
        for (const o of d.orders) {
          if (!known.current.has(o.id) && o.status === "placed" && ALERT_SOURCES.has(o.source)) fresh.push(o.id);
          known.current.add(o.id);
          next[o.id] = o;
        }
        for (const id of d.removed) delete next[id];
        return next;
      });
      setDrivers(d.drivers);
      setNow(d.now);
      cursor.current = d.cursor;
      setConnected(true);

      if (fresh.length && !first.current) {
        if (soundOnRef.current) { if (!audio.current) audio.current = new AudioContext(); fresh.forEach(() => beep(audio.current!)); }
        setJustArrived((prev) => new Set([...prev, ...fresh]));
        window.setTimeout(() => setJustArrived((prev) => { const n = new Set(prev); fresh.forEach((id) => n.delete(id)); return n; }), FLASH_MS);
      }
      first.current = false;
    } catch {
      // A dropped poll is not a dropped order - keep whatever is on screen and
      // just show "Reconnecting…" until the next tick succeeds.
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  const enableSound = useCallback(() => {
    if (!audio.current) audio.current = new AudioContext();
    void audio.current.resume();
    setSoundOn(true);
  }, []);

  /** Merge one fresher order in immediately after an action, instead of waiting for the next poll tick. */
  const updateOrder = useCallback((o: QueueOrder) => {
    known.current.add(o.id);
    setOrders((prev) => ({ ...prev, [o.id]: o }));
  }, []);

  const list = Object.values(orders);
  const badgeCount = list.filter((o) => o.status === "placed").length
    + list.filter((o) => o.status === "ready" && o.paidState !== "paid").length;

  return { orders: list, drivers, now, connected, soundOn, enableSound, justArrived, badgeCount, updateOrder, setDrivers };
}

export type QueueState = ReturnType<typeof useQueue>;
