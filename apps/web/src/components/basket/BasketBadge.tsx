"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { basketCount, useBasket } from "./store";

export function BasketBadge() {
  const lines = useBasket((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const n = mounted ? basketCount(lines) : 0;
  return (
    <Link href="/basket" className="relative px-3 py-2 rounded-full hover:bg-surface-2" aria-label={`Basket, ${n} items`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6L5 3H2" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
      {n > 0 ? <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-brand text-brand-ink text-[11px] font-bold grid place-items-center">{n}</span> : null}
    </Link>
  );
}
