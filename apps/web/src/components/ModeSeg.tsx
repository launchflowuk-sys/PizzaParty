"use client";
import { useBasket } from "@/components/basket/store";
import type { Fulfilment } from "@/lib/basket-types";

const MODES: { id: Fulfilment; label: string }[] = [
  { id: "delivery", label: "Delivery" },
  { id: "collection", label: "Collection" },
];

/** The nav's order-mode control. Matches `.seg` in the Modernist system. */
export function ModeSeg({ fulfilment }: { fulfilment: Fulfilment[] }) {
  const mode = useBasket((s) => s.fulfilment);
  const setFulfilment = useBasket((s) => s.setFulfilment);
  const modes = MODES.filter((m) => fulfilment.includes(m.id));
  if (modes.length < 2) return null;
  return (
    <div className="seg" role="radiogroup" aria-label="Order mode">
      {modes.map((m) => (
        <label key={m.id} className="seg-opt" style={{ whiteSpace: "nowrap" }}>
          <input type="radio" name="mode-nav" checked={mode === m.id} onChange={() => setFulfilment(m.id)} />
          {m.label}
        </label>
      ))}
    </div>
  );
}
