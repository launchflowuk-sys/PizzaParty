"use client";
import { useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/money";
import { Icon } from "@/components/pos/PosDisplayIcons";
import { kioskName, kioskPayments, kioskTotal, KIOSK_NAME_MAX, type KioskFulfilment, type KioskOrderRef, type KioskPayment } from "@/lib/kiosk-rules";
import type { PosPayment } from "@/lib/pos-types";
import type { KioskLine, KioskStage } from "./kiosk-types";
import { KioskHeader, type KioskHeaderProps } from "./KioskMenu";
import { kioskPost, type KioskResult } from "./KioskStaff";
import { newKey } from "./kiosk-lines";

const POLL_MS = 1500;
const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

type Phase = { kind: "choose" } | { kind: "name"; method: KioskPayment } | { kind: "placing" } | { kind: "card"; order: KioskOrderRef };

/**
 * Pay: the ways this shop takes money at the kiosk (card on this kiosk's own reader,
 * or at the counter), then "What name shall we call?" on a big on-screen keyboard
 * (optional), then the order is placed. Card uses the till's Stripe Terminal flow.
 */
export function KioskPay({ header, lines, fulfilment, device, reader, shopPayments, onBack, onStage, onDone }: {
  header: KioskHeaderProps; lines: KioskLine[]; fulfilment: KioskFulfilment; device: string; reader: string; shopPayments: { card: boolean; counter: boolean };
  onBack: () => void; onStage: (s: KioskStage) => void; onDone: (o: KioskOrderRef, name: string, paid: boolean) => void;
}) {
  const methods = kioskPayments({ card: shopPayments.card, payAtCounter: shopPayments.counter, stripe: shopPayments.card, readerChosen: !!reader });
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef<{ method: KioskPayment; id: string } | null>(null);
  const total = kioskTotal(lines);

  async function place(method: KioskPayment) {
    setError("");
    setPhase({ kind: "placing" });
    // One id per attempt at this basket and method, so a retry after a lost reply cannot order twice.
    if (requestId.current?.method !== method) requestId.current = { method, id: newKey() };
    const r = await kioskPost<KioskOrderRef>("/api/kiosk/orders", device, {
      fulfilment, name, payment: method, clientRequestId: requestId.current.id,
      lines: lines.map(({ view: _v, category: _c, ...l }) => l),
    });
    if (!r.ok) { setError(r.error); setPhase({ kind: "choose" }); return; }
    const clean = kioskName(name);
    if (method === "counter" || r.data.status !== "pending_payment") { onDone(r.data, clean, method === "card"); return; }
    onStage("card");
    setPhase({ kind: "card", order: r.data });
  }

  if (phase.kind === "card") {
    return (
      <CardPay
        order={phase.order} device={device} canCounter={methods.includes("counter")}
        onPaid={() => onDone(phase.order, kioskName(name), true)}
        onCounter={() => { onStage("pay"); void place("counter"); }}
        onBack={() => { onStage("pay"); requestId.current = null; setPhase({ kind: "choose" }); }}
      />
    );
  }

  return (
    <div className="cd-root kx-root kx-pay">
      <KioskHeader {...header} />
      <div className="kx-pay-body">
        <button type="button" className="kx-ghost kx-pay-back" onClick={onBack}><Icon name="back" />Back to your order</button>
        <h1 className="kx-h1 kx-pay-title">How would you like to pay?</h1>
        <p className="kx-pay-total"><span>Total to pay</span><b>{gbp(total)}</b></p>
        {error ? <p className="kx-error" role="alert">{error}</p> : null}
        <div className="kx-methods" data-n={methods.length}>
          {methods.includes("card") ? (
            <button type="button" className="kx-method" onClick={() => setPhase({ kind: "name", method: "card" })}>
              <span className="kx-method-icon" aria-hidden="true"><Icon name="contactless" /></span>
              <span className="kx-method-title">Pay by card</span>
              <span className="kx-method-sub">Tap, insert or use your phone on the reader below</span>
              <span className="kx-method-marks" aria-hidden="true"><Icon name="card" /><Icon name="apple" /><Icon name="google" /></span>
            </button>
          ) : null}
          {methods.includes("counter") ? (
            <button type="button" className="kx-method kx-method-counter" onClick={() => setPhase({ kind: "name", method: "counter" })}>
              <span className="kx-method-icon" aria-hidden="true"><Icon name="cash" /></span>
              <span className="kx-method-title">Pay at the counter</span>
              <span className="kx-method-sub">Cash or card - we start cooking straight away</span>
              <span className="kx-method-marks" aria-hidden="true"><Icon name="cash" /><Icon name="card" /></span>
            </button>
          ) : null}
          {!methods.length ? <p className="kx-error">This kiosk cannot take payment right now. Please order at the counter.</p> : null}
        </div>
      </div>
      {phase.kind === "name" || phase.kind === "placing" ? (
        <NameSheet
          name={name} setName={setName} busy={phase.kind === "placing"}
          onCancel={() => setPhase({ kind: "choose" })}
          onGo={() => phase.kind === "name" && place(phase.method)}
        />
      ) : null}
    </div>
  );
}

/** "What name shall we call?" - big on-screen keys, optional. */
function NameSheet({ name, setName, busy, onCancel, onGo }: { name: string; setName: (s: string) => void; busy: boolean; onCancel: () => void; onGo: () => void }) {
  const type = (ch: string) => setName((name + ch).slice(0, KIOSK_NAME_MAX));
  return (
    <div className="kx-modal-back kx-sheet-back">
      <div className="kx-sheet kx-name" role="dialog" aria-modal="true" aria-labelledby="kx-name-title">
        <h2 id="kx-name-title" className="kx-name-title">What name shall we call?</h2>
        <p className="kx-sheet-sub">Optional - we&apos;ll call your order number either way</p>
        <div className="kx-name-field" aria-live="polite">{name || <span>Your first name</span>}<i aria-hidden="true" /></div>
        <div className="kx-keys">
          {KEYS.map((row) => (
            <div key={row} className="kx-keyrow">
              {row.split("").map((k) => <button key={k} type="button" className="kx-key" disabled={busy} onClick={() => type(!name || /[ -]$/.test(name) ? k : k.toLowerCase())}>{k}</button>)}
            </div>
          ))}
          <div className="kx-keyrow">
            <button type="button" className="kx-key kx-key-wide" disabled={busy} onClick={() => type(" ")}>Space</button>
            <button type="button" className="kx-key kx-key-wide" disabled={busy || !name} onClick={() => setName(name.slice(0, -1))} aria-label="Delete"><Icon name="back" /></button>
          </div>
        </div>
        <div className="kx-name-foot">
          <button type="button" className="kx-ghost" disabled={busy} onClick={onCancel}>Back</button>
          <button type="button" className="kx-go kx-name-go" disabled={busy} onClick={onGo}>
            {busy ? "Placing your order…" : name.trim() ? "Place my order" : "Skip and place my order"}<Icon name="arrow" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Tap your card on the reader below": starts the reader payment and polls it, like the till's ReaderPay. */
function CardPay({ order, device, canCounter, onPaid, onCounter, onBack }: {
  order: KioskOrderRef; device: string; canCounter: boolean; onPaid: () => void; onCounter: () => void; onBack: () => void;
}) {
  const [payment, setPayment] = useState<PosPayment | null>(null);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const done = useRef(onPaid);
  done.current = onPaid;
  // One reader request per attempt, however many times the effect runs (React re-runs it in development).
  const started = useRef<{ attempt: number; req: Promise<KioskResult<PosPayment>> } | null>(null);
  // The payment still on the reader, if any: cleared from it whenever this screen goes away.
  const onReader = useRef<PosPayment | null>(null);
  const mounted = useRef(false);
  const clearReader = useRef((_p: PosPayment) => {});
  clearReader.current = (p: PosPayment) => {
    if (p.status !== "waiting") return;
    void fetch(`/api/kiosk/orders/${order.id}/pay/${p.id}/cancel`, { method: "POST", keepalive: true, headers: { "content-type": "application/json", "x-kiosk-device": device }, body: "{}" }).catch(() => null);
  };

  // The idle reset or anything else that unmounts this screen must not leave the amount
  // live on the reader for the next person's tap (keepalive: the page may be reloading).
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const p = onReader.current;
      onReader.current = null;
      if (p) clearReader.current(p);
    };
  }, []);

  useEffect(() => {
    let live = true;
    let timer: number | undefined;
    const follow = (p: PosPayment) => {
      if (!live) return;
      onReader.current = p;
      setPayment(p);
      if (p.status === "succeeded") done.current();
      else if (p.status === "waiting") timer = window.setTimeout(() => void poll(p.id), POLL_MS);
      else setMessage(p.message ?? (p.status === "cancelled" ? "Payment cancelled." : "The card was not accepted."));
    };
    const poll = async (id: string) => {
      const r = await fetch(`/api/kiosk/orders/${order.id}/pay/${id}`, { headers: { "x-kiosk-device": device }, cache: "no-store" }).catch(() => null);
      if (!live) return;
      if (!r?.ok) { timer = window.setTimeout(() => void poll(id), POLL_MS); return; } // a dropped poll is not a dropped payment
      follow((await r.json()) as PosPayment);
    };
    setMessage(""); setPayment(null);
    if (started.current?.attempt !== attempt) started.current = { attempt, req: kioskPost<PosPayment>(`/api/kiosk/orders/${order.id}/pay`, device, {}) };
    void started.current.req.then((r) => {
      // Gone before the reader answered (not just React re-running the effect): clear it.
      if (!mounted.current && r.ok) clearReader.current(r.data);
      if (!live) return;
      if (!r.ok) { setMessage(r.error); return; }
      follow(r.data);
    });
    return () => { live = false; clearTimeout(timer); };
  }, [order.id, device, attempt]);

  async function cancel() {
    if (!payment) { onBack(); return; }
    onReader.current = null;
    const r = await kioskPost<PosPayment>(`/api/kiosk/orders/${order.id}/pay/${payment.id}/cancel`, device, {});
    if (r.ok && r.data.status === "succeeded") { onPaid(); return; } // the tap won the race
    onBack();
  }

  const failed = !!message;
  return (
    <div className="cd-root kx-root kx-card-pay" data-state={failed ? "failed" : "waiting"}>
      <div className="kx-cp-main">
        <span className="kx-cp-total-label">Total to pay</span>
        <span className="kx-cp-total">{gbp(order.total)}</span>
        {failed ? (
          <>
            <span className="kx-cp-fail-icon" aria-hidden="true"><Icon name="close" /></span>
            <h1 className="kx-cp-title">Payment didn&apos;t go through</h1>
            <p className="kx-cp-sub" role="alert">{message}</p>
            <div className="kx-cp-actions">
              <button type="button" className="kx-go" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
              {canCounter ? <button type="button" className="kx-go kx-go-alt" onClick={onCounter}>Pay at the counter instead</button> : null}
              <button type="button" className="kx-ghost" onClick={onBack}>Back</button>
            </div>
          </>
        ) : (
          <>
            <div className="kx-cp-anim" aria-hidden="true">
              <span className="kx-cp-card"><Icon name="card" /></span>
              <span className="kx-cp-waves"><Icon name="contactless" /></span>
              <span className="kx-cp-reader"><i /></span>
            </div>
            <h1 className="kx-cp-title">Tap your card on the reader below</h1>
            <p className="kx-cp-sub" role="status">{payment ? "Waiting for your card, phone or watch…" : "Getting the reader ready…"}</p>
            <span className="kx-cp-down" aria-hidden="true"><Icon name="arrow" /></span>
            <button type="button" className="kx-ghost kx-cp-cancel" onClick={cancel}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
