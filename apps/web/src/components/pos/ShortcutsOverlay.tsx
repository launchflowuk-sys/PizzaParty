"use client";

const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: "/", does: "Search the menu" },
  { keys: "Esc", does: "Back / close" },
  { keys: "F1", does: "Till" },
  { keys: "F2", does: "Orders" },
  { keys: "F3", does: "Cash & reports" },
  { keys: "F4", does: "Phone mode" },
  { keys: "Enter", does: "Charge, or confirm a cash amount on the cash pad" },
  { keys: "+ / -", does: "Change the quantity of the last basket line" },
  { keys: "Del", does: "Remove the last basket line" },
  { keys: "Ctrl+Z", does: "Restore the last removed line" },
  { keys: "?", does: "Show / hide this list" },
];

/** Keyboard shortcuts overlay (POS-PLAN item 33). */
export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="pos-shortcuts-backdrop" onClick={onClose}>
      <div className="pos-shortcuts-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>Keyboard shortcuts</span>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onClose}>Close</button>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
              <kbd style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14 }}>{s.keys}</kbd>
              <span style={{ color: "var(--color-neutral-700)", textAlign: "right" }}>{s.does}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
