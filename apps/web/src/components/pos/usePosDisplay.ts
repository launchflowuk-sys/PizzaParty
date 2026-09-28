"use client";
import { useEffect, useRef } from "react";
import { POS_DISPLAY_CHANNEL, type PosDisplayMessage } from "@/lib/pos-phase4-types";

/**
 * Till side of the customer-facing display (POS-PLAN item 29): fire-and-forget
 * BroadcastChannel, no server involved. Sending is free whether or not any
 * /pos/display window is open on the second screen.
 */
export function usePosDisplay(): (msg: PosDisplayMessage) => void {
  const ref = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(POS_DISPLAY_CHANNEL);
    ref.current = ch;
    return () => { ch.close(); ref.current = null; };
  }, []);

  return (msg: PosDisplayMessage) => ref.current?.postMessage(msg);
}
