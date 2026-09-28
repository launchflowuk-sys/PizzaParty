"use client";
import { gbp } from "@/lib/money";
import type { PosDeal, PosProduct } from "./pos-client-types";

export function ItemGrid({
  products, deals, onSelectProduct, onSelectDeal, basketQty, flashSlug,
}: {
  products: PosProduct[];
  deals: PosDeal[];
  onSelectProduct: (p: PosProduct) => void;
  onSelectDeal: (d: PosDeal) => void;
  /** Basket qty per product slug, summed across all its lines - shown as a badge on the tile. */
  basketQty: Record<string, number>;
  /** Slug of a product that was just one-tap added, for a brief tile flash. */
  flashSlug: string | null;
}) {
  if (deals.length) {
    return (
      <div className="pos-grid">
        {deals.map((d) => (
          <button key={d.slug} type="button" className="pos-tile" onClick={() => onSelectDeal(d)}>
            <span className="pos-tile-name">{d.name}</span>
            {d.description ? <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{d.description}</span> : null}
            <span className="pos-tile-price">{gbp(d.price)}</span>
          </button>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return <p style={{ padding: 24, color: "var(--color-neutral-700)" }}>Nothing here.</p>;
  }

  return (
    <div className="pos-grid">
      {products.map((p) => {
        const qty = basketQty[p.slug] ?? 0;
        return (
          <button
            key={p.slug}
            type="button"
            className="pos-tile"
            data-soldout={p.soldOut ? "1" : undefined}
            data-flash={flashSlug === p.slug ? "1" : undefined}
            disabled={p.soldOut}
            onClick={() => onSelectProduct(p)}
          >
            {qty > 0 ? <span className="pos-tile-badge">{qty}</span> : null}
            <span className="pos-tile-name">{p.name}</span>
            {p.description ? <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{p.description}</span> : null}
            {p.soldOut ? <span className="tag tag-danger">Sold out</span> : <span className="pos-tile-price">from {gbp(p.minPrice)}</span>}
          </button>
        );
      })}
    </div>
  );
}
