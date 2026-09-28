"use client";
import { useEffect, useState } from "react";

/**
 * Offline detection (POS-PLAN item 30): the browser's own online/offline
 * events, backed up by the live push stream's own connected state (passed
 * in) so a laptop that thinks it has Wi-Fi but cannot actually reach the
 * server still counts as offline instead of silently failing every fetch.
 * ponytail: no active "failed fetch" probe of its own - usePosOrder's own
 * pricing fetch and useQueue's poll already surface a dead connection
 * through `liveConnected`/`queueConnected` within a few seconds.
 */
export function useOnlineStatus(liveConnected: boolean, queueConnected: boolean): boolean {
  const [browserOnline, setBrowserOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!browserOnline) return true;
  return !liveConnected && !queueConnected;
}
