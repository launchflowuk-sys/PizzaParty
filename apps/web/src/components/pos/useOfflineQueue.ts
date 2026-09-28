"use client";
import { useCallback, useEffect, useState } from "react";
import type { OfflineOrderRecord } from "./offline-store";
import { listOfflineOrders, updateOfflineOrder } from "./offline-store";

type PosOrderRefLike = { id: string; number: number; total: number; paid: number };

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Could not sync this order.";
}

/**
 * Replays the offline order queue (POS-PLAN item 30) once the till is back
 * online: POST /api/pos/orders with the saved clientRequestId, then the cash
 * payment if there was one, in the order they were taken. clientRequestId
 * makes both calls safe to repeat (lib/pos-phase4-types.ts), so a partial
 * failure here just gets retried on the next `sendNow`/reconnect.
 * ponytail: stops the whole batch on the first network failure (offline
 * again) but keeps going past a single order's server-side rejection,
 * flagging it instead - a global retry loop, not per-order backoff.
 */
export function useOfflineQueue(online: boolean) {
  const [pending, setPending] = useState<OfflineOrderRecord[]>([]);
  const [differences, setDifferences] = useState<OfflineOrderRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof indexedDB === "undefined") return;
    try {
      const all = await listOfflineOrders();
      setPending(all.filter((r) => !r.synced));
      setDifferences(all.filter((r) => r.synced && r.syncedWithDifference));
    } catch {
      // No IndexedDB (private mode, etc.) - offline orders just cannot queue; till still usable online.
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const sendNow = useCallback(async () => {
    if (typeof indexedDB === "undefined" || syncing) return;
    setSyncing(true);
    try {
      const all = (await listOfflineOrders()).filter((r) => !r.synced).sort((a, b) => a.createdOfflineAt.localeCompare(b.createdOfflineAt));
      for (const rec of all) {
        try {
          const or = await fetch("/api/pos/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rec.body) });
          const od = (await or.json()) as PosOrderRefLike | { error?: string };
          if (!or.ok || "error" in od) { await updateOfflineOrder(rec.clientRequestId, { error: (od as { error?: string }).error ?? "Order was rejected." }); continue; }
          const ref = od as PosOrderRefLike;

          let serverTotal = ref.total;
          if (rec.cash) {
            const pr = await fetch(`/api/pos/orders/${ref.id}/pay`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ kind: "cash", amount: rec.cash.amount, tendered: rec.cash.tendered, clientRequestId: rec.clientRequestId }),
            });
            const pd = (await pr.json()) as { order?: PosOrderRefLike; error?: string };
            if (!pr.ok || pd.error) { await updateOfflineOrder(rec.clientRequestId, { error: pd.error ?? "Order sent, but the cash payment failed to record." }); continue; }
            if (pd.order) serverTotal = pd.order.total;
          }

          await updateOfflineOrder(rec.clientRequestId, { synced: true, syncedWithDifference: serverTotal !== rec.offlineTotal, error: undefined });
        } catch (e) {
          // A thrown fetch means the connection dropped again - stop here, the rest replay on the next attempt.
          await updateOfflineOrder(rec.clientRequestId, { error: getErrorMessage(e) });
          break;
        }
      }
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh, syncing]);

  useEffect(() => { if (online) void sendNow(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  return { count: pending.length, differences, syncing, sendNow, refresh };
}
