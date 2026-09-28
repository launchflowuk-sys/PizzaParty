"use client";
import { useState } from "react";

const QUICK_TABLES = Array.from({ length: 20 }, (_, i) => String(i + 1));

/** Eat-in table picker (POS-PLAN item 32): shown before the grid, same idea as CustomerPanel's phone stage. */
export function EatInPanel({ initial, onContinue }: { initial: string; onContinue: (table: string) => void }) {
  const [table, setTable] = useState(QUICK_TABLES.includes(initial) ? initial : "");
  const [custom, setCustom] = useState(QUICK_TABLES.includes(initial) ? "" : initial);

  const value = table || custom.trim();

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22 }}>Which table?</h2>
      <div className="pos-chip-grid" style={{ marginTop: 12 }}>
        {QUICK_TABLES.map((n) => (
          <button
            key={n} type="button" className="pos-chip" data-state={table === n ? "whole" : undefined}
            style={{ minHeight: 60, fontSize: 18 }}
            onClick={() => { setTable(n); setCustom(""); }}
          >
            {n}
          </button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 16, maxWidth: 260 }}>
        <span>Other table / reference</span>
        <input
          className="input" style={{ minHeight: 56, fontSize: 16 }} placeholder="e.g. Patio 2"
          value={custom} onChange={(e) => { setCustom(e.target.value); setTable(""); }}
        />
      </label>
      <button type="button" className="btn btn-primary" style={{ minHeight: 60, marginTop: 20, minWidth: 220, fontSize: 17 }} disabled={!value} onClick={() => onContinue(value)}>
        Continue
      </button>
    </div>
  );
}
