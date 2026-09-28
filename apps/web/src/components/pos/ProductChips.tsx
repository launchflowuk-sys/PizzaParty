"use client";
import { gbp } from "@/lib/money";
import { useSelection, type PickerProduct } from "@/components/product/OptionPicker";

type SelState = ReturnType<typeof useSelection>;

/**
 * Chip-based replacement for OptionPicker's radio lists, built for a touchscreen
 * till: bigger targets, no scrolling ruled list. Shared by ProductBuilder (the
 * full product customiser) and DealPanel's per-slot product chooser, so both
 * pick up the same look with one implementation.
 */

/** Size row - chip per size, name + price. Only rendered when there's a real choice. */
export function SizeChips({ state }: { state: SelState }) {
  if (state.sizes.length <= 1) return null;
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, padding: 0 }}>Size</legend>
      <div className="pos-chip-row">
        {state.sizes.map((s) => (
          <button
            key={s.key} type="button" className="pos-chip" data-state={state.size === s.key ? "whole" : undefined}
            disabled={s.soldOut} onClick={() => state.setSize(s.key)}
          >
            <span>{s.name}</span>
            <span className="pos-chip-sub">{gbp(s.price)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** One chip row per single-choice group (Base, Crust, ...). */
export function SingleGroupChips({ groups, state }: { groups: PickerProduct["groups"]; state: SelState }) {
  return (
    <>
      {groups.filter((g) => g.maxSelect === 1).map((g) => (
        <fieldset key={g.key} style={{ border: 0, margin: "10px 0 0", padding: 0 }}>
          <legend style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, padding: 0 }}>{g.name}</legend>
          <div className="pos-chip-row">
            {g.modifiers.map((m) => {
              const checked = state.mods.some((x) => x.group === g.key && x.modifier === m.key);
              return (
                <button
                  key={m.key} type="button" className="pos-chip" data-state={checked ? "whole" : undefined}
                  disabled={m.soldOut} onClick={() => state.toggle(g, m.key)}
                >
                  <span>{m.name}</span>
                  <span className="pos-chip-sub">{m.price ? `+${gbp(m.price)}` : ""}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </>
  );
}

/**
 * Plain on/off chip grid for a multi-select group - no half/half toggling.
 * Half/half needs somewhere to record "left"/"right" in free text; a deal
 * slot's BasketComponent has no notes field, only a whole BasketLine does
 * (see lib/basket-types.ts), so this is deliberately the simple version.
 * ProductBuilder has its own half-cycling chip grid for the main basket line.
 */
export function MultiGroupChips({ groups, state }: { groups: PickerProduct["groups"]; state: SelState }) {
  return (
    <>
      {groups.filter((g) => g.maxSelect > 1).map((g) => (
        <fieldset key={g.key} style={{ border: 0, margin: "10px 0 0", padding: 0 }}>
          <legend style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, padding: 0 }}>
            {g.name} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-neutral-700)" }}>(up to {g.maxSelect})</span>
          </legend>
          <div className="pos-chip-grid">
            {g.modifiers.map((m) => {
              const checked = state.mods.some((x) => x.group === g.key && x.modifier === m.key);
              return (
                <button
                  key={m.key} type="button" className="pos-chip" data-state={checked ? "whole" : undefined}
                  disabled={m.soldOut} onClick={() => state.toggle(g, m.key)}
                >
                  <span>{m.name}</span>
                  <span className="pos-chip-sub">{m.price ? `+${gbp(m.price)}` : ""}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </>
  );
}

/** First unmet requirement's label, for an Add button that says what's missing
 *  instead of just sitting disabled - e.g. "Choose Crust". Null once satisfied. */
export function firstMissingLabel(product: PickerProduct, state: SelState): string | null {
  const size = state.sizes.find((s) => s.key === state.size);
  if (!size || size.soldOut) return "size";
  for (const g of product.groups) {
    const chosen = state.mods.filter((m) => m.group === g.key).length;
    if (chosen < g.minSelect) return g.name;
  }
  return null;
}
