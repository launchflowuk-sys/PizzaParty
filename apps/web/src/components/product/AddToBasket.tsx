"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBasket } from "@/components/basket/store";
import { gbp } from "@/lib/money";
import { OptionPicker, useSelection, type PickerProduct } from "./OptionPicker";

export function AddToBasket({ product }: { product: PickerProduct }) {
  const state = useSelection(product);
  const add = useBasket((s) => s.add);
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);
  const { sel } = state;

  function submit() {
    add({ kind: "product", product: product.slug, size: sel.size, modifiers: sel.modifiers, qty, notes: notes.trim() || undefined, name: product.name, detail: sel.detail, unitPrice: sel.unitPrice, lineTotal: sel.unitPrice * qty });
    setAdded(true);
    setTimeout(() => router.push("/menu"), 400);
  }

  return (
    <div>
      <OptionPicker product={product} state={state} />
      <div className="mt-6">
        <label className="lf-label" htmlFor="notes">Notes for the kitchen (optional)</label>
        <input id="notes" className="lf-input" maxLength={200} placeholder="e.g. no onions, well done" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-surface/95 backdrop-blur border-t border-line">
        <div className="max-w-lg mx-auto flex gap-2">
          <div className="flex items-center lf-card border border-line">
            <button className="w-11 h-11 text-xl" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span className="w-8 text-center font-bold" aria-live="polite">{qty}</span>
            <button className="w-11 h-11 text-xl" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
          </div>
          <button className="lf-btn lf-btn-primary flex-1 justify-between px-5" disabled={!sel.valid || product.soldOut} onClick={submit}>
            <span>{added ? "Added ✓" : product.soldOut ? "Sold out" : "Add"}</span>
            <span>{gbp(sel.unitPrice * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
