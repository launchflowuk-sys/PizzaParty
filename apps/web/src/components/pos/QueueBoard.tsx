"use client";
import { useMemo, useState } from "react";
import type { PosReader } from "@/lib/pos-types";
import type { QueueDriver, QueueOrder } from "@/lib/pos-queue-types";
import { QueueCard } from "./QueueCard";
import { OrderPanel } from "./OrderPanel";
import { DONE_STATUSES } from "./queue-ui";
import type { PosCategory, PosDeal } from "./pos-client-types";

type Filter = "all" | "delivery" | "collection" | "unpaid";

const COLUMNS: { key: string; label: string; match: (o: QueueOrder) => boolean }[] = [
  { key: "new", label: "New", match: (o) => o.status === "placed" },
  { key: "cooking", label: "Accepted / Cooking", match: (o) => o.status === "accepted" || o.status === "preparing" },
  { key: "ready", label: "Ready", match: (o) => o.status === "ready" },
  { key: "out", label: "Out", match: (o) => o.status === "out_for_delivery" },
  { key: "done", label: "Done today", match: (o) => DONE_STATUSES.has(o.status) },
];
/** The done column is a short scrollback, not a report - the Z report (phase 3) is the real record. */
const DONE_SHOWN = 12;

export function QueueBoard({
  orders, drivers, now, connected, justArrived, readers, categories, deals, updateOrder, setDrivers,
  openId, onOpenChange, liveEvent, liveConnected,
}: {
  orders: QueueOrder[];
  drivers: QueueDriver[];
  now: string;
  connected: boolean;
  justArrived: Set<string>;
  readers: PosReader[];
  categories: PosCategory[];
  deals: PosDeal[];
  updateOrder: (o: QueueOrder) => void;
  setDrivers: (d: QueueDriver[]) => void;
  /** Controlled by PosScreen so a "still owed" row in the day report can open the same order here. */
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  liveEvent: { orderId: string; kind: string } | null;
  liveConnected: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => orders.filter((o) => {
    if (filter === "delivery" && o.fulfilment !== "delivery") return false;
    if (filter === "collection" && o.fulfilment !== "collection") return false;
    if (filter === "unpaid" && o.paidState === "paid") return false;
    if (term && !`${o.number} ${o.customerName} ${o.customerPhone}`.toLowerCase().includes(term)) return false;
    return true;
  }), [orders, filter, term]);

  return (
    <div className="pos-q-board-wrap">
      <div className="pos-q-toolbar">
        <div className="seg" role="group" aria-label="Filter">
          {([["all", "All"], ["delivery", "Delivery"], ["collection", "Collection"], ["unpaid", "Unpaid"]] as [Filter, string][]).map(([f, label]) => (
            <label key={f} className="seg-opt" style={{ minHeight: 48, padding: "0 16px" }}>
              <input type="radio" name="pos-q-filter" checked={filter === f} onChange={() => setFilter(f)} />
              {label}
            </label>
          ))}
        </div>
        <input className="input" style={{ minHeight: 48, maxWidth: 260 }} placeholder="Search number, name, phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        {drivers.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {drivers.map((d) => (
              <span key={d.id} className={`tag ${d.status === "available" ? "tag-ok" : d.status === "on_delivery" ? "tag-warn" : "tag-neutral"}`}>
                {d.name}{d.orderNumber ? ` · #${d.orderNumber}` : ""}
              </span>
            ))}
          </div>
        ) : null}
        {!connected ? <span className="tag tag-warn" style={{ marginLeft: "auto" }}>Reconnecting…</span> : null}
      </div>

      <div className="pos-q-columns">
        {COLUMNS.map((col) => {
          const items = filtered.filter(col.match).sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());
          const shown = col.key === "done" ? items.slice(-DONE_SHOWN).reverse() : items;
          return (
            <div key={col.key} className="pos-q-col" data-col={col.key}>
              <div className="pos-q-col-head">
                <span>{col.label}</span>
                <span className="pos-q-col-count">{items.length}</span>
              </div>
              <div className="pos-q-col-body">
                {shown.length === 0 ? <p className="pos-q-empty">Nothing here.</p> : null}
                {shown.map((o) => (
                  <QueueCard key={o.id} order={o} now={now} flash={justArrived.has(o.id)} onOpen={() => onOpenChange(o.id)} />
                ))}
                {col.key === "done" && items.length > DONE_SHOWN ? <p className="pos-q-more">+{items.length - DONE_SHOWN} more today</p> : null}
              </div>
            </div>
          );
        })}
      </div>

      {openId ? (
        <OrderPanel
          orderId={openId}
          drivers={drivers}
          readers={readers}
          categories={categories}
          deals={deals}
          onClose={() => onOpenChange(null)}
          onOrderUpdated={updateOrder}
          onDriversUpdated={setDrivers}
          liveEvent={liveEvent}
          liveConnected={liveConnected}
        />
      ) : null}
    </div>
  );
}
