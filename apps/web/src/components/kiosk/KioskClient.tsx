"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveEvents } from "@/lib/use-live-events";
import {
  addKioskLine, pickUpsell, setKioskQty, KIOSK_DONE_MS, KIOSK_IDLE_MS,
  type KioskFulfilment, type KioskOrderRef,
} from "@/lib/kiosk-rules";
import { isSimpleProduct, type PosCategory, type PosDeal, type PosProduct } from "@/components/pos/pos-client-types";
import type { KioskBrand, KioskLine, KioskSlide, KioskStage, KioskUpsell } from "./kiosk-types";
import { KioskAttract } from "./KioskAttract";
import { KioskDone, KioskStillThere, KioskType } from "./KioskScreens";
import { KioskMenu } from "./KioskMenu";
import { KioskBuilder, KioskUpsellSheet } from "./KioskBuilder";
import { KioskDealBuilder } from "./KioskDealBuilder";
import { KioskBasket } from "./KioskBasket";
import { KioskPay } from "./KioskPay";
import { KioskStaff, useKioskDevice } from "./KioskStaff";
import { simpleLine } from "./kiosk-lines";
import "../pos/pos-display.css";
import "./kiosk.css";

/** "Eat in or take away · Pay by card or at the counter", from what this shop actually offers here. */
function attractNote(f: KioskFulfilment[], pay: { card: boolean; counter: boolean }): string {
  const how = f.length > 1 ? "Eat in or take away" : f[0] === "eat_in" ? "Eat in" : "Order to take away";
  const pays = pay.card && pay.counter ? "Pay by card or at the counter" : pay.card ? "Pay by card" : "Pay at the counter";
  return `${how} · ${pays}`;
}

type Building = { kind: "product"; product: PosProduct } | { kind: "deal"; deal: PosDeal };
// "card" too: a customer who walks away from the reader must not leave the kiosk stuck (CardPay cancels on unmount).
const IDLE_STAGES = new Set<KioskStage>(["type", "menu", "basket", "pay", "card"]);
const TOAST_MS = 1600;

/**
 * Self-service kiosk (POS-PLAN item 35): attract loop → eat in / take away → menu →
 * builder (+ "make it a meal?") → basket → pay (card on this kiosk's reader, or at
 * the counter) → order number. Sixty idle seconds anywhere asks "Are you still
 * there?", then clears the order. Everything shown comes from page.tsx (this shop's
 * config and menu); every price charged comes from /api/kiosk/*.
 */
export function KioskClient(props: {
  brand: KioskBrand;
  fulfilments: KioskFulfilment[];
  shopPayments: { card: boolean; counter: boolean };
  categories: PosCategory[];
  deals: PosDeal[];
  popular: string[];
  mainsCategory: string;
  slides: KioskSlide[];
  upsell: KioskUpsell[];
  loyaltyName: string;
  /** The card reader a manager assigned this kiosk ("" for none). The server holds it; /pay never takes one from here. */
  reader: string;
}) {
  const { fulfilments, categories, mainsCategory, upsell } = props;
  const router = useRouter();
  const device = useKioskDevice();
  const [stage, setStage] = useState<KioskStage>("attract");
  const [fulfilment, setFulfilment] = useState<KioskFulfilment>(fulfilments[0] ?? "collection");
  const [lines, setLines] = useState<KioskLine[]>([]);
  const [building, setBuilding] = useState<Building | null>(null);
  const [upsellFor, setUpsellFor] = useState<string | null>(null);
  const [order, setOrder] = useState<KioskOrderRef | null>(null);
  const [orderName, setOrderName] = useState("");
  const [paid, setPaid] = useState(false);
  const [stillThere, setStillThere] = useState(false);
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null);
  const lastTouch = useRef(Date.now());

  const products = useMemo(() => new Map(categories.flatMap((c) => c.products.map((p) => [p.slug, p] as const))), [categories]);
  const inBasket = useMemo(() => new Set(lines.map((l) => l.product ?? "").filter(Boolean)), [lines]);

  const reset = useCallback(() => {
    setLines([]); setBuilding(null); setUpsellFor(null); setOrder(null); setOrderName(""); setPaid(false); setStillThere(false);
    setFulfilment(fulfilments[0] ?? "collection");
    setStage("attract");
    router.refresh(); // pick up any menu, price or offer change while nobody is ordering
  }, [fulfilments, router]);

  const start = () => {
    lastTouch.current = Date.now();
    setStage(fulfilments.length > 1 ? "type" : "menu");
  };

  // Menu, price and sold-out changes from the back office reach the kiosk at once.
  useLiveEvents("/api/kiosk/stream", { menu: () => router.refresh(), resync: () => router.refresh() });

  // Any touch counts as someone being there.
  useEffect(() => {
    const touched = () => { lastTouch.current = Date.now(); };
    window.addEventListener("pointerdown", touched, { capture: true });
    return () => window.removeEventListener("pointerdown", touched, { capture: true });
  }, []);

  // Sixty idle seconds on an order screen: "Are you still there?".
  useEffect(() => {
    if (!IDLE_STAGES.has(stage) || stillThere) return;
    const t = window.setInterval(() => { if (Date.now() - lastTouch.current > KIOSK_IDLE_MS) setStillThere(true); }, 1000);
    return () => clearInterval(t);
  }, [stage, stillThere]);

  // The confirmation goes back to the offers on its own.
  useEffect(() => {
    if (stage !== "done") return;
    const t = window.setTimeout(reset, KIOSK_DONE_MS);
    return () => clearTimeout(t);
  }, [stage, reset]);

  const say = (text: string) => setToast({ text, at: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast((cur) => (cur?.at === toast.at ? null : cur)), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  /** `built`: it came through a builder (a main or a deal), so offer "make it a meal?". */
  function add(line: KioskLine, built: boolean) {
    setLines((prev) => addKioskLine(prev, line));
    setBuilding(null);
    say(`${line.qty > 1 ? `${line.qty} × ` : ""}${line.name} added`);
    const cat = line.category ?? mainsCategory;
    if (built && pickUpsell(upsell, cat, new Set([...inBasket, line.product ?? ""])).length) setUpsellFor(cat);
  }

  /** A product tapped anywhere: straight in if there is nothing to choose, else the builder. */
  function pick(slug: string) {
    const p = products.get(slug);
    if (!p || p.soldOut) return;
    setUpsellFor(null);
    if (isSimpleProduct(p)) add(simpleLine(p), false);
    else setBuilding({ kind: "product", product: p });
  }

  if (stage === "attract") return <><KioskAttract brand={props.brand} slides={props.slides} note={attractNote(fulfilments, props.shopPayments)} onStart={start} /><KioskStaff device={device} reader={props.reader} /></>;

  const header = { brand: props.brand, fulfilment, fulfilments, onFulfilment: setFulfilment, onStartOver: reset };
  let screen: React.ReactNode;
  if (stage === "type") {
    screen = <KioskType brand={props.brand} fulfilments={fulfilments} slides={props.slides} onChoose={(f) => { setFulfilment(f); setStage("menu"); }} onStartOver={reset} />;
  } else if (stage === "basket") {
    screen = (
      <KioskBasket
        header={header} lines={lines} setLines={setLines} device={device} loyaltyName={props.loyaltyName}
        promo={props.slides[0] ?? null} extras={pickUpsell(upsell, mainsCategory, inBasket, 3)} onPick={pick}
        onQty={(key, qty) => setLines((prev) => setKioskQty(prev, key, qty))}
        onMore={() => setStage("menu")} onCheckout={() => setStage("pay")}
      />
    );
  } else if (stage === "pay" || stage === "card") {
    screen = (
      <KioskPay
        header={header} lines={lines} fulfilment={fulfilment} device={device} reader={props.reader} shopPayments={props.shopPayments}
        onBack={() => setStage("basket")} onStage={setStage}
        onDone={(o, name, wasPaid) => { setOrder(o); setOrderName(name); setPaid(wasPaid); setStillThere(false); setStage("done"); }}
      />
    );
  } else if (stage === "done" && order) {
    screen = <KioskDone brand={props.brand} order={order} name={orderName} paid={paid} promo={props.slides[0] ?? null} extras={pickUpsell(upsell, mainsCategory, new Set(), 3)} onNew={reset} />;
  } else {
    screen = (
      <KioskMenu
        header={header} categories={categories} deals={props.deals} popular={props.popular} lines={lines}
        banner={props.slides[0] ?? null} onPick={pick} onDeal={(d) => setBuilding({ kind: "deal", deal: d })} onView={() => setStage("basket")}
      />
    );
  }

  return (
    <>
      {screen}
      {building?.kind === "product" ? <KioskBuilder key={building.product.slug} product={building.product} onAdd={(l) => add(l, true)} onClose={() => setBuilding(null)} /> : null}
      {building?.kind === "deal" ? <KioskDealBuilder key={building.deal.slug} deal={building.deal} mainsCategory={mainsCategory} onAdd={(l) => add(l, true)} onClose={() => setBuilding(null)} /> : null}
      {upsellFor !== null && !building ? (
        <KioskUpsellSheet items={pickUpsell(upsell, upsellFor, inBasket, 3)} onPick={pick} onSkip={() => setUpsellFor(null)} />
      ) : null}
      {toast ? <div className="kx-toast" key={toast.at} role="status"><span className="kx-toast-tick" aria-hidden="true">✓</span>{toast.text}</div> : null}
      {stillThere ? <KioskStillThere onStay={() => { lastTouch.current = Date.now(); setStillThere(false); }} onTimeout={reset} /> : null}
      <KioskStaff device={device} reader={props.reader} />
    </>
  );
}
