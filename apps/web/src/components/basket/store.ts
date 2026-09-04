"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BasketLine, Fulfilment } from "@/lib/basket-types";

export type BasketState = {
  lines: BasketLine[];
  fulfilment: Fulfilment;
  postcode: string;
  locationKey: string;
  promoCode: string;
  add: (line: Omit<BasketLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setFulfilment: (f: Fulfilment) => void;
  setPostcode: (postcode: string, locationKey: string) => void;
  setPromo: (code: string) => void;
  replace: (lines: BasketLine[]) => void;
};

const sameLine = (a: Omit<BasketLine, "key">, b: BasketLine) =>
  a.kind === b.kind && a.product === b.product && a.size === b.size && a.deal === b.deal && (a.notes ?? "") === (b.notes ?? "") &&
  JSON.stringify(a.modifiers ?? []) === JSON.stringify(b.modifiers ?? []) && JSON.stringify(a.components ?? []) === JSON.stringify(b.components ?? []);

export const useBasket = create<BasketState>()(
  persist(
    (set, get) => ({
      lines: [],
      fulfilment: "delivery",
      postcode: "",
      locationKey: "",
      promoCode: "",
      add: (line) => {
        const existing = get().lines.find((l) => sameLine(line, l));
        if (existing) return set({ lines: get().lines.map((l) => (l.key === existing.key ? { ...l, qty: Math.min(20, l.qty + line.qty) } : l)) });
        set({ lines: [...get().lines, { ...line, key: Math.random().toString(36).slice(2, 10) }] });
      },
      setQty: (key, qty) => set({ lines: qty <= 0 ? get().lines.filter((l) => l.key !== key) : get().lines.map((l) => (l.key === key ? { ...l, qty: Math.min(20, qty) } : l)) }),
      remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),
      clear: () => set({ lines: [], promoCode: "" }),
      setFulfilment: (fulfilment) => set({ fulfilment }),
      setPostcode: (postcode, locationKey) => set({ postcode, locationKey }),
      setPromo: (promoCode) => set({ promoCode }),
      replace: (lines) => set({ lines }),
    }),
    { name: "lf-basket", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

export const basketCount = (lines: BasketLine[]) => lines.reduce((a, l) => a + l.qty, 0);
export const basketTotal = (lines: BasketLine[]) => lines.reduce((a, l) => a + (l.lineTotal ?? 0), 0);
