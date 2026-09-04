"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { basketCount, basketTotal, useBasket } from "./store";
import { gbp } from "@/lib/money";

/** The nav's primary action. The prototype renders the basket as a solid accent button
 *  labelled "Basket · N · £x.xx", falling back to "Basket" while empty. */
export function BasketBadge() {
  const lines = useBasket((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const n = mounted ? basketCount(lines) : 0;
  const total = mounted ? basketTotal(lines) : 0;
  return (
    <Link
      href="/basket"
      className="btn btn-primary"
      style={{ color: "var(--color-bg)", fontSize: 14, whiteSpace: "nowrap" }}
      aria-label={n > 0 ? `Basket, ${n} items, ${gbp(total)}` : "Basket, empty"}
    >
      {n > 0 ? `Basket · ${n} · ${gbp(total)}` : "Basket"}
    </Link>
  );
}
