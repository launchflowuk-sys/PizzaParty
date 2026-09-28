"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { POS_DISPLAY_CHANNEL, type PosDisplayEnvelope, type PosDisplayTill } from "@/lib/pos-phase4-types";
import { mergeTill, pickTill, TILL_ACTIVE_MS } from "@/lib/pos-display";
import { useLiveEvents } from "@/lib/use-live-events";

const FOLLOW_KEY = "lf-display-till";

function readFollow(): string | null {
  try { return localStorage.getItem(FOLLOW_KEY); } catch { return null; }
}
function writeFollow(id: string) {
  try { localStorage.setItem(FOLLOW_KEY, id); } catch { /* private mode: pairs again next load */ }
}
const isEnvelope = (x: unknown): x is PosDisplayEnvelope =>
  !!x && typeof x === "object" && typeof (x as PosDisplayEnvelope).tillId === "string" && typeof (x as PosDisplayEnvelope).at === "number" && !!(x as PosDisplayEnvelope).msg;

/**
 * The display's side of the till link (POS-PLAN item 29). Hears every till two
 * ways - BroadcastChannel (a till in this same browser) and the server relay
 * (a till on any device) - keeps the latest per till, and follows one: the
 * remembered choice, else the only till sending, else it asks (`needsPick`).
 */
export function useDisplayFeed() {
  const [tills, setTills] = useState<Record<string, PosDisplayTill>>({});
  const [follow, setFollow] = useState<string | null>(null);
  const [forcePick, setForcePick] = useState(false);

  const take = useCallback((env: PosDisplayEnvelope) => {
    setTills((prev) => {
      const next = mergeTill(prev[env.tillId], env);
      return next === prev[env.tillId] ? prev : { ...prev, [env.tillId]: next };
    });
  }, []);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch("/api/pos/display", { cache: "no-store" });
      if (!r.ok) return;
      const { tills: list } = (await r.json()) as { tills: PosDisplayTill[] };
      for (const t of list) {
        if (t.basket) take({ ...t, at: t.at - 1, msg: t.basket }); // the lines behind a "paying"
        take(t);
      }
    } catch { /* the stream will catch us up */ }
  }, [take]);

  useEffect(() => {
    setFollow(readFollow());
    void refetch();
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(POS_DISPLAY_CHANNEL);
    ch.onmessage = (e) => { if (isEnvelope(e.data)) take(e.data); };
    return () => ch.close();
  }, [take, refetch]);

  const live = useLiveEvents("/api/pos/display/stream", { display: (e) => { if (isEnvelope(e)) take(e); }, resync: () => void refetch() });

  const decision = useMemo(() => pickTill(Object.values(tills), follow), [tills, follow]);
  useEffect(() => {
    if ("follow" in decision && decision.follow !== follow) { setFollow(decision.follow); writeFollow(decision.follow); }
  }, [decision, follow]);

  const choose = (id: string) => { setFollow(id); writeFollow(id); setForcePick(false); };
  const now = Date.now();
  const liveTills = Object.values(tills).filter((t) => now - t.at < TILL_ACTIVE_MS).sort((a, b) => a.tillName.localeCompare(b.tillName));

  return {
    entry: follow ? tills[follow] : undefined,
    liveTills,
    follow,
    needsPick: forcePick || "pick" in decision,
    choose,
    openPicker: () => setForcePick(true),
    closePicker: () => setForcePick(false),
    connected: live.connected,
  };
}
