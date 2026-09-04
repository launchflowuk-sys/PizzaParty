"use client";
import Link from "next/link";
import { useState } from "react";
import { useBasket } from "@/components/basket/store";
import { gbp } from "@/lib/money";
import { OptionPicker, useSelection, type PickerProduct } from "./OptionPicker";

/** Product actions, styled to `Farm Pizza.dc.html`: a segmented quantity stepper beside
 *  a full-width primary whose label is flush left and total flush right, above a 2px rule.
 *  Adding no longer navigates away - the prototype keeps you on the product and raises a
 *  toast, so you can add a second one without going back. */
export function AddToBasket({ product }: { product: PickerProduct }) {
  const state = useSelection(product);
  const add = useBasket((s) => s.add);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);
  const { sel } = state;

  function submit() {
    add({
      kind: "product", product: product.slug, size: sel.size, modifiers: sel.modifiers, qty,
      notes: notes.trim() || undefined, name: product.name, detail: sel.detail,
      unitPrice: sel.unitPrice, lineTotal: sel.unitPrice * qty,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2600);
  }

  return (
    <div>
      <OptionPicker product={product} state={state} />

      <div className="field" style={{ marginTop: 28 }}>
        <label htmlFor="notes">Notes for the kitchen (optional)</label>
        <input id="notes" className="input" maxLength={200} placeholder="e.g. no onions, well done" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, borderTop: "2px solid var(--color-divider)", paddingTop: 20, marginTop: 32 }}>
        <div className="seg">
          <button
            type="button" className="seg-opt" aria-label="Decrease quantity"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            style={{ background: "none", border: 0, font: "inherit", fontSize: 16, cursor: "pointer", width: 40, justifyContent: "center" }}
          >
            &minus;
          </button>
          <span className="seg-opt" aria-live="polite" style={{ minWidth: 44, justifyContent: "center", fontWeight: 600 }}>{qty}</span>
          <button
            type="button" className="seg-opt" aria-label="Increase quantity"
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            style={{ background: "none", border: 0, borderLeft: "1px solid var(--color-divider)", font: "inherit", fontSize: 16, cursor: "pointer", width: 40, justifyContent: "center" }}
          >
            +
          </button>
        </div>
        <button
          className="btn btn-primary"
          style={{ flex: 1, justifyContent: "space-between", padding: "12px 16px" }}
          disabled={!sel.valid || product.soldOut}
          onClick={submit}
        >
          <span>{product.soldOut ? "Sold out" : "Add to basket"}</span>
          <span>{gbp(sel.unitPrice * qty)}</span>
        </button>
      </div>

      {added ? (
        <div
          role="status"
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 20,
            background: "var(--color-text)", color: "var(--color-bg)", padding: "12px 16px",
            display: "flex", gap: 20, alignItems: "center", fontSize: 14, boxShadow: "var(--shadow-lg)",
          }}
        >
          <span>Added {product.name}</span>
          <Link href="/basket" style={{ color: "var(--color-accent-400)" }}>View basket</Link>
        </div>
      ) : null}
    </div>
  );
}
