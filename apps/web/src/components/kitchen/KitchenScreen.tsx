"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { gbp } from "@/lib/money";

type Item = { qty: number; name: string; size: string; modifiers: string[]; components: string[]; notes: string };
type O = { id: string; number: number; status: string; fulfilment: string; paymentMethod: string; paid: boolean; customerName: string; customerPhone: string; address: string; notes: string; scheduledFor: string | null; etaAt: string | null; etaMinutes: number | null; total: number; createdAt: string; placedAt: string | null; locationKey: string; locationName: string; rejectReason: string; items: Item[]; text: string };
type Loc = { key: string; name: string; open: boolean; paused: boolean; pausedUntil: string | null; pauseReason: string; prepMinutes: number; deliveryMinutes: number };

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
  const [sound, setSound] = useState(false);
  const [eta, setEta] = useState<Record<string, number>>({});
  const audio = useRef<AudioContext | null>(null);
  const known = useRef<Set<string>>(new Set());
  const first = useRef(true);

  const load = useCallback(async () => {
    const r = await fetch("/api/kitchen/orders", { cache: "no-store" });
    if (r.status === 401) { window.location.href = "/kitchen/login"; return; }
    const d = (await r.json()) as { orders: O[]; locations: Loc[] };
    setOrders(d.orders); setLocs(d.locations);
    const fresh = d.orders.filter((o) => o.status === "placed" && !known.current.has(o.id));
    d.orders.forEach((o) => known.current.add(o.id));
    if (!first.current && fresh.length && audio.current) beep(audio.current);
    first.current = false;
  }, []);

  useEffect(() => { void load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
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
    <div style={{ padding: "16px 20px 40px" }}>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Kitchen queue</span>
          <h1>Tickets</h1>
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
      </p>

      <div className="fp-kitchen">
        {COLUMNS.map((col) => {
          const tickets = orders.filter(col.match);
          return (
            <div key={col.key} className="fp-kitchencol">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 14px", borderBottom: "2px solid var(--color-divider)" }}>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>{col.label}</span>
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
                  const edge = o.status === "placed" ? "var(--color-accent)" : o.fulfilment === "delivery" ? "var(--color-text)" : "var(--color-neutral-500)";
                  const next = (NEXT[o.status] ?? []).filter(
                    (n) => !(n.to === "out_for_delivery" && o.fulfilment !== "delivery") && !(n.to === "completed" && n.label === "Collected" && o.fulfilment === "delivery"),
                  );

                  return (
                    <article key={o.id} style={{ background: "var(--color-surface)", padding: 12, display: "grid", gap: 8, borderLeft: `4px solid ${edge}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, fontWeight: 600 }}>#{o.number}</span>
                        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, color: late ? "var(--color-accent)" : "var(--color-text)" }}>
                          {age} min
                        </span>
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

                      <div style={{ fontSize: 13, display: "grid", gap: 2 }}>
                        {o.items.map((i, idx) => (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>{i.qty}×</span>
                            <span>
                              {i.name}{i.size ? ` (${i.size})` : ""}
                              {i.modifiers.length ? <span style={{ display: "block", color: "var(--color-neutral-700)" }}>+ {i.modifiers.join(", ")}</span> : null}
                              {i.components.map((c, ci) => <span key={ci} style={{ display: "block", color: "var(--color-neutral-700)" }}>• {c}</span>)}
                              {i.notes ? <span style={{ display: "block", color: "var(--color-accent-700)", fontWeight: 600 }}>&ldquo;{i.notes}&rdquo;</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                        {o.customerName} &middot; <a href={`tel:${o.customerPhone}`}>{o.customerPhone}</a>
                        {o.address ? <span style={{ display: "block" }}>{o.address}</span> : null}
                        {o.notes ? <span style={{ display: "block", color: "var(--color-accent-700)", fontWeight: 600 }}>Note: {o.notes}</span> : null}
                        {o.rejectReason ? <span style={{ display: "block", color: "var(--color-accent-700)" }}>Rejected: {o.rejectReason}</span> : null}
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
                            <button key={n.to} className="btn btn-primary btn-block" style={{ minHeight: 44 }} onClick={() => act(o.id, n.to)}>
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
