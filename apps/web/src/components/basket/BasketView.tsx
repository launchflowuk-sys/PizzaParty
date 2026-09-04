"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useBasket } from "./store";
import { useServerPrice } from "./useServerPrice";
import { gbp } from "@/lib/money";

type Upsell = { name: string; href: string; price: number; description?: string };

/** Basket screen from `Farm Pizza.dc.html`: ruled line rows on the left under a
 *  "Goes well with" grid, and a 2px-ruled summary that sticks on the right. */
export function BasketView() {
  const { lines, setQty, remove, fulfilment, promoCode, setPromo } = useBasket();
  const { data, loading } = useServerPrice();
  const [code, setCode] = useState(promoCode);

  if (lines.length === 0) {
    return (
      <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Basket</span>
        <h1 className="fp-h1">Your basket is empty</h1>
        <p style={{ fontSize: 15, color: "var(--color-neutral-800)", margin: "12px 0 24px" }}>
          Nothing in here yet. Pick something from the menu and it will show up.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/menu" className="btn btn-primary">See the menu</Link>
          <Link href="/deals" className="btn btn-secondary">Deals</Link>
        </div>
      </section>
    );
  }

  const count = lines.reduce((a, l) => a + l.qty, 0);
  const canCheckout = !!data && data.errors.length === 0 && data.lines.length > 0 && !loading;
  const feeName = fulfilment === "delivery" ? "Delivery" : "Collection";

  return (
    <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
      <span className="fp-kicker" style={{ marginBottom: 12 }}>Basket</span>
      <h1 className="fp-h1">{count} {count === 1 ? "item" : "items"}</h1>

      <div className="fp-split-basket" style={{ marginTop: 28 }}>
        <div>
          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {lines.map((l) => (
              <div key={l.key} className="fp-basketrow">
                <div>
                  <div style={{ fontWeight: 600 }}>{l.name ?? l.product ?? l.deal}</div>
                  {l.detail ? <div style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 2 }}>{l.detail}</div> : null}
                  {l.notes ? <div style={{ fontSize: 13, color: "var(--color-neutral-700)", fontStyle: "italic", marginTop: 2 }}>&ldquo;{l.notes}&rdquo;</div> : null}
                  <button
                    onClick={() => remove(l.key)}
                    style={{ background: "none", border: 0, padding: "4px 0 0", font: "inherit", fontSize: 12, color: "var(--color-accent-700)", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
                <div className="seg">
                  <button className="seg-opt" aria-label={`Decrease ${l.name ?? "item"}`} onClick={() => setQty(l.key, l.qty - 1)}
                    style={{ background: "none", border: 0, font: "inherit", cursor: "pointer", width: 36, justifyContent: "center" }}>&minus;</button>
                  <span className="seg-opt" style={{ minWidth: 40, justifyContent: "center", fontWeight: 600 }}>{l.qty}</span>
                  <button className="seg-opt" aria-label={`Increase ${l.name ?? "item"}`} onClick={() => setQty(l.key, l.qty + 1)}
                    style={{ background: "none", border: 0, borderLeft: "1px solid var(--color-divider)", font: "inherit", cursor: "pointer", width: 36, justifyContent: "center" }}>+</button>
                </div>
                <div style={{ textAlign: "right", fontWeight: 600 }}>{l.lineTotal != null ? gbp(l.lineTotal) : "…"}</div>
              </div>
            ))}
          </div>

          <GoesWellWith />
        </div>

        <aside
          style={{
            border: "2px solid var(--color-text)", padding: 24, display: "grid", gap: 10,
            position: "sticky", top: 104, fontSize: 14,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
            <span style={{ width: 8, height: 8, background: "var(--color-accent)", flex: "none" }} />
            <span>{data?.location ? `${feeName} from ${data.location.name}` : feeName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{data ? gbp(data.subtotal) : "…"}</span></div>
          {fulfilment === "delivery" ? (
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Delivery</span><span>{data ? gbp(data.deliveryFee) : "…"}</span></div>
          ) : null}
          {data?.discount ? (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-accent-700)" }}>
              <span>{data.promoCode || "Discount"}</span><span>&minus;{gbp(data.discount)}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "2px solid var(--color-divider)", paddingTop: 12, marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>Total</span>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, letterSpacing: "-.02em" }}>{data ? gbp(data.total) : "…"}</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input className="input" aria-label="Promo code" placeholder="Promo code" value={code} onChange={(e) => setCode(e.target.value)} style={{ textTransform: "uppercase" }} />
            <button className="btn btn-secondary" onClick={() => setPromo(code.trim().toUpperCase())}>Apply</button>
          </div>
          {data?.promoMessage ? <span style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{data.promoMessage}</span> : null}

          {data?.errors.length ? (
            <div style={{ fontSize: 13, color: "var(--color-accent-700)" }}>
              {data.errors.map((e) => <p key={e} style={{ margin: "4px 0 0" }}>{e}</p>)}
            </div>
          ) : null}

          <Link
            href="/checkout"
            aria-disabled={!canCheckout}
            tabIndex={canCheckout ? undefined : -1}
            className="btn btn-primary btn-block"
            style={{ padding: "12px 16px", pointerEvents: canCheckout ? undefined : "none", opacity: canCheckout ? 1 : 0.45 }}
          >
            Go to checkout &rarr;
          </Link>
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-700)", lineHeight: 1.5 }}>
            Prices are checked again on the server at checkout.
          </p>
        </aside>
      </div>
    </section>
  );
}

/** "Goes well with" - a 4-up ruled grid of upsell suggestions. */
function GoesWellWith() {
  const lines = useBasket((s) => s.lines);
  const [items, setItems] = useState<Upsell[] | null>(null);

  // Previously this fetched during render, which fires twice under StrictMode and
  // cannot be cancelled. Moved into an effect with an abort guard.
  useEffect(() => {
    let cancelled = false;
    const products = lines.map((l) => l.product).filter(Boolean);
    fetch("/api/basket/upsells", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ products }),
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setItems(d.items ?? []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
    // Only re-run when the set of products changes, not on every quantity tweak.
  }, [lines.map((l) => l.product).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items?.length) return null;

  return (
    <div style={{ marginTop: 36 }}>
      <span className="fp-kicker" style={{ marginBottom: 12 }}>Goes well with</span>
      <div className="fp-grid fp-grid-4">
        {items.map((u) => (
          <div key={u.href} className="fp-cell" style={{ padding: 12, display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</span>
            {u.description ? <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{u.description}</span> : null}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>{gbp(u.price)}</span>
              <Link href={u.href} className="btn btn-secondary">Add</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
