"use client";
import { useActionState, useMemo, useState } from "react";
import { gbp, gbpShort } from "@/lib/money";
import { fillPush, PUSH_BODY_MAX, PUSH_TITLE_MAX } from "@/lib/push-offers";
import type { PushSendState } from "@/app/admin/(shell)/push-actions";

type Person = { id: string; name: string; phone: string };
type Promo = { code: string; type: string; value: number; minOrder: number; firstOrderOnly: boolean };

export type PushComposerProps = {
  action: (prev: PushSendState, fd: FormData) => Promise<PushSendState>;
  shopName: string;
  allCount: number;
  segments: { key: string; label: string; group: string; n: number }[];
  people: Person[];
  initialPicked: string[];
  skippedPicked: number;
  deals: { id: string; name: string; price: number }[];
  promos: Promo[];
  slots: { id: string; title: string; subtitle: string }[];
  disabled: boolean;
};

function describe(p: { type: string; value: number; minOrder: number }): string {
  const what = p.type === "percent" ? `${p.value}% off` : p.type === "fixed" ? `${gbpShort(p.value)} off` : "free delivery";
  return p.minOrder > 0 ? `${what} orders over ${gbpShort(p.minOrder)}` : what;
}

/**
 * Compose, preview, count, confirm.
 *
 * The SMS composer sends on the first press with no preview; this one shows
 * the notification as it will land and asks "Send to N customers?" before
 * anything goes. The action also refuses an identical send within minutes, so
 * a double-click past the confirm still reaches each phone once.
 */
export function PushComposer(p: PushComposerProps) {
  const [state, formAction, pending] = useActionState(p.action, null);
  const [offer, setOffer] = useState(p.deals[0] ? `deal:${p.deals[0].id}` : p.promos[0] ? `promo:${p.promos[0].code}` : "none");
  const [custom, setCustom] = useState({ code: "", type: "percent", value: "20", min: "", days: "7" });
  const [audience, setAudience] = useState(p.initialPicked.length ? "picked" : "all");
  const [segment, setSegment] = useState(p.segments[0]?.key ?? "");
  const [picked, setPicked] = useState<string[]>(p.initialPicked);
  const [search, setSearch] = useState("");
  const [edited, setEdited] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const customCode = custom.code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const perPerson = offer === "custom" && audience === "picked";

  /** The code as the first recipient would see it. */
  const code = offer.startsWith("promo:") ? offer.slice(6) : offer === "custom" ? (perPerson ? `${customCode || "CODE"}-7KQ2M` : customCode || "CODE") : "";

  const suggested = useMemo(() => {
    const [kind, id] = [offer.split(":")[0], offer.split(":").slice(1).join(":")];
    if (kind === "deal") {
      const d = p.deals.find((x) => x.id === id);
      return d ? { title: `${d.name} is on`, body: `{name}, ${d.name} for ${gbp(d.price)} tonight. Tap to order.` } : null;
    }
    if (kind === "promo") {
      const pr = p.promos.find((x) => x.code === id);
      return pr ? { title: `A treat from {shop}`, body: `{name}, use {code} for ${describe(pr)}. Tap to order.` } : null;
    }
    if (kind === "slot") {
      const s = p.slots.find((x) => x.id === id);
      return s ? { title: s.title, body: s.subtitle || "Tap to take a look." } : null;
    }
    if (kind === "custom") {
      const v = Number(custom.value) || 0;
      const d = { type: custom.type, value: custom.type === "fixed" ? Math.round(v * 100) : v, minOrder: Math.round((Number(custom.min) || 0) * 100) };
      return { title: `A treat from {shop}`, body: `{name}, use {code} for ${describe(d)}. Ends in ${custom.days || 7} days.` };
    }
    return { title: "{shop}", body: "" };
  }, [offer, custom, p.deals, p.promos, p.slots]);

  const [title, setTitle] = useState(suggested?.title ?? "");
  const [body, setBody] = useState(suggested?.body ?? "");
  const shownTitle = edited ? title : (suggested?.title ?? "");
  const shownBody = edited ? body : (suggested?.body ?? "");

  const count = audience === "all" ? p.allCount
    : audience === "segment" ? (p.segments.find((s) => s.key === segment)?.n ?? 0)
    : picked.length;

  const firstName = audience === "picked" && picked[0] ? (p.people.find((x) => x.id === picked[0])?.name ?? "") : "Sam";
  const q = search.trim().toLowerCase();
  const matches = q ? p.people.filter((x) => x.name.toLowerCase().includes(q) || x.phone.includes(q)).slice(0, 30) : [];
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const groups = [...new Set(p.segments.map((s) => s.group))];

  const edit = (t: string, b: string) => { setEdited(true); setTitle(t); setBody(b); setConfirming(false); };

  return (
    <form action={formAction} style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
      <div style={{ border: "2px solid var(--color-text)", padding: 24, display: "grid", gap: 16 }}>
        <div className="field">
          <label htmlFor="offer">Offer</label>
          <select id="offer" name="offer" className="input" value={offer} onChange={(e) => { setOffer(e.target.value); setConfirming(false); }}>
            {p.deals.length ? (
              <optgroup label="Deals">
                {p.deals.map((d) => <option key={d.id} value={`deal:${d.id}`}>{d.name} &mdash; {gbp(d.price)}</option>)}
              </optgroup>
            ) : null}
            {p.promos.length ? (
              <optgroup label="Codes">
                {p.promos.map((c) => <option key={c.code} value={`promo:${c.code}`}>{c.code} &mdash; {describe(c)}{c.firstOrderOnly ? " (first order only)" : ""}</option>)}
              </optgroup>
            ) : null}
            {p.slots.length ? (
              <optgroup label="Home-screen cards">
                {p.slots.map((s) => <option key={s.id} value={`slot:${s.id}`}>{s.title}</option>)}
              </optgroup>
            ) : null}
            <optgroup label="Something else">
              <option value="custom">Build a new offer&hellip;</option>
              <option value="none">No offer, just a message</option>
            </optgroup>
          </select>
          <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "6px 0 0" }}>
            {offer.startsWith("deal:") || offer.startsWith("slot:") ? "Tapping opens this in the app. There is no code, so orders from it cannot be counted." : null}
            {offer.startsWith("promo:") ? "Tapping opens the menu. Orders using the code are counted against this send." : null}
            {offer === "none" ? "Tapping opens the menu. Nothing to measure." : null}
          </p>
        </div>

        {offer === "custom" ? (
          <div className="fp-fields" style={{ border: "1px solid var(--color-neutral-300)", padding: 12 }}>
            <div className="field">
              <label htmlFor="customCode">Code name</label>
              <input id="customCode" name="customCode" className="input" required maxLength={14} placeholder="FRIDAY20"
                value={custom.code} onChange={(e) => setCustom({ ...custom, code: e.target.value })} style={{ textTransform: "uppercase" }} />
            </div>
            <div className="field">
              <label htmlFor="customType">Type</label>
              <select id="customType" name="customType" className="input" value={custom.type} onChange={(e) => setCustom({ ...custom, type: e.target.value })}>
                <option value="percent">% off</option>
                <option value="fixed">&pound; off</option>
                <option value="free_delivery">Free delivery</option>
              </select>
            </div>
            {custom.type !== "free_delivery" ? (
              <div className="field">
                <label htmlFor="customValue">{custom.type === "percent" ? "Percent off" : "Pounds off"}</label>
                <input id="customValue" name="customValue" className="input" inputMode="decimal" required
                  value={custom.value} onChange={(e) => setCustom({ ...custom, value: e.target.value })} />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="customMin">Minimum order &pound;</label>
              <input id="customMin" name="customMin" className="input" inputMode="decimal" placeholder="none"
                value={custom.min} onChange={(e) => setCustom({ ...custom, min: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="customDays">Runs for (days)</label>
              <input id="customDays" name="customDays" className="input" inputMode="numeric" required
                value={custom.days} onChange={(e) => setCustom({ ...custom, days: e.target.value })} />
            </div>
            <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--color-neutral-700)", margin: 0 }}>
              {perPerson
                ? "Each picked customer gets their own single-use code (like FRIDAY20-7KQ2M) that only works on their account."
                : "One shared code, created when you send. Like every live code it also shows on the website's Deals page."}
            </p>
          </div>
        ) : null}

        <div className="field">
          <span style={{ fontWeight: 700, fontSize: 13 }}>Send to</span>
          <div style={{ display: "grid", gap: 6, marginTop: 6, fontSize: 14 }}>
            <label><input type="radio" name="audienceKind" checked={audience === "all"} onChange={() => { setAudience("all"); setConfirming(false); }} /> Everyone with the app ({p.allCount})</label>
            <label><input type="radio" name="audienceKind" checked={audience === "segment"} onChange={() => { setAudience("segment"); setConfirming(false); }} /> A group</label>
            {audience === "segment" ? (
              <select className="input" value={segment} onChange={(e) => { setSegment(e.target.value); setConfirming(false); }}>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {p.segments.filter((s) => s.group === g).map((s) => <option key={s.key} value={s.key}>{s.label} ({s.n})</option>)}
                  </optgroup>
                ))}
              </select>
            ) : null}
            <label><input type="radio" name="audienceKind" checked={audience === "picked"} onChange={() => { setAudience("picked"); setConfirming(false); }} /> People I pick ({picked.length})</label>
          </div>
          <input type="hidden" name="audience" value={audience === "segment" ? `segment:${segment}` : audience} />
          <input type="hidden" name="ids" value={audience === "picked" ? picked.join(",") : ""} />
          {p.skippedPicked ? (
            <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "6px 0 0" }}>
              {p.skippedPicked} of the people you came here with have no app or have not opted in, so they are left out.
            </p>
          ) : null}
          {audience === "picked" ? (
            <div style={{ marginTop: 8 }}>
              <input className="input" type="search" placeholder="Search by name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
              {matches.length ? (
                <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", maxHeight: 220, overflowY: "auto", border: "1px solid var(--color-neutral-300)" }}>
                  {matches.map((x) => (
                    <li key={x.id} style={{ padding: "6px 8px", borderBottom: "1px solid var(--color-neutral-300)" }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                        <input type="checkbox" checked={picked.includes(x.id)} onChange={() => { toggle(x.id); setConfirming(false); }} />
                        {x.name || "No name"} <span style={{ color: "var(--color-neutral-700)" }}>{x.phone}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : q ? <p style={{ fontSize: 12, margin: "6px 0 0" }}>Nobody with the app matches that.</p> : null}
              {picked.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {picked.map((id) => {
                    const who = p.people.find((x) => x.id === id);
                    return (
                      <button key={id} type="button" className="tag tag-neutral" onClick={() => { toggle(id); setConfirming(false); }} aria-label={`Remove ${who?.name || who?.phone || id}`}>
                        {who?.name || who?.phone || id} &times;
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" className="input" required maxLength={PUSH_TITLE_MAX} value={shownTitle} onChange={(e) => edit(e.target.value, shownBody)} />
        </div>
        <div className="field">
          <label htmlFor="body">Message</label>
          <textarea id="body" name="body" className="input" required rows={3} maxLength={PUSH_BODY_MAX} style={{ padding: 10, resize: "vertical" }}
            value={shownBody} onChange={(e) => edit(shownTitle, e.target.value)} />
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-neutral-700)" }}>
            <strong>{"{name}"}</strong> first name, <strong>{"{shop}"}</strong> shop name, <strong>{"{code}"}</strong> the offer code. {shownBody.length}/{PUSH_BODY_MAX}
          </p>
        </div>

        {state ? (
          <p role="status" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: state.ok ? "var(--color-ok)" : "var(--color-danger)" }}>{state.message}</p>
        ) : null}

        {confirming ? (
          <div style={{ border: "2px solid var(--color-accent-700)", padding: 12, display: "grid", gap: 10 }}>
            <strong>Send to {count} customer{count === 1 ? "" : "s"}? There is no taking it back.</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" disabled={pending || p.disabled} onClick={() => setTimeout(() => setConfirming(false), 0)}>
                {pending ? "Sending…" : "Yes, send it"}
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={pending}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" style={{ justifySelf: "start" }}
            disabled={p.disabled || pending || count === 0 || !shownTitle.trim() || !shownBody.trim()}
            onClick={() => setConfirming(true)}>
            {pending ? "Sending…" : `Review send to ${count}`}
          </button>
        )}
      </div>

      <div>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>How it lands</span>
        <div style={{ width: 300, maxWidth: "100%", aspectRatio: "9 / 16", borderRadius: 36, border: "10px solid #111", background: "linear-gradient(160deg, #3b4a6b, #1d2436)", padding: "56px 12px 12px", boxSizing: "border-box" }}>
          <div style={{ textAlign: "center", color: "#fff", fontSize: 44, fontWeight: 300, marginBottom: 24 }}>18:42</div>
          <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 16, padding: "10px 12px", color: "#111", fontSize: 13, lineHeight: 1.35 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 2 }}>
              <span style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{p.shopName}</span><span>now</span>
            </div>
            <div style={{ fontWeight: 700 }}>{fillPush(shownTitle, firstName, code, p.shopName) || "Title"}</div>
            <div>{fillPush(shownBody, firstName, code, p.shopName) || "Your message"}</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-neutral-700)", maxWidth: 300 }}>
          {count} customer{count === 1 ? "" : "s"} will get this. Phones cut long text short, so the first few words matter most.
        </p>
      </div>
    </form>
  );
}
