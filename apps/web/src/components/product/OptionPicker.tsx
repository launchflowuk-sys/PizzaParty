"use client";
import { useMemo, useState } from "react";
import { gbp } from "@/lib/money";
import type { BasketModifier } from "@/lib/basket-types";

export type PickerProduct = {
  slug: string; name: string; soldOut: boolean;
  /** The short ingredient line. Shown wherever the customer is choosing between
   *  products by name alone - a list of pizza names tells them nothing. */
  description: string;
  /** Diet and heat, so the badges follow the item into the deal picker. */
  tags: string[];
  /** Pence this item adds inside the deal line it is being chosen for. Zero
   *  everywhere else, because a supplement only exists inside a deal. */
  extra?: number;
  sizes: { key: string; name: string; price: number; soldOut: boolean }[];
  groups: { key: string; name: string; minSelect: number; maxSelect: number; modifiers: { key: string; name: string; price: number; soldOut: boolean }[] }[];
};

export type Selection = { size: string; modifiers: BasketModifier[]; unitPrice: number; valid: boolean; detail: string; sizeName: string };

export function useSelection(product: PickerProduct, allowedSizes?: string[]) {
  const sizes = useMemo(() => (allowedSizes?.length ? product.sizes.filter((s) => allowedSizes.includes(s.key)) : product.sizes), [product, allowedSizes]);
  const [size, setSize] = useState(sizes.find((s) => !s.soldOut)?.key ?? sizes[0]?.key ?? "regular");
  const [mods, setMods] = useState<BasketModifier[]>(() =>
    product.groups.filter((g) => g.minSelect > 0 && g.maxSelect === 1).map((g) => ({ group: g.key, modifier: g.modifiers.find((m) => !m.soldOut)?.key ?? g.modifiers[0]!.key })),
  );
  const sel = useMemo<Selection>(() => {
    const s = sizes.find((x) => x.key === size);
    let price = s?.price ?? 0;
    const names: string[] = [];
    let valid = !!s && !s.soldOut;
    for (const g of product.groups) {
      const chosen = mods.filter((m) => m.group === g.key);
      if (chosen.length < g.minSelect || chosen.length > g.maxSelect) valid = false;
      for (const c of chosen) {
        const m = g.modifiers.find((x) => x.key === c.modifier);
        if (m) { price += m.price; if (m.price || g.maxSelect > 1) names.push(m.name); }
      }
    }
    return { size, modifiers: mods, unitPrice: price, valid, detail: [sizes.length > 1 ? s?.name ?? "" : "", ...names].filter(Boolean).join(", "), sizeName: s?.name ?? "" };
  }, [size, mods, product, sizes]);

  const toggle = (g: PickerProduct["groups"][number], key: string) => {
    setMods((prev) => {
      const others = prev.filter((m) => m.group !== g.key);
      const mine = prev.filter((m) => m.group === g.key);
      if (g.maxSelect === 1) return [...others, { group: g.key, modifier: key }];
      if (mine.some((m) => m.modifier === key)) return [...others, ...mine.filter((m) => m.modifier !== key)];
      if (mine.length >= g.maxSelect) return prev;
      return [...others, ...mine, { group: g.key, modifier: key }];
    });
  };
  return { sizes, size, setSize, mods, toggle, sel };
}

const H3: React.CSSProperties = { fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, margin: "28px 0 4px" };
const ROW: React.CSSProperties = { display: "flex", padding: "10px 0", borderTop: "1px solid var(--color-divider)" };
const LIST: React.CSSProperties = { display: "grid", borderBottom: "2px solid var(--color-divider)" };

/** Option picker, styled to the Product screen in `Farm Pizza.dc.html`: single-choice
 *  groups are ruled radio rows, multi-choice groups are a row of toggle chips. The
 *  selection and pricing logic in `useSelection` is unchanged. */
export function OptionPicker({ product, state }: { product: PickerProduct; state: ReturnType<typeof useSelection> }) {
  const { sizes, size, setSize, mods, toggle } = state;
  return (
    <div>
      {sizes.length > 1 ? (
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend style={{ ...H3, marginTop: 32, padding: 0 }}>Size</legend>
          <div style={LIST}>
            {sizes.map((s) => (
              <label key={s.key} className="radio" style={{ ...ROW, opacity: s.soldOut ? 0.45 : 1 }}>
                <input type="radio" name={`size-${product.slug}`} value={s.key} checked={size === s.key} disabled={s.soldOut} onChange={() => setSize(s.key)} />
                <span className="dot" />
                <span style={{ flex: 1 }}>{s.name}</span>
                <span style={{ color: "var(--color-neutral-700)" }}>{gbp(s.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {product.groups.map((g) =>
        g.maxSelect === 1 ? (
          <fieldset key={g.key} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ ...H3, padding: 0 }}>
              {g.name}
              {g.minSelect > 0 ? null : <span style={{ fontWeight: 400, fontSize: 13, color: "var(--color-neutral-700)" }}> (optional)</span>}
            </legend>
            <div style={LIST}>
              {g.modifiers.map((m) => {
                const checked = mods.some((x) => x.group === g.key && x.modifier === m.key);
                return (
                  <label key={m.key} className="radio" style={{ ...ROW, opacity: m.soldOut ? 0.45 : 1 }}>
                    <input type="radio" name={`${product.slug}-${g.key}`} checked={checked} disabled={m.soldOut} onChange={() => toggle(g, m.key)} />
                    <span className="dot" />
                    <span style={{ flex: 1 }}>{m.name}</span>
                    <span style={{ color: "var(--color-neutral-700)" }}>{m.price ? `+${gbp(m.price)}` : ""}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <fieldset key={g.key} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ ...H3, marginBottom: 10, padding: 0 }}>
              {g.name}
              <span style={{ fontWeight: 400, fontSize: 13, color: "var(--color-neutral-700)" }}> (up to {g.maxSelect})</span>
            </legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {g.modifiers.map((m) => {
                const checked = mods.some((x) => x.group === g.key && x.modifier === m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    className={`btn ${checked ? "btn-primary" : "btn-secondary"}`}
                    aria-pressed={checked}
                    disabled={m.soldOut}
                    onClick={() => toggle(g, m.key)}
                  >
                    {m.name}
                    {m.price ? <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.75 }}>+{gbp(m.price)}</span> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ),
      )}
    </div>
  );
}
