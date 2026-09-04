"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { basketCount, basketTotal, useBasket } from "./store";
import { gbp } from "@/lib/money";

const HIDE_ON = ["/basket", "/checkout", "/kitchen", "/admin", "/order/"];

export function StickyBar() {
  const lines = useBasket((s) => s.lines);
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;
  const n = basketCount(lines);
  if (n === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <Link href="/basket" className="lf-btn lf-btn-primary lf-btn-block pointer-events-auto shadow-bar max-w-lg mx-auto justify-between px-5">
        <span className="inline-flex items-center gap-2"><span className="bg-white/20 rounded-full min-w-6 h-6 px-1.5 grid place-items-center text-sm">{n}</span> View basket</span>
        <span>Checkout · {gbp(basketTotal(lines))}</span>
      </Link>
    </div>
  );
}
