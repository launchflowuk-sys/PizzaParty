"use client";
import { useCallback, useEffect, useState } from "react";
import { gbp } from "@/lib/money";
import type { DrawerMovementKind, PosDrawer, PosDrawerMovement, PosDrawerResponse } from "@/lib/pos-reports-types";
import { PinPad } from "./PinPad";
import { AmountKeypad } from "./AmountKeypad";

const REASON_CHIPS = ["Driver fuel", "Supplies", "Change float", "Other"];

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}
async function readJson<T>(r: Response): Promise<T | { error: string; needsPin?: boolean }> {
  try { return await r.json(); } catch { return { error: "Unexpected response from the server." }; }
}

type Stage = { kind: "view" } | { kind: "open" } | { kind: "movement"; move: DrawerMovementKind } | { kind: "count" };

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="pos-oline-top" style={{ fontWeight: bold ? 800 : 400 }}>
      <span>{label}</span>
      <span>{gbp(value)}</span>
    </div>
  );
}

function OverShort({ over }: { over: number }) {
  return over < 0
    ? <span className="pos-bignum fp-error">SHORT {gbp(-over)}</span>
    : <span className="pos-bignum" style={{ color: "var(--color-action)" }}>{over === 0 ? "Exact" : `Over ${gbp(over)}`}</span>;
}

function ClosedSummary({ drawer }: { drawer: PosDrawer }) {
  return (
    <div className="pos-osection">
      <span className="pos-osection-label">Last closed · {drawer.locationName}</span>
      <Row label="Float" value={drawer.float} />
      <Row label="Expected" value={drawer.expected} />
      {drawer.counted !== null ? <Row label="Counted" value={drawer.counted} /> : null}
      {drawer.overShort !== null ? <div style={{ marginTop: 4 }}><OverShort over={drawer.overShort} /></div> : null}
      <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "6px 0 0" }}>
        Closed by {drawer.closedBy} · opened by {drawer.openedBy}
      </p>
    </div>
  );
}

function MovementRow({ m }: { m: PosDrawerMovement }) {
  return (
    <div className="pos-oline-top">
      <span>{m.kind === "pay_in" ? "In" : "Out"} · {m.reason}{m.driverName ? ` (${m.driverName})` : ""}</span>
      <span>{m.kind === "pay_out" ? "-" : ""}{gbp(m.amount)}</span>
    </div>
  );
}

/**
 * The cash drawer (docs/POS-PLAN.md items 23-24). Every till role can open,
 * read and move it; opening it and any movement over £50 needs a manager PIN
 * unless already signed in as one - the server is the only judge of that
 * (403 { needsPin: true }), so this just tries first and asks for a PIN when
 * told to, same pattern OrderPanel uses for a void or a reject. Closing always
 * asks for a PIN, so that step skips straight to it.
 */
export function DrawerPanel({ locationKey, liveEvent }: { locationKey?: string; liveEvent: { orderId: string; kind: string } | null }) {
  const [drawer, setDrawer] = useState<PosDrawer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "view" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pin, setPin] = useState(false);

  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [counted, setCounted] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const url = locationKey ? `/api/pos/drawer?location=${encodeURIComponent(locationKey)}` : "/api/pos/drawer";
      const r = await fetch(url, { cache: "no-store" });
      const d = await readJson<PosDrawerResponse>(r);
      if (!r.ok || "error" in d) { setLoadError((d as { error?: string }).error ?? "Could not load the drawer."); return; }
      setDrawer((d as PosDrawerResponse).drawer);
      setLoadError("");
    } catch {
      setLoadError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [locationKey]);

  useEffect(() => { void load(); }, [load]);
  // A payment or refund elsewhere moves cash sales/refunds - refresh the live card when one lands.
  useEffect(() => { if (liveEvent) void load(); }, [liveEvent, load]);

  function resetForm() {
    setStage({ kind: "view" }); setBusy(false); setError(""); setPin(false);
    setAmount(0); setReason(""); setCustomReason(""); setCounted(null);
  }

  async function openDrawer(amt: number, managerPin?: string) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/pos/drawer/open", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ float: amt, managerPin, locationKey }) });
      const d = await readJson<PosDrawer>(r);
      if (!r.ok || "error" in d) {
        const err = d as { error?: string; needsPin?: boolean };
        if (err.needsPin) { setPin(true); setError(err.error ?? "Manager PIN needed."); return; }
        throw new Error(err.error ?? "Could not open the drawer.");
      }
      setDrawer(d as PosDrawer);
      resetForm();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitMovement(move: DrawerMovementKind, amt: number, finalReason: string, managerPin?: string) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/pos/drawer/movement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: move, amount: amt, reason: finalReason, managerPin, locationKey }) });
      const d = await readJson<PosDrawer>(r);
      if (!r.ok || "error" in d) {
        const err = d as { error?: string; needsPin?: boolean };
        if (err.needsPin) { setPin(true); setError(err.error ?? "Manager PIN needed."); return; }
        throw new Error(err.error ?? "Could not record that.");
      }
      setDrawer(d as PosDrawer);
      resetForm();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function closeDrawer(countedAmount: number, managerPin: string) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/pos/drawer/close", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ counted: countedAmount, managerPin, locationKey }) });
      const d = await readJson<PosDrawer>(r);
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not close the drawer.");
      setDrawer(d as PosDrawer);
      resetForm();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p style={{ padding: 16 }}>Loading…</p>;
  if (loadError && !drawer) return <p className="fp-error" style={{ padding: 16 }}>{loadError}</p>;

  if (stage.kind === "open") {
    if (pin) return <PinPad label={`Open with ${gbp(amount)} float`} busy={busy} error={error} onCancel={resetForm} onSubmit={(p) => openDrawer(amount, p)} />;
    return (
      <AmountKeypad
        initial={amount}
        confirmLabel={(a) => `Open with ${gbp(a)} float`}
        busy={busy}
        error={error}
        onBack={resetForm}
        onConfirm={(a) => { setAmount(a); void openDrawer(a); }}
      />
    );
  }

  if (stage.kind === "movement") {
    const finalReason = (reason === "Other" ? customReason : reason).trim();
    if (pin) {
      return (
        <PinPad
          label={`${stage.move === "pay_in" ? "Pay in" : "Pay out"} ${gbp(amount)}`}
          busy={busy}
          error={error}
          onCancel={resetForm}
          onSubmit={(p) => submitMovement(stage.move, amount, finalReason, p)}
        />
      );
    }
    return (
      <div style={{ maxWidth: 340 }}>
        <h3 style={{ marginTop: 0 }}>{stage.move === "pay_in" ? "Pay in" : "Pay out"}</h3>
        <div className="pos-chip-row">
          {REASON_CHIPS.map((r) => (
            <button key={r} type="button" className="pos-chip" data-state={reason === r ? "whole" : undefined} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
        {reason === "Other" ? (
          <input className="input" style={{ minHeight: 48, marginBottom: 10 }} placeholder="Reason" value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
        ) : null}
        <AmountKeypad
          initial={amount}
          confirmLabel={(a) => `${stage.move === "pay_in" ? "Pay in" : "Pay out"} ${gbp(a)}`}
          busy={busy}
          error={error}
          onBack={resetForm}
          onConfirm={(a) => {
            if (!finalReason) { setError("Pick a reason."); return; }
            setAmount(a);
            void submitMovement(stage.move, a, finalReason);
          }}
        />
      </div>
    );
  }

  if (stage.kind === "count") {
    if (pin) return <PinPad label={`Close · counted ${gbp(counted ?? 0)}`} busy={busy} error={error} onCancel={resetForm} onSubmit={(p) => closeDrawer(counted ?? 0, p)} />;
    if (counted === null) {
      return (
        <AmountKeypad
          initial={drawer?.expected ?? 0}
          confirmLabel={(a) => `Count ${gbp(a)}`}
          busy={false}
          error={error}
          onBack={resetForm}
          onConfirm={(a) => setCounted(a)}
        />
      );
    }
    const over = counted - (drawer?.expected ?? 0);
    return (
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={() => setCounted(null)}>Back</button>
        <p style={{ margin: "16px 0 4px", fontSize: 13, color: "var(--color-neutral-700)" }}>Expected {gbp(drawer?.expected ?? 0)} · counted {gbp(counted)}</p>
        <OverShort over={over} />
        {error ? <p className="fp-error">{error}</p> : null}
        <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 64, marginTop: 20, justifyContent: "center" }} disabled={busy} onClick={() => setPin(true)}>
          Continue to manager PIN
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {!drawer ? (
        <>
          <h3 style={{ marginTop: 0 }}>No drawer open</h3>
          <p style={{ color: "var(--color-neutral-700)", marginBottom: 12 }}>Open the drawer with today&apos;s starting float.</p>
          <button type="button" className="btn btn-primary" style={{ minHeight: 64 }} onClick={() => setStage({ kind: "open" })}>Open drawer</button>
        </>
      ) : drawer.closedAt ? (
        <>
          <ClosedSummary drawer={drawer} />
          <button type="button" className="btn btn-primary" style={{ minHeight: 64, marginTop: 16 }} onClick={() => setStage({ kind: "open" })}>Open a new drawer</button>
        </>
      ) : (
        <>
          <div style={{ textAlign: "center", margin: "8px 0 16px" }}>
            <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>Expected in drawer</span>
            <span className="pos-bignum" style={{ display: "block" }}>{gbp(drawer.expected)}</span>
          </div>
          <div className="pos-osection">
            <Row label="Float" value={drawer.float} />
            <Row label="Cash sales" value={drawer.cashSales} />
            <Row label="Cash refunds" value={-drawer.cashRefunds} />
            <Row label="Pay-ins" value={drawer.payIns} />
            <Row label="Driver hand-ins" value={drawer.driverHandIns} />
            <Row label="Pay-outs" value={-drawer.payOuts} />
          </div>
          <div style={{ display: "flex", gap: 10, margin: "14px 0" }}>
            <button type="button" className="btn btn-secondary" style={{ minHeight: 60, flex: 1 }} onClick={() => setStage({ kind: "movement", move: "pay_in" })}>Pay in</button>
            <button type="button" className="btn btn-secondary" style={{ minHeight: 60, flex: 1 }} onClick={() => setStage({ kind: "movement", move: "pay_out" })}>Pay out</button>
            <button type="button" className="btn btn-primary" style={{ minHeight: 60, flex: 1 }} onClick={() => setStage({ kind: "count" })}>Count &amp; close</button>
          </div>
          {drawer.movements.length ? (
            <div className="pos-osection">
              <span className="pos-osection-label">Today&apos;s movements</span>
              {[...drawer.movements].reverse().map((m) => <MovementRow key={m.id} m={m} />)}
            </div>
          ) : null}
        </>
      )}
      {loadError ? <p className="fp-error" style={{ marginTop: 12 }}>{loadError}</p> : null}
    </div>
  );
}
