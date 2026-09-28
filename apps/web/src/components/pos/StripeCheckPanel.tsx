"use client";
import { useCallback, useEffect, useState } from "react";
import { gbp } from "@/lib/money";
import type { PosStripeReport, StripeMatchFlag } from "@/lib/pos-reports-types";
import { PinPad } from "./PinPad";

async function readJson<T>(r: Response): Promise<T | { error: string; needsPin?: boolean }> {
  try { return await r.json(); } catch { return { error: "Unexpected response from the server." }; }
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

const FLAG_TAG: Record<StripeMatchFlag, string> = { ok: "tag-ok", missing_in_stripe: "tag-warn", missing_in_till: "tag-warn", amount_mismatch: "tag-danger" };
const FLAG_LABEL: Record<StripeMatchFlag, string> = { ok: "OK", missing_in_stripe: "Missing in Stripe", missing_in_till: "Missing in till", amount_mismatch: "Amount mismatch" };

/** Stripe payout match (docs/POS-PLAN.md item 26): card takings vs Stripe's own balance transactions, manager only. */
export function StripeCheckPanel() {
  const [date, setDate] = useState("");
  const [report, setReport] = useState<PosStripeReport | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fixing, setFixing] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [fixError, setFixError] = useState("");
  const [fixResult, setFixResult] = useState("");

  const load = useCallback(async (d?: string) => {
    try {
      const url = d ? `/api/pos/reports/stripe?date=${d}` : "/api/pos/reports/stripe";
      const r = await fetch(url, { cache: "no-store" });
      const res = await readJson<PosStripeReport>(r);
      if (!r.ok || "error" in res) { setLoadError((res as { error?: string }).error ?? "Could not load the Stripe check."); return; }
      setReport(res as PosStripeReport);
      setDate((res as PosStripeReport).date);
      setLoadError("");
      setFixResult("");
    } catch {
      setLoadError("Could not reach the server.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const mismatches = report?.rows.filter((r) => r.flag !== "ok") ?? [];

  /** Re-run recordStripeRefunds for every mismatched PaymentIntent, then show the fresh match (docs/POS-PLAN.md item 26). */
  async function fixMismatches(managerPin?: string) {
    setFixing(true); setFixError("");
    const before = report?.mismatches ?? 0;
    try {
      const r = await fetch(`/api/pos/reports/stripe/reconcile?date=${date}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ managerPin }),
      });
      const d = await readJson<PosStripeReport & { checked: number }>(r);
      if (!r.ok || "error" in d) {
        const err = d as { error?: string; needsPin?: boolean };
        if (err.needsPin) { setShowPin(true); setFixError(err.error ?? "Manager PIN needed."); return; }
        throw new Error(err.error ?? "Could not fix the mismatches.");
      }
      const res = d as PosStripeReport & { checked: number };
      const fixed = Math.max(0, before - res.mismatches);
      setFixResult(`Checked ${res.checked} payment${res.checked === 1 ? "" : "s"}, fixed ${fixed}.`);
      setReport(res);
      setShowPin(false);
    } catch (e) {
      setFixError(getErrorMessage(e));
    } finally {
      setFixing(false);
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <label className="field" style={{ maxWidth: 220 }}>
        <span>Date</span>
        <input className="input" style={{ minHeight: 48 }} type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => void load(e.target.value)} />
      </label>

      {loadError ? <p className="fp-error" style={{ marginTop: 12 }}>{loadError}</p> : null}

      {!report ? <p style={{ marginTop: 16 }}>Loading…</p> : !report.configured ? (
        <p style={{ marginTop: 16, color: "var(--color-neutral-700)" }}>Stripe isn&apos;t set up for this shop yet.</p>
      ) : (
        <>
          {report.error ? <p className="fp-error" style={{ marginTop: 12 }}>Could not reach Stripe: {report.error}</p> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, margin: "16px 0" }}>
            <div className="pos-osection">
              <span className="pos-osection-label">Stripe</span>
              <div className="pos-oline-top"><span>Charges</span><span>{gbp(report.stripe.charges)}</span></div>
              <div className="pos-oline-top"><span>Refunds</span><span>-{gbp(report.stripe.refunds)}</span></div>
              <div className="pos-oline-top"><span>Fees</span><span>-{gbp(report.stripe.fees)}</span></div>
              <div className="pos-oline-top" style={{ fontWeight: 800 }}><span>Net</span><span>{gbp(report.stripe.net)}</span></div>
            </div>
            <div className="pos-osection">
              <span className="pos-osection-label">Till</span>
              <div className="pos-oline-top"><span>Card online</span><span>{gbp(report.till.card)}</span></div>
              <div className="pos-oline-top"><span>Card reader</span><span>{gbp(report.till.reader)}</span></div>
              <div className="pos-oline-top"><span>Refunds</span><span>-{gbp(report.till.refunds)}</span></div>
            </div>
          </div>

          <div className="pos-q-card-row" style={{ alignItems: "center" }}>
            <p style={{ fontWeight: 700, margin: 0 }}>{report.mismatches === 0 ? "Everything matches." : `${report.mismatches} mismatch${report.mismatches === 1 ? "" : "es"}`}</p>
            {mismatches.length > 0 ? (
              <button type="button" className="btn btn-secondary" style={{ minHeight: 48 }} disabled={fixing} onClick={() => void fixMismatches()}>
                {fixing ? "Fixing…" : "Fix mismatches"}
              </button>
            ) : null}
          </div>
          {fixResult ? <p style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 4 }}>{fixResult}</p> : null}
          {fixError && !showPin ? <p className="fp-error" style={{ marginTop: 4 }}>{fixError}</p> : null}
          {showPin ? (
            <div style={{ marginTop: 12, maxWidth: 340 }}>
              <PinPad
                label="Fix mismatches"
                busy={fixing}
                error={fixError}
                onCancel={() => { setShowPin(false); setFixError(""); }}
                onSubmit={(p) => void fixMismatches(p)}
              />
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {mismatches.length === 0 ? <p style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>No mismatches for this day.</p> : mismatches.map((r, i) => (
              <div key={i} className="pos-osection">
                <div className="pos-q-card-row">
                  <span className={`tag ${FLAG_TAG[r.flag]}`}>{FLAG_LABEL[r.flag]}</span>
                  <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{r.type} · {new Date(r.at).toLocaleString("en-GB")}</span>
                </div>
                <div className="pos-oline-top">
                  <span>{r.orderNumber ? `#${r.orderNumber}` : r.paymentIntent}{r.kind ? ` · ${r.kind}` : ""}</span>
                  <span>{r.till !== null ? `Till ${gbp(r.till)}` : "—"} / {r.stripeGross !== null ? `Stripe ${gbp(r.stripeGross)}` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
