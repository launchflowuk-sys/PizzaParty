"use client";
import type { RefObject } from "react";
import type { PosBootstrap } from "@/lib/pos-types";
import type { OrderTypeTab } from "./pos-client-types";

const TABS: { key: OrderTypeTab; label: string }[] = [
  { key: "collection", label: "Collection" },
  { key: "delivery", label: "Delivery" },
  { key: "phone", label: "Phone" },
];

export type PosView = "till" | "queue";

export function TopBar({
  staffName, view, onView, badgeCount, soundOn, onEnableSound,
  orderType, onOrderType, search, onSearch, searchRef, boot,
  locationKey, onLocationKey, customerLabel, onChangeCustomer,
}: {
  staffName: string;
  view: PosView;
  onView: (v: PosView) => void;
  /** Orders needing action: status placed, plus ready-but-unpaid. */
  badgeCount: number;
  soundOn: boolean;
  onEnableSound: () => void;
  orderType: OrderTypeTab;
  onOrderType: (t: OrderTypeTab) => void;
  search: string;
  onSearch: (v: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  boot: PosBootstrap | null;
  locationKey: string;
  onLocationKey: (key: string) => void;
  customerLabel: string | null;
  onChangeCustomer: () => void;
}) {
  const status = boot?.onlineStatus;
  return (
    <div className="pos-topbar">
      <div className="seg" role="group" aria-label="Screen">
        <label className="seg-opt" style={{ minHeight: 60, padding: "0 20px", fontSize: 15, fontWeight: 700 }}>
          <input type="radio" name="pos-view" checked={view === "till"} onChange={() => onView("till")} />
          Till
        </label>
        <label className="seg-opt" style={{ minHeight: 60, padding: "0 20px", fontSize: 15, fontWeight: 700, position: "relative" }}>
          <input type="radio" name="pos-view" checked={view === "queue"} onChange={() => onView("queue")} />
          Orders
          {badgeCount > 0 ? <span className="pos-q-badge">{badgeCount}</span> : null}
        </label>
      </div>

      {view === "till" ? (
        <>
          <div className="seg" role="group" aria-label="Order type">
            {TABS.map((t) => (
              <label key={t.key} className="seg-opt" style={{ minHeight: 60, padding: "0 20px", fontSize: 15, fontWeight: 700 }}>
                <input type="radio" name="pos-order-type" checked={orderType === t.key} onChange={() => onOrderType(t.key)} />
                {t.label}
              </label>
            ))}
          </div>

          <input
            ref={searchRef}
            className="input"
            style={{ minHeight: 48, maxWidth: 280, fontSize: 15 }}
            placeholder="Search menu (/)"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />

          {boot && boot.locations.length > 1 ? (
            <select className="input" style={{ minHeight: 48, width: 160 }} value={locationKey} onChange={(e) => onLocationKey(e.target.value)}>
              {boot.locations.map((l) => (
                <option key={l.key} value={l.key}>{l.name}</option>
              ))}
            </select>
          ) : null}

          {customerLabel ? (
            <button type="button" className="btn btn-secondary" style={{ minHeight: 48 }} onClick={onChangeCustomer}>
              {customerLabel} · change
            </button>
          ) : null}
        </>
      ) : null}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* Autoplay policy blocks a beep until a tap unlocks it - and a wall of
            new-order chimes going out mid-shift is the kind of thing every
            till on the counter needs to opt into, so it is not on by default. */}
        <button type="button" className={soundOn ? "btn btn-secondary" : "btn btn-primary"} style={{ minHeight: 44 }} onClick={onEnableSound}>
          {soundOn ? "Sound on" : "Enable sound"}
        </button>
        {status ? (
          <span
            className={status.paused || !status.open ? "tag tag-warn" : "tag tag-info"}
            title={status.message}
            style={{ fontSize: 12 }}
          >
            {status.paused ? "Online orders paused" : status.open ? "Online: open" : "Online: closed"} · till still open
          </span>
        ) : null}
        <span style={{ fontWeight: 700, fontSize: 14 }}>{staffName}</span>
      </div>
    </div>
  );
}
