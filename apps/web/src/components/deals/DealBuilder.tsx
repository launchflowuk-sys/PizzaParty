"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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

/** One step of the deal: choose the product, then its options. */
function SlotPicker({ deal, slotIndex, n, onPick }: { deal: BuilderDeal; slotIndex: number; n: number; onPick: (p: Pick) => void }) {
  const slot = deal.slots[slotIndex]!;
  const [chosen, setChosen] = useState<PickerProduct | null>(slot.options.length === 1 ? slot.options[0]! : null);

  return (
    <div style={{ border: "2px solid var(--color-text)", padding: 20, marginTop: 20 }}>
      <span className="fp-kicker" style={{ marginBottom: 10 }}>
        {slot.name}{slot.qty > 1 ? ` · ${n + 1} of ${slot.qty}` : ""}
      </span>

      {!chosen ? (
        <div className="fp-grid fp-grid-3" style={{ marginTop: 4 }}>
          {slot.options.map((o) => (
            <button
              key={o.slug}
              className="fp-cell"
              disabled={o.soldOut}
              onClick={() => setChosen(o)}
              style={{
                textAlign: "left", background: "none", font: "inherit", cursor: o.soldOut ? "not-allowed" : "pointer",
                opacity: o.soldOut ? 0.45 : 1, minHeight: 64, justifyContent: "center", gap: 4,
              }}
            >
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>{o.name}</span>
              {o.soldOut ? <span style={{ fontSize: 12, color: "var(--color-accent-700)" }}>Sold out</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <ChosenOptions
          product={chosen}
          sizeKeys={slot.sizeKeys}
          onBack={slot.options.length > 1 ? () => setChosen(null) : undefined}
          onPick={onPick}
        />
      )}
    </div>
  );
}

function ChosenOptions({ product, sizeKeys, onBack, onPick }: { product: PickerProduct; sizeKeys: string[]; onBack?: () => void; onPick: (p: Pick) => void }) {
  const state = useSelection(product, sizeKeys);
  const base = state.sizes.find((s) => s.key === state.sel.size)?.price ?? 0;
  const extra = state.sel.unitPrice - base;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, letterSpacing: "-.015em" }}>{product.name}</span>
        {onBack ? <button className="btn btn-ghost" onClick={onBack}>Change</button> : null}
      </div>

      <OptionPicker product={product} state={state} />

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 20, minHeight: 48, justifyContent: "space-between", padding: "12px 16px" }}
        disabled={!state.sel.valid}
        onClick={() => onPick({ product, size: state.sel.size, modifiers: state.sel.modifiers, extra, label: `${product.name}${state.sel.detail ? ` (${state.sel.detail})` : ""}` })}
      >
        <span>Confirm this one</span>
        <span>{extra ? `+${gbp(extra)}` : "included"}</span>
      </button>
    </div>
  );
}

/** Deal builder. Ruled progress list of what the deal contains, the current step
 *  underneath, and a running total pinned to the bottom. */
export function DealBuilder({ deal }: { deal: BuilderDeal }) {
  const add = useBasket((s) => s.add);
  const router = useRouter();
  const [picks, setPicks] = useState<(Pick | null)[][]>(deal.slots.map((s) => Array(s.qty).fill(null)));
  const flat = useMemo(() => picks.flatMap((arr, slot) => arr.map((p, n) => ({ slot, n, p }))), [picks]);
  const next = flat.find((x) => !x.p);
  const extra = flat.reduce((a, x) => a + (x.p?.extra ?? 0), 0);
  const total = deal.price + extra;
  const donecount = flat.filter((x) => x.p).length;

  // Which step is live. Used only to know when to scroll, not to render.
  const stepRef = useRef<HTMLDivElement>(null);
  const stepKey = next ? `${next.slot}-${next.n}` : "done";
  useEffect(() => {
    const el = stepRef.current;
    if (!el) return;
    // Only correct the position when the choice has actually moved off screen,
    // so picking something already in view does not yank the page about.
    const box = el.getBoundingClientRect();
    const offScreen = box.top < 72 || box.top > window.innerHeight - 140;
    if (offScreen) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stepKey]);

  function done() {
    const components: BasketComponent[] = flat.map((x) => ({ slot: x.slot, product: x.p!.product.slug, size: x.p!.size, modifiers: x.p!.modifiers }));
    add({ kind: "deal", deal: deal.slug, components, qty: 1, name: deal.name, detail: flat.map((x) => x.p!.label).join(", "), unitPrice: total, lineTotal: total });
    router.push("/basket");
  }

  return (
    <div className="fp-hasbottombar">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span className="fp-kicker">What&rsquo;s in it</span>
        <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{donecount} of {flat.length} chosen</span>
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "2px solid var(--color-divider)" }}>
        {flat.map((x) => {
          const isNext = !!next && next.slot === x.slot && next.n === x.n;
          return (
            <li
              key={`${x.slot}-${x.n}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "12px 0", borderBottom: "1px solid var(--color-divider)",
                borderLeft: isNext ? "4px solid var(--color-accent-700)" : "4px solid transparent",
                paddingLeft: 12,
              }}
            >
              <span style={{ fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{deal.slots[x.slot]!.name}</span>
                {x.p ? <span style={{ color: "var(--color-neutral-700)" }}> — {x.p.label}</span> : null}
              </span>
              {x.p ? (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => setPicks((prev) => prev.map((arr, s) => (s === x.slot ? arr.map((p, i) => (i === x.n ? null : p)) : arr)))}
                >
                  Change
                </button>
              ) : (
                <span className={isNext ? "tag tag-accent" : "tag tag-neutral"}>{isNext ? "Choosing" : "To choose"}</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* The step you are on is scrolled back into view whenever it changes.
          Without this, finishing a step unmounts a tall picker, the page gets
          shorter under the scroll position, and the browser leaves you looking
          at the footer instead of the next choice. */}
      <div ref={stepRef} style={{ scrollMarginTop: 96 }} />

      {next ? (
        <SlotPicker
          key={`${next.slot}-${next.n}`}
          deal={deal}
          slotIndex={next.slot}
          n={next.n}
          onPick={(p) => setPicks((prev) => prev.map((arr, s) => (s === next.slot ? arr.map((v, i) => (i === next.n ? p : v)) : arr)))}
        />
      ) : null}

      <div
        style={{
          position: "fixed", insetInline: 0, bottom: 0, zIndex: 40,
          background: "var(--color-bg)", borderTop: "2px solid var(--color-divider)",
          padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        }}
      >
        <button
          className="btn btn-primary btn-block"
          style={{ maxWidth: 640, margin: "0 auto", justifyContent: "space-between", padding: "12px 16px", minHeight: 48 }}
          disabled={!!next}
          onClick={done}
        >
          <span>{next ? `Choose your ${deal.slots[next.slot]!.name.toLowerCase()}` : "Add deal to basket"}</span>
          <span>{gbp(total)}</span>
        </button>
      </div>
    </div>
  );
}
