"use client";
import { useMemo, useState } from "react";
import { gbp } from "@/lib/money";
import type { BasketModifier } from "@/lib/basket-types";

export type PickerProduct = {
  slug: string; name: string; soldOut: boolean;
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

export function OptionPicker({ product, state }: { product: PickerProduct; state: ReturnType<typeof useSelection> }) {
  const { sizes, size, setSize, mods, toggle } = state;
  return (
    <div className="space-y-6">
      {sizes.length > 1 ? (
        <fieldset>
          <legend className="lf-label">Size</legend>
          <div className="grid grid-cols-3 gap-2">
            {sizes.map((s) => (
              <label key={s.key} className={`lf-card p-3 text-center cursor-pointer border-2 ${size === s.key ? "border-brand" : "border-transparent"} ${s.soldOut ? "opacity-40" : ""}`}>
                <input type="radio" name={`size-${product.slug}`} className="sr-only" value={s.key} checked={size === s.key} disabled={s.soldOut} onChange={() => setSize(s.key)} />
                <span className="block font-semibold text-sm">{s.name}</span>
                <span className="block text-sm text-muted">{gbp(s.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {product.groups.map((g) => (
        <fieldset key={g.key}>
          <legend className="lf-label">
            {g.name} <span className="font-normal text-muted">{g.minSelect > 0 ? "(required)" : g.maxSelect > 1 ? `(up to ${g.maxSelect})` : "(optional)"}</span>
          </legend>
          <div className="lf-card divide-y divide-line">
            {g.modifiers.map((m) => {
              const checked = mods.some((x) => x.group === g.key && x.modifier === m.key);
              return (
                <label key={m.key} className={`flex items-center justify-between gap-3 p-3 min-h-12 cursor-pointer ${m.soldOut ? "opacity-40" : ""}`}>
                  <span className="flex items-center gap-3">
                    <input type={g.maxSelect === 1 ? "radio" : "checkbox"} name={`${product.slug}-${g.key}`} checked={checked} disabled={m.soldOut} onChange={() => toggle(g, m.key)} className="accent-brand w-5 h-5" />
                    <span>{m.name}</span>
                  </span>
                  <span className="text-sm text-muted">{m.price ? `+${gbp(m.price)}` : ""}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
