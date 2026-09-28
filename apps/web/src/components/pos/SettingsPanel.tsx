"use client";

/** Cash & reports → Settings: the till-local hardware hookups. Just caller ID
 *  for now (POS-PLAN item 28) - grows here if a second one shows up. */
export function SettingsPanel({
  serialSupported, serialConnected, serialError, onConnectSerial,
}: {
  serialSupported: boolean;
  serialConnected: boolean;
  serialError: string;
  onConnectSerial: () => void;
}) {
  return (
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
  );
}
