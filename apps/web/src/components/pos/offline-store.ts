/**
 * IndexedDB queue for orders taken while offline (POS-PLAN item 30). Raw
 * indexedDB API, no dependency - the queue is small (a shop's cash orders
 * during one outage) and needs nothing an ORM would earn its keep on.
 */
const DB_NAME = "lf-pos-offline";
const STORE = "orders";

export type OfflineOrderRecord = {
  clientRequestId: string;
  createdOfflineAt: string;
  /** The POST /api/pos/orders body, already carrying clientRequestId (lib/pos-phase4-types.ts). */
  body: Record<string, unknown>;
  /** Present when paid in cash offline; absent for a "later" (pay on collection) order. */
  cash?: { amount: number; tendered: number };
  /** What priceOffline computed at the time, for the "synced with differences" check. */
  offlineTotal: number;
  synced: boolean;
  syncedWithDifference?: boolean;
  error?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "clientRequestId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? req.error);
  });
}

export async function saveOfflineOrder(rec: OfflineOrderRecord): Promise<void> {
  await withStore<IDBValidKey>("readwrite", (s) => s.put(rec));
}

export async function listOfflineOrders(): Promise<OfflineOrderRecord[]> {
  return withStore<OfflineOrderRecord[]>("readonly", (s) => s.getAll());
}

export async function updateOfflineOrder(clientRequestId: string, patch: Partial<OfflineOrderRecord>): Promise<void> {
  const all = await listOfflineOrders();
  const rec = all.find((r) => r.clientRequestId === clientRequestId);
  if (!rec) return;
  await saveOfflineOrder({ ...rec, ...patch });
}
