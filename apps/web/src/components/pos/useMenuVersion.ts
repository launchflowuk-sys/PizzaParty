"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 15000;

/**
 * Fingerprints GET /api/pos/menu-version so a till left open all shift
 * notices when the back office changes a price, a product or a sold-out flag
 * - staff should never be ringing up yesterday's prices. Polls, and also
 * checks on window focus (a till tab that was minimised should not have to
 * wait out the rest of the interval). `liveConnected` slows the poll to a
 * safety net once the SSE stream is up, since a `menu` push event calls
 * `check()` immediately when the office actually changes something.
 */
export function useMenuVersion(liveConnected: boolean) {
  const first = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch("/api/pos/menu-version", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { version: string };
      if (first.current === null) { first.current = d.version; return; }
      if (d.version !== first.current) setChanged(true);
    } catch {
      // A failed check is not a menu change - just try again next tick.
    }
  }, []);

  useEffect(() => {
    void check();
    const t = setInterval(check, liveConnected ? 60000 : POLL_MS);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [check, liveConnected]);

  /** Call once the refresh this change asked for has actually happened -
   *  rebaselines onto whatever version comes back next, rather than the stale
   *  one that triggered `changed`. */
  const ack = useCallback(() => { setChanged(false); first.current = null; }, []);

  return { changed, ack, check };
}
