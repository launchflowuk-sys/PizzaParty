"use client";
import { useCallback, useEffect, useState } from "react";
import { gbp } from "@/lib/money";
import type { PosPriceChange, PosPriceChanges } from "@/lib/pos-reports-types";

async function readJson<T>(r: Response): Promise<T | { error: string }> {
  try { return await r.json(); } catch { return { error: "Unexpected response from the server." }; }
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Price change log (docs/POS-PLAN.md item 27): every menu price edit, who and when. Manager only. */
export function PriceHistoryPanel() {
  const [from, setFrom] = useState(() => isoDaysAgo(6));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [changes, setChanges] = useState<PosPriceChange[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (f: string, t: string) => {
    try {
      const r = await fetch(`/api/pos/reports/price-changes?from=${f}&to=${t}`, { cache: "no-store" });
      const res = await readJson<PosPriceChanges>(r);
      if (!r.ok || "error" in res) { setLoadError((res as { error?: string }).error ?? "Could not load price changes."); return; }
      setChanges((res as PosPriceChanges).changes);
      setLoadError("");
    } catch {
      setLoadError("Could not reach the server.");
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(from, to); }, []);

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="field" style={{ maxWidth: 200 }}>
          <span>From</span>
          <input className="input" style={{ minHeight: 48 }} type="date" value={from} onChange={(e) => { setFrom(e.target.value); void load(e.target.value, to); }} />
        </label>
        <label className="field" style={{ maxWidth: 200 }}>
          <span>To</span>
          <input className="input" style={{ minHeight: 48 }} type="date" value={to} max={isoDaysAgo(0)} onChange={(e) => { setTo(e.target.value); void load(from, e.target.value); }} />
        </label>
      </div>

      {loadError ? <p className="fp-error" style={{ marginTop: 12 }}>{loadError}</p> : null}

      {changes === null ? <p style={{ marginTop: 16 }}>Loading…</p> : changes.length === 0 ? (
        <p style={{ marginTop: 16, color: "var(--color-neutral-700)" }}>No price changes in this range.</p>
      ) : (
        <div style={{ display: "grid", gap: 6, marginTop: 16 }}>
          {changes.map((c) => (
            <div key={c.id} className="pos-oline-top">
              <span>{c.label}<span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}> · {c.actor} · {new Date(c.at).toLocaleString("en-GB")}</span></span>
              <span>{c.oldPrice !== null ? `${gbp(c.oldPrice)} → ` : "new · "}{gbp(c.newPrice)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
