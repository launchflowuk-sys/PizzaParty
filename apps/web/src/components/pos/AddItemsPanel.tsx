"use client";
import { useMemo, useState } from "react";
import { gbp } from "@/lib/money";
import type { BasketLine } from "@/lib/basket-types";
import { CategoryRail, DEALS_KEY, POPULAR_KEY } from "./CategoryRail";
import { ItemGrid } from "./ItemGrid";
import { ProductBuilder } from "./ProductBuilder";
import { DealPanel } from "./DealPanel";
import { isSimpleProduct, type PosCategory, type PosDeal, type PosProduct } from "./pos-client-types";

type View = { kind: "grid" } | { kind: "product"; product: PosProduct } | { kind: "deal"; deal: PosDeal };

const genKey = () => Math.random().toString(36).slice(2, 10);

/**
 * The till's own menu picker (CategoryRail + ItemGrid + ProductBuilder +
 * DealPanel), reused to collect new lines for an order already sent to the
 * kitchen - queue item 20's "Add items". Sends nothing itself; the caller
 * POSTs the collected lines to /api/pos/orders/:id/edit.
 *
 * ponytail: selectProduct/quickAdd duplicate a few lines of PosScreen's own
 * menu-picking logic rather than sharing a hook - the till's version is also
 * wired to fulfilment/customer/discount state this panel has no business
 * touching. Extract a shared hook if a third consumer needs the same picker.
 */
export function AddItemsPanel({
  categories, deals, busy, onSend, onCancel,
}: {
  categories: PosCategory[];
  deals: PosDeal[];
  busy: boolean;
  onSend: (lines: BasketLine[]) => void;
  onCancel: () => void;
}) {
  const [activeKey, setActiveKey] = useState(categories[0]?.key ?? DEALS_KEY);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>({ kind: "grid" });
  const [lines, setLines] = useState<BasketLine[]>([]);

  function addLine(line: Omit<BasketLine, "key">) {
    setLines((prev) => [...prev, { ...line, key: genKey() }]);
    setView({ kind: "grid" });
  }
  function quickAdd(p: PosProduct) {
    const unitPrice = p.sizes[0]?.price ?? p.minPrice;
    setLines((prev) => [...prev, {
      key: genKey(), kind: "product", product: p.slug, size: p.sizes[0]?.key ?? "regular", modifiers: [], qty: 1,
      name: p.name, detail: "", unitPrice, lineTotal: unitPrice,
    }]);
  }
  function selectProduct(p: PosProduct) {
    if (isSimpleProduct(p)) quickAdd(p);
    else setView({ kind: "product", product: p });
  }
  function removeLine(key: string) { setLines((prev) => prev.filter((l) => l.key !== key)); }

  const allProducts = useMemo(() => categories.flatMap((c) => c.products), [categories]);
  const term = search.trim().toLowerCase();
  const gridProducts = term
    ? allProducts.filter((p) => p.name.toLowerCase().includes(term))
    : activeKey === DEALS_KEY || activeKey === POPULAR_KEY
      ? []
      : (categories.find((c) => c.key === activeKey)?.products ?? []);
  const gridDeals = !term && activeKey === DEALS_KEY ? deals : [];
  const total = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);

  return (
    <div className="pos-additems">
      <div className="pos-additems-body">
        <CategoryRail categories={categories} activeKey={activeKey} onSelect={(k) => { setActiveKey(k); setSearch(""); }} hasPopular={false} />
        <div className="pos-main" style={{ padding: 0 }}>
          {view.kind === "grid" ? (
            <>
              <input className="input" style={{ minHeight: 48, marginBottom: 12 }} placeholder="Search menu" value={search} onChange={(e) => setSearch(e.target.value)} />
              <ItemGrid products={gridProducts} deals={gridDeals} onSelectProduct={selectProduct} onSelectDeal={(d) => setView({ kind: "deal", deal: d })} basketQty={{}} flashSlug={null} />
            </>
          ) : view.kind === "product" ? (
            <ProductBuilder product={view.product} onAdd={addLine} onCancel={() => setView({ kind: "grid" })} />
          ) : (
            <DealPanel deal={view.deal} onAdd={addLine} onCancel={() => setView({ kind: "grid" })} />
          )}
        </div>
      </div>

      {lines.length ? (
        <div className="pos-additems-lines">
          {lines.map((l) => (
            <span key={l.key} className="pos-chip" data-state="whole">
              <span>{l.qty}× {l.name ?? l.product ?? l.deal}</span>
              <button type="button" className="btn btn-ghost" style={{ minHeight: 0, padding: "0 4px" }} onClick={() => removeLine(l.key)} aria-label="Remove">✕</button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="pos-additems-footer">
        <span>{lines.length} item{lines.length === 1 ? "" : "s"} · {gbp(total)}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 56 }} onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" style={{ minHeight: 56 }} disabled={!lines.length || busy} onClick={() => onSend(lines)}>
            {busy ? "Sending…" : "Send to kitchen"}
          </button>
        </div>
      </div>
    </div>
  );
}
