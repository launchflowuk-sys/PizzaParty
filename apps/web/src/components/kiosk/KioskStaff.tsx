"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PinPad } from "@/components/pos/PinPad";
import { Icon } from "@/components/pos/PosDisplayIcons";
import { KIOSK_EXIT_HOLD_MS } from "@/lib/kiosk-rules";
import type { PosReader } from "@/lib/pos-types";
import "../pos/pos.css";

const DEVICE_KEY = "kiosk-device";

/** This screen's own id, for the per-device rate limit. Made once, kept in the browser. */
export function useKioskDevice(): string {
  const [id, setId] = useState("");
  useEffect(() => {
    try {
      const have = localStorage.getItem(DEVICE_KEY);
      const next = have && /^[\w-]{8,64}$/.test(have) ? have : crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, next);
      setId(next);
    } catch { setId(""); }
  }, []);
  return id;
}

export type KioskResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** POST JSON to a kiosk endpoint with this device's id. Never throws: a customer sees a sentence, not a stack. */
export async function kioskPost<T>(url: string, device: string, body: unknown): Promise<KioskResult<T>> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-kiosk-device": device }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({}))) as T & { error?: string };
    if (!r.ok) return { ok: false, error: d.error ?? (r.status === 401 ? "This kiosk is signed out. Please ask a member of staff." : "Something went wrong. Please try again.") };
    return { ok: true, data: d };
  } catch {
    return { ok: false, error: "We can't reach the shop right now. Please try again, or order at the counter." };
  }
}

/**
 * Staff exit: hold the top-left corner for five seconds, then a manager PIN (five
 * wrong tries lock it for fifteen minutes, server-side). Opens the kiosk's settings -
 * which card reader it uses, full screen - and "Leave kiosk mode" (signs out).
 */
export function KioskStaff({ device, reader }: { device: string; reader: string }) {
  const [open, setOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const stop = () => { clearTimeout(timer.current); setHolding(false); };
  const hold = () => {
    stop();
    setHolding(true);
    timer.current = window.setTimeout(() => { setHolding(false); setOpen(true); }, KIOSK_EXIT_HOLD_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <button
        type="button" className="kx-corner" data-holding={holding ? "1" : "0"} aria-label="Staff: hold for five seconds"
        onPointerDown={(e) => { e.stopPropagation(); hold(); }} onPointerUp={(e) => { e.stopPropagation(); stop(); }} onPointerLeave={stop} onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
      />
      {open ? <StaffPanel device={device} reader={reader} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function StaffPanel({ device, reader: assigned, onClose }: { device: string; reader: string; onClose: () => void }) {
  const router = useRouter();
  const [manager, setManager] = useState<string | null>(null);
  const [readers, setReaders] = useState<PosReader[]>([]);
  const [reader, setShown] = useState(assigned);
  // Held in memory while the panel is open: the server re-checks it to save a reader choice.
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unlock(entered: string) {
    setBusy(true); setError("");
    const r = await kioskPost<{ manager: string; readers: PosReader[]; reader: string }>("/api/kiosk/unlock", device, { pin: entered });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setPin(entered); setManager(r.data.manager); setReaders(r.data.readers); setShown(r.data.reader);
  }
  /** The choice is stored server-side, in this kiosk's signed cookie; the page then re-reads it. */
  async function setReader(id: string) {
    setError("");
    const r = await kioskPost<{ reader: string }>("/api/kiosk/unlock", device, { pin, readerId: id });
    if (!r.ok) { setError(r.error); return; }
    setShown(r.data.reader);
    router.refresh();
  }
  async function leave() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/admin/login?next=/kiosk";
  }

  return (
    <div className="kx-modal-back" onPointerDown={(e) => e.stopPropagation()}>
      <div className="kx-staff" role="dialog" aria-modal="true" aria-label="Kiosk staff settings">
        <div className="kx-staff-head"><Icon name="lock" /><b>{manager ? `Kiosk settings · ${manager}` : "Staff only"}</b></div>
        {!manager ? (
          <PinPad label="Manager PIN to change the kiosk" busy={busy} error={error} onSubmit={unlock} onCancel={onClose} />
        ) : (
          <>
            <fieldset className="kx-staff-group">
              <legend>Card reader for this kiosk</legend>
              {error ? <p className="kx-staff-note" role="alert">{error}</p> : null}
              {readers.length ? readers.map((r) => (
                <label key={r.id} className="kx-staff-reader" data-on={reader === r.id ? "1" : "0"}>
                  <input type="radio" name="reader" checked={reader === r.id} onChange={() => void setReader(r.id)} />
                  <span>{r.label}{r.simulated ? " (simulated)" : ""}</span>
                  <small data-status={r.status}>{r.status}</small>
                </label>
              )) : <p className="kx-staff-note">No card readers found. Register one with scripts/pos-terminal.ts; until then the kiosk offers pay at the counter only.</p>}
              <label className="kx-staff-reader" data-on={reader ? "0" : "1"}>
                <input type="radio" name="reader" checked={!reader} onChange={() => void setReader("")} />
                <span>No card reader (pay at the counter only)</span>
              </label>
            </fieldset>
            <div className="kx-staff-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => null)}>Full screen</button>
              <button type="button" className="btn btn-secondary" onClick={leave}>Leave kiosk mode</button>
              <button type="button" className="btn btn-primary" onClick={onClose}>Back to the kiosk</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
