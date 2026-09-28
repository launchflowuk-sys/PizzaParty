"use client";
import { useState, type RefObject } from "react";
import type { PosBootstrap } from "@/lib/pos-types";
import type { OrderTypeTab } from "./pos-client-types";

const TABS: { key: OrderTypeTab; label: string }[] = [
  { key: "collection", label: "Collection" },
  { key: "delivery", label: "Delivery" },
  { key: "phone", label: "Phone" },
  { key: "eat_in", label: "Eat in" },
];
/** Offline (POS-PLAN item 30): no delivery (needs server zone pricing), no phone (pay-later settlement needs the server too). */
const OFFLINE_DISABLED = new Set<OrderTypeTab>(["delivery", "phone"]);

export type PosView = "till" | "queue" | "cash";

export function TopBar({
  staffName, view, onView, badgeCount, soundOn, onEnableSound,
  orderType, onOrderType, search, onSearch, searchRef, boot,
  locationKey, onLocationKey, customerLabel, onChangeCustomer, liveConnected,
  offline, offlineCount, onSendNow, onOpenDisplay, onShowShortcuts, logoUrl, customerViewing,
}: {
  staffName: string;
  /** Shop logo (POS branding) - small, left of the screen tabs, never stealing touch space. */
  logoUrl?: string;
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
  /** The live push stream (lib/use-live-events.ts), not the queue's own poll - shown as a small pill next to the staff name. */
  liveConnected: boolean;
  /** Offline mode (POS-PLAN item 30). */
  offline: boolean;
  offlineCount: number;
  onSendNow: () => void;
  /** Customer display (item 29) and shortcuts overlay (item 33). */
  onOpenDisplay: () => void;
  onShowShortcuts: () => void;
  /** The order is handed to the customer display (item 29) - they may be adding extras or choosing how to pay. */
  customerViewing?: boolean;
}) {
  const status = boot?.onlineStatus;
  return (
    <div className="pos-topbar">
      {logoUrl ? <img src={logoUrl} alt="" className="pos-topbar-logo" /> : null}
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
        <label className="seg-opt" style={{ minHeight: 60, padding: "0 20px", fontSize: 15, fontWeight: 700 }}>
          <input type="radio" name="pos-view" checked={view === "cash"} onChange={() => onView("cash")} />
          Cash &amp; reports
        </label>
      </div>

      {view === "till" ? (
        <>
          <div className="seg" role="group" aria-label="Order type">
            {TABS.filter((t) => t.key !== "eat_in" || boot?.eatIn).map((t) => {
              const disabled = offline && OFFLINE_DISABLED.has(t.key);
              return (
                <label key={t.key} className="seg-opt" style={{ minHeight: 60, padding: "0 20px", fontSize: 15, fontWeight: 700, opacity: disabled ? 0.4 : 1 }} title={disabled ? "Needs internet" : undefined}>
                  <input type="radio" name="pos-order-type" checked={orderType === t.key} disabled={disabled} onChange={() => onOrderType(t.key)} />
                  {t.label}
                  {disabled ? <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 4, opacity: 0.85 }}>(needs internet)</span> : null}
                </label>
              );
            })}
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
        {offlineCount > 0 ? (
          <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={onSendNow}>
            {offlineCount} unsent · Send now
          </button>
        ) : null}
        {customerViewing ? <span className="pos-viewing" role="status"><span className="pos-viewing-dot" />Customer is viewing</span> : null}
        <DisplayMenu onOpenHere={onOpenDisplay} />
        <BoardMenu />
        <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onShowShortcuts} title="Keyboard shortcuts (?)">?</button>
        <span className="pos-live-pill" data-connected={liveConnected ? "1" : "0"}>
          <span className="pos-live-dot" />
          {liveConnected ? "Live" : "Reconnecting…"}
        </span>
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

/**
 * "Customer display": open it in a window here (a second monitor on this
 * computer), or on any other device by going to the URL below and signing in
 * with a staff PIN - a Kitchen-role PIN is enough (docs/ONBOARDING.md §5.2).
 */
function DisplayMenu({ onOpenHere }: { onOpenHere: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "/pos/display" : `${window.location.origin}/pos/display`;
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} aria-expanded={open} onClick={() => { setOpen((o) => !o); setCopied(false); }}>
        Customer display
      </button>
      {open ? (
        <div className="card pos-display-menu" role="dialog" aria-label="Customer display">
          <button type="button" className="btn btn-primary" style={{ minHeight: 48, width: "100%" }} onClick={() => { onOpenHere(); setOpen(false); }}>
            Open on this computer
          </button>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "12px 0 6px" }}>
            Or on any tablet or screen: open this address and sign in with a staff PIN.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ minHeight: 44, flex: 1, fontSize: 14 }} aria-label="Customer display address" />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 44 }}
              onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false)); }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Order status board" (POS-PLAN item 36): the same idea as DisplayMenu above,
 * for the "Now preparing / Ready to collect" TV by the kiosk. Same sign-in as
 * the customer display - a Kitchen-role PIN is enough (docs/ONBOARDING.md §5.7).
 */
function BoardMenu() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "/pos/board" : `${window.location.origin}/pos/board`;
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} aria-expanded={open} onClick={() => { setOpen((o) => !o); setCopied(false); }}>
        Order status board
      </button>
      {open ? (
        <div className="card pos-display-menu" role="dialog" aria-label="Order status board">
          <button
            type="button"
            className="btn btn-primary"
            style={{ minHeight: 48, width: "100%" }}
            onClick={() => { window.open("/pos/board", "pos-board", "width=900,height=600"); setOpen(false); }}
          >
            Open on this computer
          </button>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "12px 0 6px" }}>
            Or on the TV by the kiosk: open this address and sign in with a staff PIN.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ minHeight: 44, flex: 1, fontSize: 14 }} aria-label="Order status board address" />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 44 }}
              onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false)); }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
