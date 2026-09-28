"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BasketLine, Fulfilment } from "@/lib/basket-types";
import type { PosBasket, PosCustomer, PosDiscount, PosPriced } from "@/lib/pos-types";

const genKey = () => Math.random().toString(36).slice(2, 10);

export type DeliveryAddress = { line1: string; line2: string; city: string; postcode: string };

/**
 * The till's own basket and pricing state.
 *
 * Deliberately NOT components/basket/store.ts - that one persists to
 * localStorage under 'lf-basket', which would leak a customer's browser
 * basket into the till (or a till order into their browser) on a shared
 * device. This is plain React state, gone on refresh, which is exactly what
 * a till should do between orders.
 */
export function usePosOrder() {
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("collection");
  const [locationKey, setLocationKey] = useState("");
  const [address, setAddress] = useState<DeliveryAddress>({ line1: "", line2: "", city: "", postcode: "" });
  const [scheduledFor, setScheduledFor] = useState<string | undefined>(undefined);
  const [discount, setDiscount] = useState<PosDiscount | undefined>(undefined);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [walkInName, setWalkInName] = useState("");
  /** Eat-in only (POS-PLAN item 32) - not part of Fulfilment, so it rides alongside it rather than in it. */
  const [tableNumber, setTableNumber] = useState("");

  const [priced, setPriced] = useState<PosPriced | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");

  const addLine = useCallback((line: Omit<BasketLine, "key">) => {
    setLines((prev) => [...prev, { ...line, key: genKey() }]);
  }, []);
  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(50, qty) } : l))));
  }, []);
  const setLineNote = useCallback((key: string, notes: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, notes } : l)));
  }, []);
  const removeLine = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const loadLines = useCallback((next: BasketLine[]) => setLines(next.map((l) => ({ ...l, key: genKey() }))), []);

  const reset = useCallback(() => {
    setLines([]); setOrderNote(""); setFulfilment("collection"); setAddress({ line1: "", line2: "", city: "", postcode: "" });
    setScheduledFor(undefined); setDiscount(undefined); setCustomer(null); setWalkInName(""); setPriced(null); setPricingError(""); setTableNumber("");
  }, []);

  const posBasket = useMemo<PosBasket>(
    () => ({ lines, fulfilment, postcode: address.postcode, locationKey: locationKey || undefined, discount }),
    [lines, fulfilment, address.postcode, locationKey, discount],
  );

  // Debounced server pricing. The basket never gets cleared on a pricing
  // failure - only `priced`/`pricingError` change, so a flaky /api/pos/price
  // cannot lose what has been rung up.
  const pricingKey = JSON.stringify(posBasket);
  const inFlight = useRef(0);
  useEffect(() => {
    if (!lines.length) { setPriced(null); setPricingError(""); return; }
    const t = setTimeout(async () => {
      const id = ++inFlight.current;
      setPricingLoading(true);
      try {
        const r = await fetch("/api/pos/price", { method: "POST", headers: { "content-type": "application/json" }, body: pricingKey });
        const d = (await r.json()) as PosPriced | { error?: string };
        if (id !== inFlight.current) return;
        if (!r.ok || "error" in d) { setPricingError((d as { error?: string }).error ?? "Could not price the order."); return; }
        setPriced(d as PosPriced);
        setPricingError("");
      } catch {
        if (id === inFlight.current) setPricingError("Could not reach the pricing server.");
      } finally {
        if (id === inFlight.current) setPricingLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [pricingKey, lines.length]);

  return {
    lines, addLine, setQty, setLineNote, removeLine, loadLines,
    orderNote, setOrderNote,
    fulfilment, setFulfilment,
    locationKey, setLocationKey,
    address, setAddress,
    scheduledFor, setScheduledFor,
    discount, setDiscount,
    customer, setCustomer,
    walkInName, setWalkInName,
    tableNumber, setTableNumber,
    posBasket, priced, pricingLoading, pricingError,
    reset,
  };
}

export type PosOrderState = ReturnType<typeof usePosOrder>;
