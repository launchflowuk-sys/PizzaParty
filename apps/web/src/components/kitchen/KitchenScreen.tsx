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

function beep(ctx: AudioContext) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "square"; o.frequency.value = 880; g.gain.value = 0.15;
  o.connect(g); g.connect(ctx.destination); o.start();
  o.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
  o.stop(ctx.currentTime + 0.3);
}

export function KitchenScreen() {
  const [orders, setOrders] = useState<O[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [sound, setSound] = useState(false);
  const [tab, setTab] = useState<"new" | "active" | "done">("new");
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

  const newOrders = orders.filter((o) => o.status === "placed");
  const active = orders.filter((o) => ["accepted", "preparing", "ready", "out_for_delivery"].includes(o.status));
  const done = orders.filter((o) => ["completed", "rejected", "cancelled"].includes(o.status)).reverse();
  const list = tab === "new" ? newOrders : tab === "active" ? active : done;

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-center gap-2 justify-between">
        <h1 className="text-xl font-extrabold">Kitchen</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {locs.map((l) => (
            <div key={l.key} className={`lf-pill border ${l.paused ? "bg-warning/30 border-warning" : l.open ? "bg-success/15 border-success/40" : "bg-line border-line"}`}>
              {l.name}: {l.paused ? `paused${l.pausedUntil ? ` until ${new Date(l.pausedUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}` : l.open ? "open" : "closed"}
              {l.paused ? <button className="ml-1 underline" onClick={() => pause(l.key, 0)}>resume</button> : (
                <select className="ml-1 bg-transparent" defaultValue="" onChange={(e) => { const m = Number(e.target.value); if (m) pause(l.key, m, "Busy"); e.target.value = ""; }} aria-label={`Pause ${l.name}`}>
                  <option value="" disabled>pause…</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 hour</option><option value="240">Rest of day</option>
                </select>
              )}
            </div>
          ))}
          <button className={`lf-btn ${sound ? "lf-btn-secondary" : "lf-btn-ghost"}`} onClick={() => { if (!audio.current) audio.current = new AudioContext(); void audio.current.resume(); setSound(true); beep(audio.current); }}>{sound ? "🔔 Sound on" : "🔕 Enable sound"}</button>
        </div>
      </header>

      <nav className="mt-3 grid grid-cols-3 gap-2">
        {([["new", `New (${newOrders.length})`], ["active", `In progress (${active.length})`], ["done", `Done (${done.length})`]] as const).map(([k, label]) => (
          <button key={k} className={`lf-btn ${tab === k ? "lf-btn-secondary" : "lf-btn-ghost"} ${k === "new" && newOrders.length ? "ring-2 ring-brand" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.length === 0 ? <p className="text-muted p-6">Nothing here.</p> : null}
        {list.map((o) => {
          const age = Math.round((Date.now() - new Date(o.placedAt ?? o.createdAt).getTime()) / 60000);
          const defaultEta = o.fulfilment === "delivery" ? (locs.find((l) => l.key === o.locationKey)?.deliveryMinutes ?? 35) : (locs.find((l) => l.key === o.locationKey)?.prepMinutes ?? 15);
          return (
            <article key={o.id} className={`lf-card p-4 border-l-4 ${o.status === "placed" ? "border-brand" : o.fulfilment === "delivery" ? "border-ink" : "border-success"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-2xl font-extrabold">#{o.number} <span className="text-sm font-bold uppercase text-muted">{o.fulfilment}</span></p>
                  <p className="text-sm text-muted">{o.locationName} · {age} min ago · {o.paid ? "PAID" : o.paymentMethod === "cash" ? `CASH ${gbp(o.total)}` : "UNPAID"}</p>
                  {o.scheduledFor ? <p className="text-sm font-bold text-warning">⏰ For {new Date(o.scheduledFor).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p> : null}
                </div>
                <p className="text-lg font-extrabold">{gbp(o.total)}</p>
              </div>
              <ul className="mt-3 space-y-1 text-[15px]">
                {o.items.map((i, idx) => (
                  <li key={idx}>
                    <span className="font-bold">{i.qty} × {i.name}</span>{i.size ? <span className="text-muted"> ({i.size})</span> : null}
                    {i.modifiers.length ? <span className="block pl-4 text-ink-soft">+ {i.modifiers.join(", ")}</span> : null}
                    {i.components.map((c, ci) => <span key={ci} className="block pl-4 text-ink-soft">• {c}</span>)}
                    {i.notes ? <span className="block pl-4 text-danger font-semibold">“{i.notes}”</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm"><span className="font-semibold">{o.customerName}</span> · <a className="underline" href={`tel:${o.customerPhone}`}>{o.customerPhone}</a></p>
              {o.address ? <p className="text-sm">{o.address}</p> : null}
              {o.notes ? <p className="text-sm text-danger font-semibold mt-1">Note: {o.notes}</p> : null}
              {o.rejectReason ? <p className="text-sm text-danger mt-1">Rejected: {o.rejectReason}</p> : null}

              {o.status === "placed" ? (
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2 items-center">
                    <label className="text-sm font-semibold">ETA</label>
                    <select className="lf-input flex-1" value={eta[o.id] ?? defaultEta} onChange={(e) => setEta((p) => ({ ...p, [o.id]: Number(e.target.value) }))}>
                      {[10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
                    </select>
                    <button className="lf-btn lf-btn-primary flex-1" onClick={() => act(o.id, "accepted", { etaMinutes: eta[o.id] ?? defaultEta })}>Accept</button>
                  </div>
                  <select className="lf-input" defaultValue="" onChange={(e) => { if (e.target.value && confirm(`Reject #${o.number}?`)) act(o.id, "rejected", { reason: e.target.value }); e.target.value = ""; }} aria-label="Reject with reason">
                    <option value="" disabled>Reject…</option>{REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ) : NEXT[o.status] ? (
                <div className="mt-4 flex gap-2">
                  {NEXT[o.status]!.filter((n) => !(n.to === "out_for_delivery" && o.fulfilment !== "delivery") && !(n.to === "completed" && n.label === "Collected" && o.fulfilment === "delivery")).map((n) => (
                    <button key={n.to} className="lf-btn lf-btn-secondary flex-1" onClick={() => act(o.id, n.to)}>{n.label}</button>
                  ))}
                  {o.etaAt ? <span className="text-xs text-muted self-center">ETA {new Date(o.etaAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span> : null}
                </div>
              ) : null}
              <details className="mt-3 text-xs text-muted"><summary>Print text</summary><pre className="whitespace-pre-wrap">{o.text}</pre></details>
            </article>
          );
        })}
      </div>
    </div>
  );
}
