"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/money";
import { HelpSpot } from "@/components/admin/HelpSpot";

type Item = { qty: number; name: string; size: string; modifiers: string[]; components: string[]; notes: string };
type O = { id: string; number: number; status: string; fulfilment: string; paymentMethod: string; paid: boolean; customerName: string; customerPhone: string; address: string; notes: string; scheduledFor: string | null; etaAt: string | null; etaMinutes: number | null; total: number; createdAt: string; placedAt: string | null; locationKey: string; locationName: string; rejectReason: string; items: Item[]; text: string };
type Loc = { key: string; name: string; open: boolean; paused: boolean; pausedUntil: string | null; pauseReason: string; prepMinutes: number; deliveryMinutes: number };
/** Which of the three alert channels this shop actually has switched on. */
type Alerts = { sms: boolean; email: boolean; printer: boolean };

const NEXT: Record<string, { label: string; to: string }[]> = {
  accepted: [{ label: "Cooking", to: "preparing" }],
  preparing: [{ label: "Ready", to: "ready" }],
  ready: [{ label: "Out for delivery", to: "out_for_delivery" }, { label: "Collected", to: "completed" }],
  out_for_delivery: [{ label: "Delivered", to: "completed" }],
};
const REASONS = ["Too busy", "Item unavailable", "Outside delivery area", "Closing soon", "Other"];

/** Past this many minutes the ticket timer turns accent, as in the prototype. */
const LATE_MINUTES = 20;

/** The board's four columns, mapped onto the real order state machine. */
const COLUMNS: { key: string; label: string; match: (o: O) => boolean }[] = [
  { key: "new", label: "New", match: (o) => o.status === "placed" },
  { key: "cooking", label: "In the oven", match: (o) => o.status === "accepted" || o.status === "preparing" },
  { key: "ready", label: "Ready", match: (o) => o.status === "ready" },
  { key: "out", label: "Out for delivery", match: (o) => o.status === "out_for_delivery" },
];

function beep(ctx: AudioContext) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "square"; o.frequency.value = 880; g.gain.value = 0.15;
  o.connect(g); g.connect(ctx.destination); o.start();
  o.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
  o.stop(ctx.currentTime + 0.3);
}

/** Kitchen queue from `Farm Pizza Admin.dc.html`: a four-column ruled board of tickets,
 *  oldest first. Controls are at least 44px tall so the board works on a wall tablet. */
export function KitchenScreen() {
  const [orders, setOrders] = useState<O[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [alerts, setAlerts] = useState<Alerts>({ sms: false, email: false, printer: false });
  const [sound, setSound] = useState(false);
  const [eta, setEta] = useState<Record<string, number>>({});
  const audio = useRef<AudioContext | null>(null);
  const known = useRef<Set<string>>(new Set());
  const first = useRef(true);
  /**
   * New orders nobody has looked at yet.
   *
   * The beep alone is not enough on a wall tablet in a loud kitchen: it fires
   * once, and if the extractor is on or somebody is at the counter it is simply
   * missed. This is the visual half of the same alert - it stays on screen
   * until a person taps it, so an order cannot go unnoticed just because nobody
   * heard anything.
   */
  const [pending, setPending] = useState<O[]>([]);
  /**
   * Print the docket the moment an order lands.
   *
   * Remembered per device, because it is a property of the tablet by the pass
   * rather than of the shop - the office machine should not start spitting out
   * kitchen dockets because somebody switched this on downstairs.
   */
  const [autoPrint, setAutoPrint] = useState(false);
  const printQueue = useRef<string[]>([]);
  const printing = useRef(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  // `load` is a useCallback with an empty dependency list, so it would capture
  // whatever autoPrint was on first render and never see it change. A ref is
  // read fresh every time.
  const autoPrintRef = useRef(false);

  /**
   * Work through the queue one docket at a time.
   *
   * Sequential because printing is modal: pointing the frame at a second order
   * while the first is still going loses it, and a lost docket is a lost order.
   * The gap is a guess at how long a thermal printer needs, which is the honest
   * description of it - the browser gives no signal that a job has finished.
   */
  const drainPrints = useCallback(() => {
    if (printing.current) return;
    const id = printQueue.current.shift();
    if (!id || !frame.current) return;
    printing.current = true;
    frame.current.src = `/kitchen/print/${id}?copy=kitchen&auto=1`;
    setTimeout(() => { printing.current = false; drainPrints(); }, 4000);
  }, []);

  const load = useCallback(async () => {
    const r = await fetch("/api/kitchen/orders", { cache: "no-store" });
    if (r.status === 401) { window.location.href = "/kitchen/login"; return; }
    const d = (await r.json()) as { orders: O[]; locations: Loc[]; alerts?: Alerts };
    setOrders(d.orders); setLocs(d.locations);
    if (d.alerts) setAlerts(d.alerts);
    const fresh = d.orders.filter((o) => o.status === "placed" && !known.current.has(o.id));
    d.orders.forEach((o) => known.current.add(o.id));
    if (!first.current && fresh.length) {
      if (audio.current) beep(audio.current);
      setPending((q) => [...q, ...fresh]);
      if (autoPrintRef.current) {
        printQueue.current.push(...fresh.map((o) => o.id));
        drainPrints();
      }
      // Only when the tab is not the one being looked at - a system popup over
      // a screen somebody is already using is just in the way.
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        for (const o of fresh) {
          new Notification(`New order #${o.number}`, { body: `${o.fulfilment} · £${(o.total / 100).toFixed(2)}`, tag: o.id });
        }
      }
    }
    first.current = false;
  }, [drainPrints]);

  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  useEffect(() => { autoPrintRef.current = autoPrint; }, [autoPrint]);
  useEffect(() => {
    try { setAutoPrint(localStorage.getItem("fp-autoprint") === "1"); } catch { /* private browsing */ }
  }, []);
  useEffect(() => {
    if (sound && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [sound]);
  // Nag while unaccepted orders exist
  useEffect(() => {
    const t = setInterval(() => { if (audio.current && orders.some((o) => o.status === "placed")) beep(audio.current); }, 20000);
    return () => clearInterval(t);
  }, [orders]);

  async function act(id: string, status: string, extra: Record<string, unknown> = {}) {
    const r = await fetch(`/api/kitchen/orders/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, ...extra }) });
    if (!r.ok) alert((await r.json()).error ?? "Failed");
    void load();
  }
  async function pause(locationKey: string, minutes: number, reason = "") {
    await fetch("/api/kitchen/pause", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locationKey, minutes, reason }) });
    void load();
  }

  return (
    // fp-kitchenwrap is what carries the status colour tokens; without it the
    // green advance button has no --ok to paint with and comes out blank.
    <div className="fp-kitchenwrap" style={{ padding: "16px 20px 40px" }}>
      {/* Where the printing happens. Off-screen rather than display:none - a
          hidden frame is not rendered, and an unrendered page cannot print. */}
      <iframe
        ref={frame}
        title="Printing"
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: "fixed", width: 1, height: 1, left: -9999, top: 0, border: 0, opacity: 0 }}
      />
      {pending.length > 0 ? (
        <div className="fp-newalert" role="alert">
          <div className="fp-newalert-card">
            <span className="fp-newalert-count">
              {pending.length === 1 ? "New order" : `${pending.length} new orders`}
            </span>
            <div className="fp-newalert-list">
              {pending.slice(0, 4).map((o) => (
                <div key={o.id} className="fp-newalert-row">
                  <strong>#{o.number}</strong>
                  <span>{o.fulfilment.replace("_", " ")}</span>
                  <span>{gbp(o.total)}</span>
                </div>
              ))}
              {pending.length > 4 ? <div className="fp-newalert-more">and {pending.length - 4} more</div> : null}
            </div>
            <button className="btn btn-primary fp-newalert-ok" onClick={() => setPending([])} autoFocus>
              Got it
            </button>
          </div>
        </div>
      ) : null}

      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Kitchen queue</span>
          <h1>Tickets
            <HelpSpot title="Does anything else tell us an order has come in?" article="kitchen-queue" anchor="nobody-is-alerted-but-this-screen">
              {alerts.sms || alerts.email || alerts.printer ? (
                <>
                  Yes — this shop is also set up to send a new order to{" "}
                  {[alerts.sms && "a kitchen text", alerts.email && "a kitchen email", alerts.printer && "the ticket printer"]
                    .filter(Boolean).join(", ")}
                  . Those can fail quietly, so this board is still the one to watch.
                </>
              ) : (
                <>
                  No. There is no kitchen text, no kitchen email and no printer switched on for this shop — new
                  orders appear here and nowhere else. If this tab is shut or the tablet goes to sleep, nobody
                  is told.
                </>
              )}
            </HelpSpot>
          </h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {locs.map((l) => (
            <span key={l.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span
                style={{
                  width: 8, height: 8,
                  background: l.paused ? "var(--color-neutral-500)" : l.open ? "var(--color-accent)" : "var(--color-neutral-400)",
                  animation: !l.paused && l.open ? "fp-pulse 1.4s ease-in-out infinite" : undefined,
                }}
              />
              {l.name}: {l.paused ? `paused${l.pausedUntil ? ` until ${new Date(l.pausedUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}` : l.open ? "open" : "closed"}
              <HelpSpot title="What do customers see while we are paused?" article="kitchen-queue" anchor="pausing-from-here">
                The word &ldquo;Busy&rdquo;, and you cannot change it from here — pause from Hours &amp; pause if they
                need to read something else. &ldquo;Rest of day&rdquo; is four hours, not until closing, and a pause
                stops new orders only; anything already in still has to be cooked.
              </HelpSpot>
              {l.paused ? (
                <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => pause(l.key, 0)}>Resume</button>
              ) : (
                <select
                  className="input" style={{ minHeight: 44, width: 120 }} defaultValue=""
                  aria-label={`Pause ${l.name}`}
                  onChange={(e) => { const m = Number(e.target.value); if (m) pause(l.key, m, "Busy"); e.target.value = ""; }}
                >
                  <option value="" disabled>Pause…</option>
                  <option value="15">15 min</option><option value="30">30 min</option>
                  <option value="60">1 hour</option><option value="240">Rest of day</option>
                </select>
              )}
            </span>
          ))}
          <button
            className={sound ? "btn btn-secondary" : "btn btn-primary"}
            style={{ minHeight: 44 }}
            onClick={() => { if (!audio.current) audio.current = new AudioContext(); void audio.current.resume(); setSound(true); beep(audio.current); }}
          >
            {sound ? "Sound on" : "Enable sound"}
          </button>
          <button
            className={autoPrint ? "btn btn-secondary" : "btn btn-secondary"}
            style={{ minHeight: 44 }}
            aria-pressed={autoPrint}
            onClick={() => {
              const to = !autoPrint;
              setAutoPrint(to);
              try { localStorage.setItem("fp-autoprint", to ? "1" : "0"); } catch { /* private browsing */ }
            }}
          >
            {autoPrint ? "Auto-print on" : "Auto-print off"}
          </button>
          <HelpSpot title="Why does this say Enable sound again?" article="kitchen-queue" anchor="the-beep">
            Browsers will not play a sound until somebody presses something, so every reload or tablet restart
            switches it off. First job of a shift: check it says Sound on.
          </HelpSpot>
          {/* A shared tablet needs a way to hand over at the end of a shift. */}
          <button
            className="btn btn-secondary"
            style={{ minHeight: 44 }}
            onClick={async () => {
              try { await fetch("/api/admin/logout", { method: "POST" }); }
              finally { window.location.href = "/admin/login"; }
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 16px" }}>
        Oldest ticket first. Accent timers are past the {LATE_MINUTES}-minute promise.
        <HelpSpot title="Can I move a ticket back a column?" article="kitchen-queue" anchor="the-four-columns">
          No. The buttons only go forwards — tap Ready by mistake and it cannot go back in the oven, and there
          is no way to edit or cancel a ticket once it has been accepted. Ring the customer and sort it between you.
        </HelpSpot>
      </p>

      <div className="fp-kitchen">
        {COLUMNS.map((col) => {
          const tickets = orders.filter(col.match);
          return (
            <div key={col.key} className="fp-kitchencol">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 14px", borderBottom: "2px solid var(--color-divider)" }}>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>
                  {col.label}
                  {col.key === "new" ? (
                    <HelpSpot title="What does the minutes box promise?" article="kitchen-queue" anchor="accepting-an-order">
                      Whatever number is showing when you tap Accept is the time the customer is told. It starts at
                      your standard 15 or 35 minutes and takes no notice of how busy you are, so put it up by hand on
                      a bad night. Reject refunds a card payment in full, straight away, and cannot be undone.
                    </HelpSpot>
                  ) : null}
                </span>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, color: "var(--color-accent)" }}>{tickets.length}</span>
              </div>

              <div style={{ display: "grid", gap: 10, padding: 10, alignContent: "start" }}>
                {tickets.length === 0 ? (
                  <div style={{ padding: "24px 12px", fontSize: 13, color: "var(--color-neutral-500)" }}>Nothing here.</div>
                ) : null}

                {tickets.map((o) => {
                  const age = Math.round((Date.now() - new Date(o.placedAt ?? o.createdAt).getTime()) / 60000);
                  const late = age >= LATE_MINUTES;
                  const loc = locs.find((l) => l.key === o.locationKey);
                  const defaultEta = o.fulfilment === "delivery" ? (loc?.deliveryMinutes ?? 35) : (loc?.prepMinutes ?? 15);
                  // The stripe down the side is the stage, so a glance across the
                  // board reads as a queue rather than a wall of identical cards.
                  const EDGE: Record<string, string> = {
                    placed: "var(--danger)",
                    accepted: "var(--warn)",
                    preparing: "var(--warn)",
                    ready: "var(--info)",
                    out_for_delivery: "var(--color-accent-2, #3E6B48)",
                  };
                  const edge = EDGE[o.status] ?? "var(--color-neutral-500)";
                  const next = (NEXT[o.status] ?? []).filter(
                    (n) => !(n.to === "out_for_delivery" && o.fulfilment !== "delivery") && !(n.to === "completed" && n.label === "Collected" && o.fulfilment === "delivery"),
                  );

                  return (
                    <article key={o.id} className="fp-ticket" data-late={late ? "1" : undefined} style={{ borderLeft: `6px solid ${edge}` }}>
                      {/* Number and clock in monospace at 28px. This is read from
                          the pass, not from a chair: at arm's length across a hot
                          kitchen, 13px is invisible and a proportional font makes
                          the digits jump about as the minutes tick. */}
                      <div className="fp-ticket-head">
                        <span className="fp-ticket-no">#{o.number}</span>
                        <span className="fp-ticket-age">{age}<small>min</small></span>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11 }}>
                        <span className="tag tag-neutral">{o.fulfilment === "delivery" ? "Delivery" : "Collection"}</span>
                        <span className="tag tag-neutral">{o.paid ? "Paid" : o.paymentMethod === "cash" ? `Cash ${gbp(o.total)}` : "Unpaid"}</span>
                        {o.scheduledFor ? (
                          <span className="tag tag-accent">
                            For {new Date(o.scheduledFor).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : null}
                      </div>

                      <div className="fp-ticket-items">
                        {o.items.map((i, idx) => (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 6 }}>
                            <span className="fp-ticket-qty">{i.qty}&times;</span>
                            <span>
                              <span className="fp-ticket-item">{i.name}{i.size ? ` (${i.size})` : ""}</span>
                              {/* Anything that changes the food is boxed and shouted.
                                  A missed "no olives" is a remake and an angry phone
                                  call, so it must not read like the line above it. */}
                              {i.modifiers.map((m, mi) => <span key={mi} className="fp-ticket-mod">{m}</span>)}
                              {i.components.map((c, ci) => <span key={ci} className="fp-ticket-part">{c}</span>)}
                              {i.notes ? <span className="fp-ticket-note">&ldquo;{i.notes}&rdquo;</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="fp-ticket-who">
                        {o.customerName} &middot; <a href={`tel:${o.customerPhone}`}>{o.customerPhone}</a>
                        {o.address ? <span style={{ display: "block" }}>{o.address}</span> : null}
                        {o.notes ? <span className="fp-ticket-driver">Note: {o.notes}</span> : null}
                        {o.rejectReason ? <span style={{ display: "block", color: "var(--danger)" }}>Rejected: {o.rejectReason}</span> : null}
                      </div>

                      {/* The whole order, one press away.
                          The card is deliberately short - it is read at arm's
                          length across a hot kitchen and a long ticket pushes the
                          next order off the board. But somebody checking an
                          address, a gate code or what exactly is on the pizza
                          needs all of it, without leaving the queue. */}
                      <details className="fp-ticket-full">
                        <summary>Open the whole order</summary>
                        <dl>
                          <dt>Order</dt><dd>#{o.number} &middot; {o.locationName}</dd>
                          <dt>Placed</dt><dd>{new Date(o.placedAt ?? o.createdAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} ({age} min ago)</dd>
                          {o.scheduledFor ? <><dt>Wanted for</dt><dd>{new Date(o.scheduledFor).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</dd></> : null}
                          {o.etaAt ? <><dt>Promised</dt><dd>{new Date(o.etaAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</dd></> : null}
                          <dt>Customer</dt><dd>{o.customerName}<br /><a href={`tel:${o.customerPhone}`}>{o.customerPhone}</a></dd>
                          <dt>{o.fulfilment === "delivery" ? "Deliver to" : "Collection"}</dt>
                          <dd>{o.address || "At the counter"}</dd>
                          {o.notes ? <><dt>Driver note</dt><dd className="fp-ticket-driver-full">{o.notes}</dd></> : null}
                          <dt>Payment</dt><dd>{o.paid ? "Paid online" : o.paymentMethod === "cash" ? `CASH TO COLLECT — ${gbp(o.total)}` : "Unpaid"}</dd>
                          <dt>Total</dt><dd>{gbp(o.total)}</dd>
                        </dl>
                        <div className="fp-ticket-full-items">
                          {o.items.map((i, idx) => (
                            <div key={idx}>
                              <strong>{i.qty}&times; {i.name}{i.size ? ` (${i.size})` : ""}</strong>
                              {i.components.length ? <div>{i.components.join(", ")}</div> : null}
                              {i.modifiers.length ? <div><em>{i.modifiers.join(", ")}</em></div> : null}
                              {i.notes ? <div>&ldquo;{i.notes}&rdquo;</div> : null}
                            </div>
                          ))}
                        </div>
                      </details>

                      {/* Reprint. The kitchen copy replaces one that has been
                          spilled on; the delivery note is what goes out with
                          the driver, so it is only offered when there is a
                          driver to give it to. */}
                      <div className="fp-ticket-print">
                        <a href={`/kitchen/print/${o.id}?copy=kitchen&auto=1`} target="_blank" rel="noreferrer">Kitchen copy</a>
                        <a href={`/kitchen/print/${o.id}?copy=customer&auto=1`} target="_blank" rel="noreferrer">Receipt</a>
                        {o.fulfilment === "delivery" ? (
                          <a href={`/kitchen/print/${o.id}?copy=driver&auto=1`} target="_blank" rel="noreferrer">Delivery note</a>
                        ) : null}
                        <a href={`/kitchen/print/${o.id}?copy=all&auto=1`} target="_blank" rel="noreferrer">All</a>
                      </div>

                      {o.status === "placed" ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <select
                              className="input" style={{ minHeight: 44, flex: 1 }} aria-label={`ETA for order ${o.number}`}
                              value={eta[o.id] ?? defaultEta}
                              onChange={(e) => setEta((p) => ({ ...p, [o.id]: Number(e.target.value) }))}
                            >
                              {[10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                            </select>
                            <button className="btn btn-primary" style={{ minHeight: 44, flex: 1 }} onClick={() => act(o.id, "accepted", { etaMinutes: eta[o.id] ?? defaultEta })}>
                              Accept
                            </button>
                          </div>
                          <select
                            className="input" style={{ minHeight: 44 }} defaultValue="" aria-label={`Reject order ${o.number}`}
                            onChange={(e) => { if (e.target.value && confirm(`Reject #${o.number}?`)) act(o.id, "rejected", { reason: e.target.value }); e.target.value = ""; }}
                          >
                            <option value="" disabled>Reject…</option>
                            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      ) : next.length ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {next.map((n) => (
                            <button key={n.to} className="btn fp-ticket-go" data-to={n.to} onClick={() => act(o.id, n.to)}>
                              {n.label}
                            </button>
                          ))}
                          {o.etaAt ? (
                            <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>
                              ETA {new Date(o.etaAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
