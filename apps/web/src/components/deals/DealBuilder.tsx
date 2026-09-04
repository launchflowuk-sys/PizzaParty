"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBasket } from "@/components/basket/store";
import { gbp } from "@/lib/money";
import type { BasketComponent } from "@/lib/basket-types";
import { OptionPicker, useSelection, type PickerProduct } from "@/components/product/OptionPicker";

export type BuilderDeal = {
  slug: string; name: string; price: number;
  slots: { name: string; qty: number; sizeKeys: string[]; options: PickerProduct[] }[];
};

type Pick = { product: PickerProduct; size: string; modifiers: BasketComponent["modifiers"]; extra: number; label: string };

function SlotPicker({ deal, slotIndex, n, onPick }: { deal: BuilderDeal; slotIndex: number; n: number; onPick: (p: Pick) => void }) {
  const slot = deal.slots[slotIndex]!;
  const [chosen, setChosen] = useState<PickerProduct | null>(slot.options.length === 1 ? slot.options[0]! : null);
  return (
    <div className="lf-card p-4">
      <p className="font-bold">{slot.name} {slot.qty > 1 ? `(${n + 1} of ${slot.qty})` : ""}</p>
      {!chosen ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {slot.options.map((o) => (
            <li key={o.slug}>
              <button className="w-full text-left p-3 rounded-xl border border-line hover:border-brand disabled:opacity-40" disabled={o.soldOut} onClick={() => setChosen(o)}>{o.name}{o.soldOut ? " (sold out)" : ""}</button>
            </li>
          ))}
        </ul>
      ) : (
        <ChosenOptions product={chosen} sizeKeys={slot.sizeKeys} onBack={slot.options.length > 1 ? () => setChosen(null) : undefined} onPick={onPick} />
      )}
    </div>
  );
}

function ChosenOptions({ product, sizeKeys, onBack, onPick }: { product: PickerProduct; sizeKeys: string[]; onBack?: () => void; onPick: (p: Pick) => void }) {
  const state = useSelection(product, sizeKeys);
  const base = state.sizes.find((s) => s.key === state.sel.size)?.price ?? 0;
  const extra = state.sel.unitPrice - base;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between"><p className="font-semibold">{product.name}</p>{onBack ? <button className="text-sm text-brand underline" onClick={onBack}>Change</button> : null}</div>
      <div className="mt-3"><OptionPicker product={product} state={state} /></div>
      <button className="lf-btn lf-btn-secondary mt-4" disabled={!state.sel.valid} onClick={() => onPick({ product, size: state.sel.size, modifiers: state.sel.modifiers, extra, label: `${product.name}${state.sel.detail ? ` (${state.sel.detail})` : ""}` })}>
        Confirm{extra ? ` (+${gbp(extra)})` : ""}
      </button>
    </div>
  );
}

export function DealBuilder({ deal }: { deal: BuilderDeal }) {
  const add = useBasket((s) => s.add);
  const router = useRouter();
  const [picks, setPicks] = useState<(Pick | null)[][]>(deal.slots.map((s) => Array(s.qty).fill(null)));
  const flat = useMemo(() => picks.flatMap((arr, slot) => arr.map((p, n) => ({ slot, n, p }))), [picks]);
  const next = flat.find((x) => !x.p);
  const extra = flat.reduce((a, x) => a + (x.p?.extra ?? 0), 0);
  const total = deal.price + extra;

  function done() {
    const components: BasketComponent[] = flat.map((x) => ({ slot: x.slot, product: x.p!.product.slug, size: x.p!.size, modifiers: x.p!.modifiers }));
    add({ kind: "deal", deal: deal.slug, components, qty: 1, name: deal.name, detail: flat.map((x) => x.p!.label).join(", "), unitPrice: total, lineTotal: total });
    router.push("/basket");
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {flat.map((x) => (
          <li key={`${x.slot}-${x.n}`} className={`flex items-center justify-between p-3 rounded-xl border ${x.p ? "border-success/40 bg-success/5" : next && next.slot === x.slot && next.n === x.n ? "border-brand" : "border-line"}`}>
            <span className="text-sm"><span className="font-semibold">{deal.slots[x.slot]!.name}</span>{x.p ? `: ${x.p.label}` : ""}</span>
            {x.p ? <button className="text-xs underline" onClick={() => setPicks((prev) => prev.map((arr, s) => (s === x.slot ? arr.map((p, i) => (i === x.n ? null : p)) : arr)))}>change</button> : null}
          </li>
        ))}
      </ol>
      {next ? (
        <SlotPicker key={`${next.slot}-${next.n}`} deal={deal} slotIndex={next.slot} n={next.n} onPick={(p) => setPicks((prev) => prev.map((arr, s) => (s === next.slot ? arr.map((v, i) => (i === next.n ? p : v)) : arr)))} />
      ) : null}
      <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-surface/95 backdrop-blur border-t border-line">
        <button className="lf-btn lf-btn-primary lf-btn-block max-w-lg mx-auto justify-between px-5" disabled={!!next} onClick={done}>
          <span>{next ? `Choose ${deal.slots[next.slot]!.name.toLowerCase()}` : "Add deal to basket"}</span><span>{gbp(total)}</span>
        </button>
      </div>
    </div>
  );
}
