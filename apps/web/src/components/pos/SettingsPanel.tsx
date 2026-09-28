"use client";
import { useEffect, useState } from "react";
import { DEFAULT_TILL_NAME, getHandoffPref, getTillName, setHandoffPref, setTillName } from "./till-identity";

/** Cash & reports → Settings: the till-local set-up - this till's name on the
 *  customer display (item 29) and the caller ID box (item 28). */
export function SettingsPanel({
  serialSupported, serialConnected, serialError, onConnectSerial,
}: {
  serialSupported: boolean;
  serialConnected: boolean;
  serialError: string;
  onConnectSerial: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
    <TillNameCard />
    <HandoffCard />
    <div className="card" style={{ padding: 16 }}>
      <span style={{ fontWeight: 800, fontSize: 17, fontFamily: "var(--font-heading)" }}>Caller ID box</span>
      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 4 }}>
        A USB caller-ID box plugged into this till, read directly in the browser (Chrome desktop only). Sets up per till, not per shop.
      </p>
      {!serialSupported ? (
        <p style={{ marginTop: 10 }}>Not available in this browser — use Chrome on a desktop till.</p>
      ) : (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" className="btn btn-primary" style={{ minHeight: 52 }} onClick={onConnectSerial} disabled={serialConnected}>
            {serialConnected ? "Connected" : "Connect caller ID box"}
          </button>
          <span className={`tag ${serialConnected ? "tag-ok" : "tag-neutral"}`}>{serialConnected ? "Reading" : "Not connected"}</span>
        </div>
      )}
      {serialError ? <p className="fp-error" style={{ marginTop: 8 }}>{serialError}</p> : null}
    </div>
    </div>
  );
}

/** The name a customer display shows when more than one till is sending to it. Stored on this device. */
function TillNameCard() {
  const [name, setName] = useState(DEFAULT_TILL_NAME);
  const [saved, setSaved] = useState(false);
  useEffect(() => setName(getTillName()), []);
  return (
    <div className="card" style={{ padding: 16 }}>
      <span style={{ fontWeight: 800, fontSize: 17, fontFamily: "var(--font-heading)" }}>Till name</span>
      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 4 }}>
        Shown on a customer display that has more than one till to choose from. Set per till.
      </p>
      <form
        style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}
        onSubmit={(e) => { e.preventDefault(); setTillName(name); setName(getTillName()); setSaved(true); }}
      >
        <input className="input" style={{ minHeight: 52, maxWidth: 260 }} maxLength={40} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} aria-label="Till name" />
        <button type="submit" className="btn btn-primary" style={{ minHeight: 52 }}>Save</button>
        {saved ? <span className="tag tag-ok">Saved</span> : null}
      </form>
    </div>
  );
}

/** "Customer confirms on display" (item 29): Charge hands the order to the customer display first. Stored on this device. */
function HandoffCard() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(getHandoffPref()), []);
  return (
    <div className="card" style={{ padding: 16 }}>
      <span style={{ fontWeight: 800, fontSize: 17, fontFamily: "var(--font-heading)" }}>Customer confirms on display</span>
      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 4 }}>
        When a customer display is following this till, Charge hands the order to the customer: they check it, can add extras,
        and choose card or cash on the screen. You can always take payment here instead. Set per till.
      </p>
      <label style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, minHeight: 52, fontWeight: 700 }}>
        <input type="checkbox" style={{ width: 24, height: 24 }} checked={on} onChange={(e) => { setHandoffPref(e.target.checked); setOn(e.target.checked); }} />
        {on ? "On" : "Off"}
      </label>
    </div>
  );
}
