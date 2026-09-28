"use client";
import { useCallback, useEffect, useState } from "react";
import { gbp } from "@/lib/money";
import type { PosDriverCash, PosDriversCashResponse, PosDriverSettleResult } from "@/lib/pos-reports-types";
import { PinPad } from "./PinPad";
import { AmountKeypad } from "./AmountKeypad";

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}
async function readJson<T>(r: Response): Promise<T | { error: string; needsPin?: boolean }> {
  try { return await r.json(); } catch { return { error: "Unexpected response from the server." }; }
}

type Stage = { kind: "list" } | { kind: "settle"; driver: PosDriverCash };

/** Driver cash settlement (docs/POS-PLAN.md item 25): who owes what, settled
 *  against the drawer as a linked pay-in. Same try-then-PIN pattern as the
 *  drawer - the route caps the amount at what is owed and asks for a PIN
 *  above £50 unless already signed in as a manager. */
export function DriverCashPanel({ liveEvent }: { liveEvent: { orderId: string; kind: string } | null }) {
  const [date, setDate] = useState("");
  const [drivers, setDrivers] = useState<PosDriverCash[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "list" });
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pin, setPin] = useState(false);

  const load = useCallback(async (d?: string) => {
    try {
      const url = d ? `/api/pos/drivers/cash?date=${d}` : "/api/pos/drivers/cash";
      const r = await fetch(url, { cache: "no-store" });
      const res = await readJson<PosDriversCashResponse>(r);
      if (!r.ok || "error" in res) { setLoadError((res as { error?: string }).error ?? "Could not load driver cash."); return; }
      setDate((res as PosDriversCashResponse).date);
      setDrivers((res as PosDriversCashResponse).drivers);
      setLoadError("");
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (liveEvent) void load(date || undefined); }, [liveEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() { setStage({ kind: "list" }); setAmount(0); setBusy(false); setError(""); setPin(false); }

  async function settle(driverId: string, amt: number, managerPin?: string) {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/pos/drivers/${driverId}/settle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: amt, managerPin }) });
      const d = await readJson<PosDriverSettleResult>(r);
      if (!r.ok || "error" in d) {
        const err = d as { error?: string; needsPin?: boolean };
        if (err.needsPin) { setPin(true); setError(err.error ?? "Manager PIN needed."); return; }
        throw new Error(err.error ?? "Could not settle that.");
      }
      const res = d as PosDriverSettleResult;
      setDrivers((prev) => prev.map((x) => (x.id === res.driver.id ? res.driver : x)));
      resetForm();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p style={{ padding: 16 }}>Loading…</p>;
  if (loadError && !drivers.length) return <p className="fp-error" style={{ padding: 16 }}>{loadError}</p>;

  if (stage.kind === "settle") {
    const d = stage.driver;
    if (pin) return <PinPad label={`Settle ${gbp(amount)} · ${d.name}`} busy={busy} error={error} onCancel={resetForm} onSubmit={(p) => settle(d.id, amount, p)} />;
    return (
      <AmountKeypad
        initial={d.owed}
        max={d.owed}
        confirmLabel={(a) => `Settle ${gbp(a)}`}
        busy={busy}
        error={error}
        onBack={resetForm}
        onConfirm={(a) => { setAmount(a); void settle(d.id, a); }}
      />
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <label className="field" style={{ maxWidth: 220 }}>
        <span>Date</span>
        <input className="input" style={{ minHeight: 48 }} type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => void load(e.target.value)} />
      </label>

      {loadError ? <p className="fp-error" style={{ marginTop: 12 }}>{loadError}</p> : null}
      {drivers.length === 0 ? <p style={{ marginTop: 16, color: "var(--color-neutral-700)" }}>No driver cash for this day.</p> : null}

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {drivers.map((d) => (
          <div key={d.id} className="pos-osection">
            <div className="pos-oline-top"><strong>{d.name}</strong><span>{d.owed > 0 ? `Owes ${gbp(d.owed)}` : "Settled"}</span></div>
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--color-neutral-700)" }}>
              <span>Collected {gbp(d.collected)}</span>
              <span>Handed in {gbp(d.handedIn)}</span>
            </div>
            {d.owed > 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ minHeight: 52, alignSelf: "flex-start", marginTop: 6 }}
                onClick={() => { setAmount(d.owed); setStage({ kind: "settle", driver: d }); }}
              >
                Settle {gbp(d.owed)}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
