"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "./pos.css";
import type { PosBootstrap } from "@/lib/pos-types";
import type { BasketLine, Fulfilment } from "@/lib/basket-types";
import type { StaffRole } from "@/lib/permissions";
import { useLiveEvents } from "@/lib/use-live-events";
import { TopBar, type PosView } from "./TopBar";
import { CategoryRail, DEALS_KEY, POPULAR_KEY } from "./CategoryRail";
import { ItemGrid } from "./ItemGrid";
import { ProductBuilder } from "./ProductBuilder";
import { DealPanel } from "./DealPanel";
import { Basket } from "./Basket";
import { CustomerPanel } from "./CustomerPanel";
import { PayPanel } from "./PayPanel";
import { usePosOrder } from "./usePosOrder";
import { useQueue } from "./useQueue";
import { useMenuVersion } from "./useMenuVersion";
import { QueueBoard } from "./QueueBoard";
import { CashTab } from "./CashTab";
import { isSimpleProduct, type MiddleView, type OrderTypeTab, type PosCategory, type PosDeal, type PosProduct } from "./pos-client-types";
import { EatInPanel } from "./EatInPanel";
import { CallBanner } from "./CallBanner";
import { OfflineBar } from "./OfflineBar";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { useCallerId, type LiveCall } from "./useCallerId";
import { usePosDisplay } from "./usePosDisplay";
import { useOnlineStatus } from "./useOnlineStatus";
import { useOfflineQueue } from "./useOfflineQueue";
import { priceOffline } from "./offline-pricing";

export function PosScreen({ staffName, staffRole, categories, deals, logoUrl }: { staffName: string; staffRole: StaffRole; categories: PosCategory[]; deals: PosDeal[]; logoUrl?: string }) {
  const order = usePosOrder();
  const [orderEvent, setOrderEvent] = useState<{ orderId: string; kind: string } | null>(null);
  // Mounted once, for the till's whole life. `queue`/`menu` are referenced
  // inside these handlers before they are declared below - safe, because the
  // handlers only run later (async, on a stream event), by which point both
  // are assigned; see lib/use-live-events.ts for the event shapes.
  const live = useLiveEvents("/api/pos/stream", {
    order: (e) => { setOrderEvent(e); void queue.refresh(); },
    menu: () => void menu.check(),
    resync: () => { void queue.refresh(); void menu.check(); },
  });
  // Runs for the life of the till, not just while the Orders view is open, so
  // the badge count and the new-order chime stay live while someone is ringing
  // up a counter sale - and so switching to Orders never loses this basket.
  const queue = useQueue(live.connected);
  const menu = useMenuVersion(live.connected);
  const router = useRouter();
  const [view, setView] = useState<PosView>("till");
  const [queueOpenId, setQueueOpenId] = useState<string | null>(null);
  const [boot, setBoot] = useState<PosBootstrap | null>(null);
  const [orderType, setOrderType] = useState<OrderTypeTab>("collection");
  const [phoneReady, setPhoneReady] = useState(false);
  const [prefillPhone, setPrefillPhone] = useState("");
  const [tableReady, setTableReady] = useState(false);
  const [activeKey, setActiveKey] = useState<string>(categories[0]?.key ?? DEALS_KEY);
  const [search, setSearch] = useState("");
  const [middleView, setMiddleView] = useState<MiddleView>({ kind: "grid" });
  const [flashSlug, setFlashSlug] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<BasketLine | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Phase 4 (POS-PLAN items 28-30): caller ID banners, the customer-facing
  // display link (usePosDisplay), and offline detection/queueing.
  const caller = useCallerId();
  const offline = useOnlineStatus(live.connected, queue.connected);
  const display = usePosDisplay(offline);
  const offlineQueue = useOfflineQueue(!offline);
  const offlinePriced = useMemo(() => (offline ? priceOffline(order.lines, categories, deals) : null), [offline, order.lines, categories, deals]);

  const basketQty = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of order.lines) {
      if (l.kind === "product" && l.product) out[l.product] = (out[l.product] ?? 0) + l.qty;
    }
    return out;
  }, [order.lines]);

  // For the day report's "still owed" rows: only one worth opening in the Orders panel is one still in today's live queue.
  const queueOrderIds = useMemo(() => new Set(queue.orders.map((o) => o.id)), [queue.orders]);

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

  // Keyboard shortcuts (POS-PLAN item 33). Never while typing, except Esc/Enter where sensible.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select";
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "Escape") {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (middleView.kind !== "grid") { setMiddleView({ kind: "grid" }); return; }
        return;
      }
      if (typing) return;
      if (e.key === "?") { setShowShortcuts((v) => !v); return; }
      if (e.key === "F1") { e.preventDefault(); setView("till"); return; }
      if (e.key === "F2") { e.preventDefault(); setView("queue"); return; }
      if (e.key === "F3") { e.preventDefault(); setView("cash"); return; }
      if (e.key === "F4") { e.preventDefault(); selectOrderType("phone"); return; }
      if (view !== "till") return;
      if (e.key === "Enter" && middleView.kind === "grid" && order.lines.length > 0) { setMiddleView({ kind: "pay" }); return; }
      const last = order.lines[order.lines.length - 1];
      if ((e.key === "+" || e.key === "=") && last) { order.setQty(last.key, last.qty + 1); return; }
      if (e.key === "-" && last) { order.setQty(last.key, last.qty - 1); return; }
      if (e.key === "Delete" && last) { setLastRemoved(last); order.removeLine(last.key); return; }
      if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey) && lastRemoved) { e.preventDefault(); order.addLine(lastRemoved); setLastRemoved(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [middleView.kind, showShortcuts, view, order.lines, lastRemoved]);

  function selectOrderType(t: OrderTypeTab) {
    setOrderType(t);
    setMiddleView({ kind: "grid" });
    if (t === "phone") { setPhoneReady(false); return; }
    if (t === "eat_in") { setTableReady(false); order.setFulfilment("collection"); return; }
    order.setFulfilment(t as Fulfilment);
  }

  /** Take the call: switch to Phone mode with the number prefilled. An
   *  in-progress basket is never wiped silently (POS-PLAN item 28). */
  function takeOrderFromCall(call: LiveCall) {
    const proceed = () => {
      caller.dismiss(call.id);
      setPrefillPhone(call.phone);
      setOrderType("phone");
      setPhoneReady(false);
      setMiddleView({ kind: "grid" });
    };
    if (orderInProgress && !window.confirm("Switch to this call? The order you're ringing up now will be cleared.")) return;
    if (orderInProgress) order.reset();
    proceed();
  }

  const allProducts = useMemo(() => categories.flatMap((c) => c.products), [categories]);
  // Basket-line key -> product photo, for the customer display's thumbnails (item 29
  // branding). Keyed by line, not slug: offlinePriced.lines and order.lines share the
  // same `key` per line, which is the one thing both have in common with an OfflinePricedLine
  // (it has no product slug of its own - see offline-pricing.ts).
  // The slug rides along too, so the display does not suggest what is already in the basket.
  const lineMeta = useMemo(() => {
    const bySlug: Record<string, string> = {};
    for (const p of allProducts) if (p.image) bySlug[p.slug] = p.image;
    const out: Record<string, { image?: string; slug?: string }> = {};
    for (const l of order.lines) {
      const slug = l.kind === "product" && l.product ? l.product : undefined;
      out[l.key] = { image: slug ? bySlug[slug] : undefined, slug };
    }
    return out;
  }, [allProducts, order.lines]);
  const term = search.trim().toLowerCase();
  const gridProducts = term
    ? allProducts.filter((p) => p.name.toLowerCase().includes(term))
    : activeKey === DEALS_KEY
      ? []
      : activeKey === POPULAR_KEY
        ? (boot?.bestsellers ?? []).map((slug) => allProducts.find((p) => p.slug === slug)).filter((p): p is (typeof allProducts)[number] => !!p)
        : (categories.find((c) => c.key === activeKey)?.products ?? []);
  const gridDeals = !term && activeKey === DEALS_KEY ? deals : [];

  const customerLabel = order.customer
    ? `${order.customer.name} · ${order.customer.phone}`
    : orderType === "phone" && phoneReady
      ? (order.walkInName || "Walk-in")
      : orderType === "eat_in" && tableReady
        ? `Eat in · Table ${order.tableNumber}`
        : null;

  function resetAll() {
    order.reset();
    setOrderType("collection");
    setPhoneReady(false);
    setPrefillPhone("");
    setTableReady(false);
    setMiddleView({ kind: "grid" });
    setActiveKey(categories[0]?.key ?? DEALS_KEY);
    setSearch("");
  }

  // Invariant: tableReady/phoneReady are pure UI staging flags, independent of
  // `view` - switching to Orders/Cash & reports and back to Till must always
  // land you on exactly the screen you left (till body if it was up, staging
  // screen only if it genuinely still was). Nothing here keys off `view`, so
  // there is no remount/effect path that can flip these on a view switch. The
  // only thing that can send a ready order back to a staging screen is the
  // explicit "· change" button (onChangeCustomer below) - guarded the same way
  // takeOrderFromCall guards clearing a basket, so a stray/duplicate tap on it
  // mid-order can't silently drop the till back into eat-in/phone setup.
  const showCustomerStage = orderType === "phone" && !phoneReady;
  const showTableStage = orderType === "eat_in" && !tableReady;
  /** Basket state, not view - a menu change must not wipe an order mid-ring-up
   *  just because the till happens to be showing the Orders board. */
  const orderInProgress = order.lines.length > 0 || middleView.kind !== "grid" || showCustomerStage || showTableStage;

  // Customer-facing display (POS-PLAN item 29): send the live basket (usePosDisplay:
  // same-browser channel + server relay for other devices) whenever it changes. Offline uses the client-computed
  // price (offlinePriced) since the server's own priced basket goes stale.
  useEffect(() => {
    const shopName = boot?.shopName ?? "";
    const fulfilment = orderType === "eat_in" ? "eat_in" : order.fulfilment;
    if (!order.lines.length) { display({ type: "idle", shopName }); return; }
    if (offline) {
      display({
        type: "basket", shopName, fulfilment,
        lines: (offlinePriced?.lines ?? []).map((l) => ({ name: l.name, detail: l.detail, qty: l.qty, lineTotal: l.lineTotal, ...lineMeta[l.key] })),
        subtotal: offlinePriced?.subtotal ?? 0, discount: 0, deliveryFee: 0, total: offlinePriced?.total ?? 0,
      });
      return;
    }
    const p = order.priced;
    display({
      type: "basket", shopName, fulfilment,
      // The server's priced line, as the till's own basket shows it: the client cache is the unit price until re-priced.
      lines: order.lines.map((l) => {
        const pl = p?.lines.find((x) => x.key === l.key);
        return {
          name: l.name ?? "", detail: l.detail ?? "", qty: l.qty, lineTotal: pl?.lineTotal ?? l.lineTotal ?? 0, ...lineMeta[l.key],
          ...(pl ? {
            unitPrice: pl.unitPrice,
            size: pl.sizeName && pl.detail.startsWith(pl.sizeName) ? pl.sizeName : undefined,
            modifiers: pl.modifiers.map((m) => ({ name: m.name, price: m.price })),
          } : {}),
        };
      }),
      subtotal: p?.subtotal ?? 0, discount: p?.discount ?? 0, deliveryFee: p?.deliveryFee ?? 0, total: p?.total ?? 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.lines, order.priced, offline, offlinePriced, boot?.shopName, lineMeta, orderType, order.fulfilment]);

  // A price/menu change lands, but never mid-order: refresh the moment the
  // basket is clear (immediately if it already was, otherwise as soon as this
  // order finishes or is abandoned). /pos is force-dynamic, so router.refresh()
  // re-reads categories/deals from the server - this component itself is not
  // remounted, so the basket in usePosOrder survives untouched.
  useEffect(() => {
    if (!menu.changed || orderInProgress) return;
    router.refresh();
    menu.ack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu.changed, orderInProgress]);

  return (
    <div className="pos-root">
      <CallBanner calls={caller.calls} onDismiss={caller.dismiss} onTakeOrder={takeOrderFromCall} />
      {showShortcuts ? <ShortcutsOverlay onClose={() => setShowShortcuts(false)} /> : null}

      <div className="pos-topwrap">
        <TopBar
          logoUrl={logoUrl}
          staffName={staffName}
          view={view}
          onView={setView}
          badgeCount={queue.badgeCount}
          soundOn={queue.soundOn}
          onEnableSound={queue.enableSound}
          orderType={orderType}
          onOrderType={selectOrderType}
          search={search}
          onSearch={setSearch}
          searchRef={searchRef}
          boot={boot}
          locationKey={order.locationKey}
          onLocationKey={order.setLocationKey}
          customerLabel={customerLabel}
          onChangeCustomer={() => {
            // Same guard as takeOrderFromCall: once there are real items rung up, a
            // stray/duplicate tap on "· change" must not silently bounce the till
            // back to the table/phone picker out from under the order in progress.
            if (order.lines.length > 0 && !window.confirm("Change the table/customer? The basket stays, but you'll pick it again first.")) return;
            if (orderType === "eat_in") setTableReady(false); else setPhoneReady(false);
          }}
          liveConnected={live.connected}
          offline={offline}
          offlineCount={offlineQueue.count}
          onSendNow={() => void offlineQueue.sendNow()}
          onOpenDisplay={() => window.open("/pos/display", "pos-display", "width=900,height=600")}
          onShowShortcuts={() => setShowShortcuts(true)}
        />
        {offline ? <OfflineBar /> : null}
        {menu.changed && orderInProgress ? (
          <div className="pos-menubanner">Menu updated by the office — refreshing after this order.</div>
        ) : null}
      </div>

      {view === "queue" ? (
        <QueueBoard
          orders={queue.orders}
          drivers={queue.drivers}
          now={queue.now}
          connected={queue.connected}
          justArrived={queue.justArrived}
          readers={boot?.readers ?? []}
          categories={categories}
          deals={deals}
          updateOrder={queue.updateOrder}
          setDrivers={queue.setDrivers}
          openId={queueOpenId}
          onOpenChange={setQueueOpenId}
          liveEvent={orderEvent}
          liveConnected={live.connected}
        />
      ) : view === "cash" ? (
        <CashTab
          staffRole={staffRole}
          locationKey={order.locationKey || undefined}
          liveEvent={orderEvent}
          queueOrderIds={queueOrderIds}
          onOpenOrder={(id) => { setQueueOpenId(id); setView("queue"); }}
          serialSupported={caller.serialSupported}
          serialConnected={caller.serialConnected}
          serialError={caller.serialError}
          onConnectSerial={() => void caller.connectSerial()}
        />
      ) : showCustomerStage ? (
        <div className="pos-main">
          <CustomerPanel order={order} initialPhone={prefillPhone} onContinue={(f) => { order.setFulfilment(f); setPhoneReady(true); }} />
        </div>
      ) : showTableStage ? (
        <div className="pos-main">
          <EatInPanel initial={order.tableNumber} onContinue={(t) => { order.setTableNumber(t); setTableReady(true); }} />
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
              <PayPanel
                order={order} orderType={orderType} boot={boot} onDone={resetAll} onBack={() => setMiddleView({ kind: "grid" })} liveEvent={orderEvent}
                offline={offline} categories={categories} deals={deals} display={display} onOfflineSaved={offlineQueue.refresh} logoUrl={logoUrl}
              />
            )}
          </main>

          <Basket order={order} onCharge={() => setMiddleView({ kind: "pay" })} offline={offline} offlinePriced={offlinePriced} />
        </div>
      )}
    </div>
  );
}
