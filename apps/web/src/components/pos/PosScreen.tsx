"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import "./pos.css";
import type { PosBootstrap } from "@/lib/pos-types";
import type { Fulfilment } from "@/lib/basket-types";
import { TopBar } from "./TopBar";
import { CategoryRail, DEALS_KEY, POPULAR_KEY } from "./CategoryRail";
import { ItemGrid } from "./ItemGrid";
import { ProductBuilder } from "./ProductBuilder";
import { DealPanel } from "./DealPanel";
import { Basket } from "./Basket";
import { CustomerPanel } from "./CustomerPanel";
import { PayPanel } from "./PayPanel";
import { usePosOrder } from "./usePosOrder";
import { isSimpleProduct, type MiddleView, type OrderTypeTab, type PosCategory, type PosDeal, type PosProduct } from "./pos-client-types";

export function PosScreen({ staffName, categories, deals }: { staffName: string; categories: PosCategory[]; deals: PosDeal[] }) {
  const order = usePosOrder();
  const [boot, setBoot] = useState<PosBootstrap | null>(null);
  const [orderType, setOrderType] = useState<OrderTypeTab>("collection");
  const [phoneReady, setPhoneReady] = useState(false);
  const [activeKey, setActiveKey] = useState<string>(categories[0]?.key ?? DEALS_KEY);
  const [search, setSearch] = useState("");
  const [middleView, setMiddleView] = useState<MiddleView>({ kind: "grid" });
  const [flashSlug, setFlashSlug] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const basketQty = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of order.lines) {
      if (l.kind === "product" && l.product) out[l.product] = (out[l.product] ?? 0) + l.qty;
    }
    return out;
  }, [order.lines]);

  /** One-tap add for a simple product (single size, no modifier groups): bump
   *  the last basket line if it's the same item, otherwise add qty 1. Flashes
   *  the tile briefly instead of opening the builder - there's nothing to build. */
  function quickAddProduct(p: PosProduct) {
    const last = order.lines[order.lines.length - 1];
    if (last && last.kind === "product" && last.product === p.slug) {
      order.setQty(last.key, last.qty + 1);
    } else {
      const unitPrice = p.sizes[0]?.price ?? p.minPrice;
      order.addLine({ kind: "product", product: p.slug, size: p.sizes[0]?.key ?? "regular", modifiers: [], qty: 1, name: p.name, detail: "", unitPrice, lineTotal: unitPrice });
    }
    setFlashSlug(p.slug);
    window.setTimeout(() => setFlashSlug((cur) => (cur === p.slug ? null : cur)), 450);
  }

  function selectProduct(p: PosProduct) {
    if (isSimpleProduct(p)) { quickAddProduct(p); return; }
    setMiddleView({ kind: "product", product: p });
  }

  useEffect(() => {
    fetch("/api/pos/bootstrap")
      .then((r) => r.json())
      .then((d: PosBootstrap) => { setBoot(d); if (d.locations.length === 1) order.setLocationKey(d.locations[0]!.key); })
      // Bootstrap is nice-to-have (staff name, readers, status pill) - a failed
      // fetch must never block taking an order.
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select";
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "Escape" && middleView.kind !== "grid") { setMiddleView({ kind: "grid" }); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [middleView.kind]);

  function selectOrderType(t: OrderTypeTab) {
    setOrderType(t);
    setMiddleView({ kind: "grid" });
    if (t === "phone") { setPhoneReady(false); return; }
    order.setFulfilment(t as Fulfilment);
  }

  const allProducts = useMemo(() => categories.flatMap((c) => c.products), [categories]);
  const term = search.trim().toLowerCase();
  const gridProducts = term
    ? allProducts.filter((p) => p.name.toLowerCase().includes(term))
    : activeKey === DEALS_KEY
      ? []
      : activeKey === POPULAR_KEY
        ? (boot?.bestsellers ?? []).map((slug) => allProducts.find((p) => p.slug === slug)).filter((p): p is (typeof allProducts)[number] => !!p)
        : (categories.find((c) => c.key === activeKey)?.products ?? []);
  const gridDeals = !term && activeKey === DEALS_KEY ? deals : [];

  const customerLabel = order.customer ? `${order.customer.name} · ${order.customer.phone}` : orderType === "phone" && phoneReady ? order.walkInName || "Walk-in" : null;

  function resetAll() {
    order.reset();
    setOrderType("collection");
    setPhoneReady(false);
    setMiddleView({ kind: "grid" });
    setActiveKey(categories[0]?.key ?? DEALS_KEY);
    setSearch("");
  }

  const showCustomerStage = orderType === "phone" && !phoneReady;

  return (
    <div className="pos-root">
      <TopBar
        staffName={staffName}
        orderType={orderType}
        onOrderType={selectOrderType}
        search={search}
        onSearch={setSearch}
        searchRef={searchRef}
        boot={boot}
        locationKey={order.locationKey}
        onLocationKey={order.setLocationKey}
        customerLabel={customerLabel}
        onChangeCustomer={() => setPhoneReady(false)}
      />

      {showCustomerStage ? (
        <div className="pos-main">
          <CustomerPanel order={order} onContinue={(f) => { order.setFulfilment(f); setPhoneReady(true); }} />
        </div>
      ) : (
        <div className="pos-body">
          <CategoryRail categories={categories} activeKey={activeKey} onSelect={(k) => { setActiveKey(k); setSearch(""); }} hasPopular={!!boot?.bestsellers.length} />

          <main className="pos-main">
            {middleView.kind === "grid" ? (
              <ItemGrid
                products={gridProducts}
                deals={gridDeals}
                onSelectProduct={selectProduct}
                onSelectDeal={(d) => setMiddleView({ kind: "deal", deal: d })}
                basketQty={basketQty}
                flashSlug={flashSlug}
              />
            ) : middleView.kind === "product" ? (
              <ProductBuilder product={middleView.product} onAdd={(line) => { order.addLine(line); setMiddleView({ kind: "grid" }); }} onCancel={() => setMiddleView({ kind: "grid" })} />
            ) : middleView.kind === "deal" ? (
              <DealPanel deal={middleView.deal} onAdd={(line) => { order.addLine(line); setMiddleView({ kind: "grid" }); }} onCancel={() => setMiddleView({ kind: "grid" })} />
            ) : (
              <PayPanel order={order} orderType={orderType} boot={boot} onDone={resetAll} onBack={() => setMiddleView({ kind: "grid" })} />
            )}
          </main>

          <Basket order={order} onCharge={() => setMiddleView({ kind: "pay" })} />
        </div>
      )}
    </div>
  );
}
