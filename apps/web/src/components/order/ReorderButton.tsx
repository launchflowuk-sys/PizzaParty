"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBasket } from "@/components/basket/store";
import type { BasketLine } from "@/lib/basket-types";

export function ReorderButton({ orderId, label = "Order again" }: { orderId: string; label?: string }) {
  const router = useRouter();
  const replace = useBasket((s) => s.replace);
  const [msg, setMsg] = useState("");
  async function go() {
    const r = await fetch(`/api/orders/${orderId}/reorder`, { method: "POST" });
    const d = (await r.json()) as { lines: BasketLine[]; errors: string[] };
    if (!r.ok) { setMsg("Couldn't rebuild that order."); return; }
    replace(d.lines);
    if (d.errors.length) setMsg(d.errors[0]!);
    router.push("/basket");
  }
  return (
    <span>
      <button className="btn btn-primary" onClick={go}>{label}</button>
      {msg ? <span className="block text-xs fp-error mt-1">{msg}</span> : null}
    </span>
  );
}
