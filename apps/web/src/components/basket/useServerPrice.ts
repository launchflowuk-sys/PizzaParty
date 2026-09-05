"use client";
import { useEffect, useRef, useState } from "react";
import type { PricedBasket } from "@/lib/basket-types";
import { useBasket } from "./store";

export type ServerPrice = PricedBasket & {
  location: {
    key: string;
    name: string;
    /** Banded for this postcode, so it always matches what the summary charges. */
    deliveryFee: number;
    minOrder: number;
    /** The band's name, empty when no band covers this postcode. */
    band?: string;
    /** The shop's delivery time plus the band's extra minutes. */
    etaMinutes?: number;
    open: boolean;
    paused: boolean;
  } | null;
};

/** Re-prices the basket on the server whenever lines/fulfilment/postcode/promo change. Drops lines the server rejected. */
export function useServerPrice() {
  const { lines, fulfilment, postcode, locationKey, promoCode, replace } = useBasket();
  const [data, setData] = useState<ServerPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const key = JSON.stringify({ lines, fulfilment, postcode, locationKey, promoCode });
  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    fetch("/api/basket/price", { method: "POST", headers: { "content-type": "application/json" }, body: key })
      .then((r) => r.json())
      .then((d: ServerPrice) => {
        if (id !== seq.current) return;
        setData(d);
        if (d.removedKeys?.length) replace(lines.filter((l) => !d.removedKeys.includes(l.key)));
        // refresh display cache with server prices
        const priced = new Map(d.lines.map((l) => [l.key, l]));
        const changed = lines.some((l) => priced.get(l.key) && (priced.get(l.key)!.lineTotal !== l.lineTotal || priced.get(l.key)!.name !== l.name));
        if (changed) replace(lines.filter((l) => priced.has(l.key)).map((l) => ({ ...l, name: priced.get(l.key)!.name, detail: priced.get(l.key)!.detail, unitPrice: priced.get(l.key)!.unitPrice, lineTotal: priced.get(l.key)!.lineTotal })));
      })
      .catch(() => undefined)
      .finally(() => { if (id === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading };
}
