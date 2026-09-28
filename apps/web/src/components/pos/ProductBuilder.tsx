"use client";
import { useMemo, useState } from "react";
import { gbp } from "@/lib/money";
import { useSelection, type PickerProduct } from "@/components/product/OptionPicker";
import type { BasketLine } from "@/lib/basket-types";
import type { PosProduct } from "./pos-client-types";
import { SizeChips, SingleGroupChips, firstMissingLabel } from "./ProductChips";

type Placement = "left" | "right";

/**
 * Half-and-half toppings.
 *
 * The pricing engine (lib/pricing.ts, frozen for this build) only knows whole
 * modifiers - there is no concept of "left half" on the wire. So the modifier
 * is still sent normally (full price, full topping), and the placement is
 * recorded in the line's plain-text `notes` for the kitchen to read, e.g.
 * "Mushroom: left half". Simple, and it is exactly what the ticket needs to
 * print - see docs/POS-PLAN.md item 4 and this agent's handback report for
 * the fuller reasoning.
 *
 * Applied to every multi-select group (maxSelect > 1) on the product, since
 * the contract has no flag marking which groups are "toppings" specifically.
 */
function cycleKey(group: string, mod: string) { return `${group}:${mod}`; }

export function ProductBuilder({ product, onAdd, onCancel }: { product: PosProduct; onAdd: (line: Omit<BasketLine, "key">) => void; onCancel: () => void }) {
  const picker: PickerProduct = product;
  const state = useSelection(picker);
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const multiGroups = useMemo(() => picker.groups.filter((g) => g.maxSelect > 1), [picker]);
  const missing = firstMissingLabel(picker, state);

  function cycle(groupKey: string, modKey: string) {
    const group = multiGroups.find((g) => g.key === groupKey);
    if (!group) return;
    const key = cycleKey(groupKey, modKey);
    const selected = state.mods.some((m) => m.group === groupKey && m.modifier === modKey);
    const placement = placements[key];
    if (!selected) {
      // Freshly selected: whole, which is simply "no entry" in `placements`.
      state.toggle(group, modKey);
      return;
    }
    if (!placement) { setPlacements((p) => ({ ...p, [key]: "left" })); return; }
    if (placement === "left") { setPlacements((p) => ({ ...p, [key]: "right" })); return; }
    // right -> off
    state.toggle(group, modKey);
    setPlacements((p) => { const rest = { ...p }; delete rest[key]; return rest; });
  }

  const halfNotes = useMemo(() => {
    const out: string[] = [];
    for (const g of multiGroups) {
      for (const m of g.modifiers) {
        const placement = placements[cycleKey(g.key, m.key)];
        const selected = state.mods.some((x) => x.group === g.key && x.modifier === m.key);
        if (selected && placement) out.push(`${m.name}: ${placement} half`);
      }
    }
    return out;
  }, [multiGroups, placements, state.mods]);

  const notes = [note.trim(), ...halfNotes].filter(Boolean).join(" · ");
  const lineTotal = state.sel.unitPrice * qty;

  return (
    <div className="pos-builder">
      <div className="pos-builder-scroll">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>{product.name}</span>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onCancel}>Back to grid (Esc)</button>
        </div>
        {product.description ? <p style={{ color: "var(--color-neutral-700)", marginTop: 4 }}>{product.description}</p> : null}

        <SizeChips state={state} />
        <SingleGroupChips groups={picker.groups} state={state} />

        {multiGroups.map((g) => (
          <fieldset key={g.key} style={{ border: 0, margin: "10px 0 0", padding: 0 }}>
            <legend style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, padding: 0 }}>
              {g.name} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-neutral-700)" }}>(tap: whole → left → right → off)</span>
            </legend>
            <div className="pos-chip-grid">
              {g.modifiers.map((m) => {
                const selected = state.mods.some((x) => x.group === g.key && x.modifier === m.key);
                const placement = placements[cycleKey(g.key, m.key)];
                const stateLabel = !selected ? undefined : placement ?? "whole";
                return (
                  <button
                    key={m.key}
                    type="button"
                    className="pos-chip"
                    data-state={stateLabel}
                    disabled={m.soldOut}
                    onClick={() => cycle(g.key, m.key)}
                  >
                    {placement ? <span className="pos-chip-half">{placement === "left" ? "L" : "R"}</span> : null}
                    <span>{m.name}</span>
                    <span className="pos-chip-sub">{m.price ? `+${gbp(m.price)}` : ""}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="field" style={{ marginTop: 10 }}>
          <label>Note for this item (kitchen sees it)</label>
          <input className="input" style={{ minHeight: 44 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. well done, no onion" />
        </div>
      </div>

      <div className="pos-builder-footer">
        <button type="button" className="pos-qtybtn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
        <span className="pos-bignum" style={{ fontSize: 28, minWidth: 32, textAlign: "center" }}>{qty}</span>
        <button type="button" className="pos-qtybtn" onClick={() => setQty((q) => Math.min(50, q + 1))} aria-label="Increase quantity">+</button>

        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ minHeight: 64, fontSize: 16, justifyContent: "space-between", padding: "14px 20px", flex: 1 }}
          disabled={!state.sel.valid}
          onClick={() => {
            onAdd({
              kind: "product", product: product.slug, size: state.sel.size, modifiers: state.sel.modifiers, qty,
              notes: notes || undefined, name: product.name, detail: state.sel.detail, unitPrice: state.sel.unitPrice, lineTotal,
            });
          }}
        >
          <span>{missing ? `Choose ${missing}` : "Add"}</span>
          <span>{gbp(lineTotal)}</span>
        </button>
      </div>
    </div>
  );
}
