"use client";
import { useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/money";
import type { PosReader } from "@/lib/pos-types";
import {
  basketPending, checkDisplayRequest, DISPLAY_SEEN_MS,
  type DisplayHandoff, type DisplayPayMethod, type DisplayRequest, type TillHandoff,
} from "@/lib/pos-display-requests";
import { isSimpleProduct, type OrderTypeTab, type PosProduct } from "./pos-client-types";
import type { PosOrderState } from "./usePosOrder";
import { getHandoffPref, getTillId } from "./till-identity";
import { LAST_READER_KEY } from "./ReaderPay";

const TOAST_MS = 6000;
export type AutoPay = { method: "cash" | "reader"; readerId?: string };
type Toast = { id: number; text: string };

const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** The reader this till would use: the one it last used if online, else the first online one. */
function onlineReader(readers: PosReader[]): PosReader | undefined {
  let last = "";
  try { last = localStorage.getItem(LAST_READER_KEY) ?? ""; } catch { /* private mode */ }
  const online = readers.filter((r) => r.status === "online");
  return online.find((r) => r.id === last) ?? online[0];
}

/**
 * Till side of the interactive customer display (POS-PLAN item 29). Charge hands
 * the basket to the display ("Customer confirms on display", Settings); the
 * customer's taps arrive as `display-request` events and are applied here only
 * while that hand-over is live - adds go through the normal basket (server
 * repricing as usual), removes only undo the display's own adds, and a pay opens
 * the till's own pay screen exactly as if staff had pressed it.
 */
export function useCustomerHandoff({ order, products, readers, offline, orderType, onPay }: {
  order: PosOrderState;
  products: PosProduct[];
  readers: PosReader[];
  offline: boolean;
  orderType: OrderTypeTab;
  onPay: () => void;
}) {
  const [handoff, setHandoffState] = useState<TillHandoff | null>(null);
  const ref = useRef<TillHandoff | null>(null);
  const [seenAt, setSeenAt] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [autoPay, setAutoPay] = useState<AutoPay | null>(null);
  const toastId = useRef(0);

  const set = (h: TillHandoff | null) => { ref.current = h; setHandoffState(h); };
  const toast = (text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  };

  const reader = onlineReader(readers);
  const methods: DisplayPayMethod[] = reader ? ["card", "cash"] : ["cash"];
  const pending = basketPending(order.lines, order.priced, order.pricingLoading);

  // A hand-over ends with the basket (new order / cleared) or the connection.
  useEffect(() => { if (ref.current && (!order.lines.length || offline)) set(null); }, [order.lines.length, offline]);

  function onRequest(raw: unknown) {
    if (!raw || typeof raw !== "object" || typeof (raw as DisplayRequest).type !== "string" || typeof (raw as DisplayRequest).tillId !== "string") return;
    const req = raw as DisplayRequest;
    const h = ref.current;
    const why = checkDisplayRequest(h, req, { tillId: getTillId(), methods, total: order.priced?.total ?? -1, pending });
    if (why === "total changed") toast("Customer tried to pay, but the total was still updating - they can try again");
    if (why) return;
    if (req.type === "hello") { setSeenAt(Date.now()); return; }
    if (req.type === "add") {
      const p = products.find((x) => x.slug === req.slug);
      if (!p || !isSimpleProduct(p)) { toast("Customer asked for an item this till can't add - please check with them"); return; }
      const unitPrice = p.sizes[0]?.price ?? p.minPrice;
      const key = order.addLine({ kind: "product", product: p.slug, size: p.sizes[0]?.key ?? "regular", modifiers: [], qty: 1, name: p.name, detail: "", unitPrice, lineTotal: unitPrice });
      set({ ...h!, added: { ...h!.added, [req.id]: key }, adds: h!.adds + 1 });
      toast(`Customer added ${p.name}`);
    } else if (req.type === "remove") {
      const key = h!.added[req.ref]!;
      const name = order.lines.find((l) => l.key === key)?.name;
      set({ ...h!, added: Object.fromEntries(Object.entries(h!.added).filter(([ref]) => ref !== req.ref)) });
      order.removeLine(key);
      toast(`Customer removed ${name ?? "an item they added"}`);
    } else if (req.type === "ready") toast("Customer is ready to pay");
    else if (req.type === "more") toast("Customer wants to add something else");
    else if (req.type === "pay") {
      set(null);
      setAutoPay(req.method === "card" ? { method: "reader", readerId: reader?.id } : { method: "cash" });
      toast(req.method === "card" ? "Customer paying by card - sent to the reader" : `Customer paying cash - take ${gbp(order.priced?.total ?? 0)}`);
      onPay();
    }
  }

  const displaySeen = Date.now() - seenAt < DISPLAY_SEEN_MS;
  return {
    active: !!handoff,
    /** Charge should hand over rather than open the pay screen. */
    canStart: () => getHandoffPref() && displaySeen && !offline && orderType !== "phone" && order.lines.length > 0,
    start: () => { set({ id: newId(), added: {}, adds: 0 }); toast("Handed to the customer display"); },
    stop: () => set(null),
    message: handoff ? ({ id: handoff.id, methods } satisfies DisplayHandoff) : undefined,
    pending,
    autoPay,
    clearAutoPay: () => setAutoPay(null),
    onRequest,
    toasts,
  };
}

/** "With the customer" strip over the menu while the display has the order. Staff can always take over. */
export function HandoffBanner({ onPayHere, onCancel }: { onPayHere: () => void; onCancel: () => void }) {
  return (
    <div className="pos-handoff" role="status">
      <span className="pos-handoff-dot" aria-hidden="true" />
      <div>
        <b>With the customer</b>
        <span>They&apos;re checking the order on the display and can add extras or choose how to pay. You can still add or remove items.</span>
      </div>
      <button type="button" className="btn btn-primary" style={{ minHeight: 52 }} onClick={onPayHere}>Take payment here</button>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 52 }} onClick={onCancel}>Take back</button>
    </div>
  );
}

export function HandoffToasts({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div className="pos-toasts" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className="pos-toast">{t.text}</div>)}
    </div>
  );
}
