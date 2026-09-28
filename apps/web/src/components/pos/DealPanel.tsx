"use client";
import { useMemo, useState } from "react";
import { gbp } from "@/lib/money";
import type { BasketComponent, BasketLine } from "@/lib/basket-types";
import { useSelection, type PickerProduct } from "@/components/product/OptionPicker";
import type { PosDeal, PosDealOption } from "./pos-client-types";
import { MultiGroupChips, SingleGroupChips, SizeChips, firstMissingLabel } from "./ProductChips";

type Pick = { product: PickerProduct; size: string; modifiers: BasketComponent["modifiers"]; extra: number; label: string };

/**
 * Deal builder for the middle panel. Same slot-by-slot idea as
 * components/deals/DealBuilder.tsx, but that one is wired to the persisted
 * customer basket and does a router.push() on completion - neither fits a
 * till panel that has to stay in place and hand off to a local basket. Kept
 * deliberately smaller: no scroll-into-view choreography, since this panel
 * never grows past a screenful on a tablet the way the full customer page did.
 */
function SlotChooser({ deal, slotIndex, n, onPick }: { deal: PosDeal; slotIndex: number; n: number; onPick: (p: Pick) => void }) {
  const slot = deal.slots[slotIndex]!;
  const [chosen, setChosen] = useState<PosDealOption | null>(slot.options.length === 1 ? slot.options[0]! : null);

  if (!chosen) {
    return (
      <div>
        <span style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>{slot.name}{slot.qty > 1 ? ` · ${n + 1} of ${slot.qty}` : ""}</span>
        <div className="pos-grid">
          {slot.options.map((o) => (
            <button key={o.slug} type="button" className="pos-tile" data-soldout={o.soldOut ? "1" : undefined} disabled={o.soldOut} onClick={() => setChosen(o)}>
              <span className="pos-tile-name">{o.name}</span>
              {o.extra ? <span className="pos-tile-price">+{gbp(o.extra)}</span> : <span className="pos-tile-price">included</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <SlotOptions product={chosen} sizeKeys={slot.sizeKeys} onBack={slot.options.length > 1 ? () => setChosen(null) : undefined} onPick={onPick} />;
}

function SlotOptions({ product, sizeKeys, onBack, onPick }: { product: PosDealOption; sizeKeys: string[]; onBack?: () => void; onPick: (p: Pick) => void }) {
  const state = useSelection(product, sizeKeys);
  const missing = firstMissingLabel(product, state);
  const base = state.sizes.find((s) => s.key === state.sel.size)?.price ?? 0;
  const extra = state.sel.unitPrice - base + product.extra;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20 }}>{product.name}</span>
        {onBack ? <button type="button" className="btn btn-ghost" onClick={onBack}>Change</button> : null}
      </div>
      <SizeChips state={state} />
      <SingleGroupChips groups={product.groups} state={state} />
      <MultiGroupChips groups={product.groups} state={state} />
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: 16, minHeight: 60, justifyContent: "space-between" }}
        disabled={!state.sel.valid}
        onClick={() => onPick({ product, size: state.sel.size, modifiers: state.sel.modifiers, extra, label: `${product.name}${state.sel.detail ? ` (${state.sel.detail})` : ""}` })}
      >
        <span>{missing ? `Choose ${missing}` : "Confirm"}</span>
        <span>{extra ? `+${gbp(extra)}` : "included"}</span>
      </button>
    </div>
  );
}

export function DealPanel({ deal, onAdd, onCancel }: { deal: PosDeal; onAdd: (line: Omit<BasketLine, "key">) => void; onCancel: () => void }) {
  const [picks, setPicks] = useState<(Pick | null)[][]>(deal.slots.map((s) => Array(s.qty).fill(null)));
  const flat = useMemo(() => picks.flatMap((arr, slot) => arr.map((p, n) => ({ slot, n, p }))), [picks]);
  const next = flat.find((x) => !x.p);
  const extra = flat.reduce((a, x) => a + (x.p?.extra ?? 0), 0);
  const total = deal.price + extra;

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>{deal.name}</span>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onCancel}>Back to grid (Esc)</button>
      </div>

      <ol style={{ listStyle: "none", margin: "16px 0", padding: 0, borderTop: "2px solid var(--color-divider)" }}>
        {flat.map((x) => (
          <li key={`${x.slot}-${x.n}`} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
            <span>{deal.slots[x.slot]!.name}{x.p ? ` — ${x.p.label}` : ""}</span>
            {x.p ? (
              <button type="button" className="btn btn-ghost" onClick={() => setPicks((prev) => prev.map((arr, s) => (s === x.slot ? arr.map((p, i) => (i === x.n ? null : p)) : arr)))}>
                Change
              </button>
            ) : (
              <span className="tag tag-neutral">To choose</span>
            )}
          </li>
        ))}
      </ol>

      {next ? <SlotChooser deal={deal} slotIndex={next.slot} n={next.n} onPick={(p) => setPicks((prev) => prev.map((arr, s) => (s === next.slot ? arr.map((v, i) => (i === next.n ? p : v)) : arr)))} /> : null}

      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: 20, minHeight: 64, fontSize: 16, justifyContent: "space-between", padding: "14px 20px" }}
        disabled={!!next}
        onClick={() => {
          const components: BasketComponent[] = flat.map((x) => ({ slot: x.slot, product: x.p!.product.slug, size: x.p!.size, modifiers: x.p!.modifiers }));
          onAdd({ kind: "deal", deal: deal.slug, components, qty: 1, name: deal.name, detail: flat.map((x) => x.p!.label).join(", "), unitPrice: total, lineTotal: total });
        }}
      >
        <span>{next ? `Choose ${deal.slots[next.slot]!.name.toLowerCase()}` : "Add deal to order"}</span>
        <span>{gbp(total)}</span>
      </button>
    </div>
  );
}
