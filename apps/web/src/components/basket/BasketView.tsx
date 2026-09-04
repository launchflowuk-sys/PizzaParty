"use client";
import Link from "next/link";
import { useState } from "react";
import { useBasket } from "./store";
import { useServerPrice } from "./useServerPrice";
import { gbp } from "@/lib/money";

export function BasketView() {
  const { lines, setQty, remove, fulfilment, setFulfilment, promoCode, setPromo, postcode } = useBasket();
  const { data, loading } = useServerPrice();
  const [code, setCode] = useState(promoCode);
  const [suggest, setSuggest] = useState<{ name: string; href: string; price: number }[] | null>(null);

  if (lines.length === 0) {
    return (
      <div className="lf-card p-8 mt-6 text-center">
        <p className="text-muted">Your basket is empty.</p>
        <Link href="/menu" className="lf-btn lf-btn-primary mt-4">Browse the menu</Link>
      </div>
    );
  }

  const canCheckout = data && data.errors.length === 0 && data.lines.length > 0 && !loading;

  return (
    <div className="mt-4 space-y-4">
      <div className="lf-card divide-y divide-line">
        {lines.map((l) => (
          <div key={l.key} className="p-4 flex gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{l.name ?? l.product ?? l.deal}</p>
              {l.detail ? <p className="text-sm text-muted">{l.detail}</p> : null}
              {l.notes ? <p className="text-sm text-muted italic">“{l.notes}”</p> : null}
              <div className="mt-2 flex items-center gap-2">
                <button className="w-9 h-9 rounded-full border border-line" aria-label="Decrease" onClick={() => setQty(l.key, l.qty - 1)}>−</button>
                <span className="w-6 text-center font-bold">{l.qty}</span>
                <button className="w-9 h-9 rounded-full border border-line" aria-label="Increase" onClick={() => setQty(l.key, l.qty + 1)}>+</button>
                <button className="ml-2 text-xs text-muted underline" onClick={() => remove(l.key)}>Remove</button>
              </div>
            </div>
            <p className="font-bold">{l.lineTotal != null ? gbp(l.lineTotal) : "…"}</p>
          </div>
        ))}
      </div>

      <div className="lf-card p-4">
        <p className="lf-label">How do you want it?</p>
        <div className="grid grid-cols-2 gap-2">
          {(["delivery", "collection"] as const).map((f) => (
            <button key={f} className={`lf-btn ${fulfilment === f ? "lf-btn-secondary" : "lf-btn-ghost"}`} onClick={() => setFulfilment(f)}>{f === "delivery" ? "Delivery" : "Collection"}</button>
          ))}
        </div>
        {fulfilment === "delivery" ? <p className="text-sm text-muted mt-2">{postcode ? `Delivering to ${postcode}${data?.location ? ` from ${data.location.name}` : ""}.` : "Enter your postcode at checkout."}</p> : null}
      </div>

      <div className="lf-card p-4">
        <label className="lf-label" htmlFor="promo">Promo code</label>
        <div className="flex gap-2">
          <input id="promo" className="lf-input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. WELCOME10" />
          <button className="lf-btn lf-btn-ghost shrink-0" onClick={() => setPromo(code.trim().toUpperCase())}>Apply</button>
        </div>
        {data?.promoMessage ? <p className={`text-sm mt-2 ${data.promoCode ? "text-success" : "text-danger"}`}>{data.promoMessage}</p> : null}
      </div>

      {data?.errors.length ? <div className="lf-card p-4 border border-danger/40 text-danger text-sm">{data.errors.map((e) => <p key={e}>{e}</p>)}</div> : null}

      <Upsells onLoad={setSuggest} items={suggest} />

      <div className="lf-card p-4 text-sm space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{data ? gbp(data.subtotal) : "…"}</span></div>
        {fulfilment === "delivery" ? <div className="flex justify-between"><span>Delivery</span><span>{data ? gbp(data.deliveryFee) : "…"}</span></div> : null}
        {data?.discount ? <div className="flex justify-between text-success"><span>Discount</span><span>−{gbp(data.discount)}</span></div> : null}
        <div className="flex justify-between font-extrabold text-base pt-2 border-t border-line"><span>Total</span><span>{data ? gbp(data.total) : "…"}</span></div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-surface/95 backdrop-blur border-t border-line">
        <Link href="/checkout" aria-disabled={!canCheckout} className={`lf-btn lf-btn-primary lf-btn-block max-w-lg mx-auto justify-between px-5 ${canCheckout ? "" : "pointer-events-none opacity-50"}`}>
          <span>Checkout</span><span>{data ? gbp(data.total) : ""}</span>
        </Link>
      </div>
    </div>
  );
}

function Upsells({ items, onLoad }: { items: { name: string; href: string; price: number }[] | null; onLoad: (i: { name: string; href: string; price: number }[]) => void }) {
  const lines = useBasket((s) => s.lines);
  if (items === null) {
    fetch("/api/basket/upsells", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ products: lines.map((l) => l.product).filter(Boolean) }) })
      .then((r) => r.json()).then((d) => onLoad(d.items ?? [])).catch(() => onLoad([]));
    return null;
  }
  if (!items.length) return null;
  return (
    <div>
      <p className="lf-label">Add something?</p>
      <ul className="flex gap-2 overflow-x-auto hide-scrollbar">
        {items.map((u) => <li key={u.href} className="shrink-0"><Link href={u.href} className="lf-card block px-3 py-2 text-sm"><span className="font-semibold">{u.name}</span> <span className="text-muted">{gbp(u.price)}</span></Link></li>)}
      </ul>
    </div>
  );
}
