"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBasket } from "@/components/basket/store";
import { useServerPrice } from "@/components/basket/useServerPrice";
import { gbp } from "@/lib/money";
import { PayStep } from "./PayStep";

type Ctx = {
  name: string; fulfilment: ("delivery" | "collection")[]; cashOnCollection: boolean; cashOnDelivery: boolean;
  stripe: { publishableKey: string; accountId: string | null } | null;
  locations: { key: string; name: string; address: string; deliveryFee: number; minOrder: number; prepMinutes: number; deliveryMinutes: number; open: boolean; paused: boolean; pausedUntil: string | null; pauseReason: string; nextOpen: string | null; timezone: string; slots: string[] }[];
  customer: { name: string; phone: string; email: string; addresses: { id: string; line1: string; line2: string; city: string; postcode: string }[] } | null;
};

type Step = "fulfilment" | "details" | "pay";

export function CheckoutFlow() {
  const router = useRouter();
  const basket = useBasket();
  const { data: price, loading } = useServerPrice();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [step, setStep] = useState<Step>("fulfilment");
  const [when, setWhen] = useState<"asap" | string>("asap");
  const [form, setForm] = useState({ name: "", phone: "", email: "", line1: "", line2: "", city: "", postcode: "", notes: "", marketingOptIn: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<{ orderId: string; clientSecret: string; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/checkout/context").then((r) => r.json()).then((c: Ctx) => {
      setCtx(c);
      if (c.customer) {
        const a = c.customer.addresses[0];
        setForm((f) => ({ ...f, name: c.customer!.name, phone: c.customer!.phone, email: c.customer!.email, line1: a?.line1 ?? "", line2: a?.line2 ?? "", city: a?.city ?? "", postcode: a?.postcode ?? basket.postcode }));
      } else setForm((f) => ({ ...f, postcode: basket.postcode }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const location = useMemo(() => {
    if (!ctx) return null;
    if (basket.fulfilment === "delivery") return ctx.locations.find((l) => l.key === price?.location?.key) ?? null;
    return ctx.locations.find((l) => l.key === basket.locationKey) ?? ctx.locations[0] ?? null;
  }, [ctx, basket.fulfilment, basket.locationKey, price?.location?.key]);

  const closedNow = location ? !location.open : false;
  const mustSchedule = closedNow && when === "asap";

  if (basket.lines.length === 0 && !pay) {
    return <div className="lf-card p-8 mt-6 text-center"><p className="text-muted">Your basket is empty.</p><Link href="/menu" className="lf-btn lf-btn-primary mt-4">Browse the menu</Link></div>;
  }
  if (!ctx) return <p className="mt-6 text-muted" aria-busy>Loading checkout…</p>;

  async function placeOrder(paymentMethod: "card" | "cash") {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: basket.lines, fulfilment: basket.fulfilment, postcode: basket.fulfilment === "delivery" ? form.postcode : "", locationKey: location?.key ?? "", promoCode: basket.promoCode,
          name: form.name, phone: form.phone, email: form.email, notes: form.notes, marketingOptIn: form.marketingOptIn,
          address: basket.fulfilment === "delivery" ? { line1: form.line1, line2: form.line2, city: form.city, postcode: form.postcode } : undefined,
          scheduledFor: when === "asap" ? undefined : when, paymentMethod,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Something went wrong"); if (d.removedKeys?.length) basket.replace(basket.lines.filter((l) => !d.removedKeys.includes(l.key))); return; }
      if (d.cash) { basket.clear(); router.push(`/order/${d.orderId}`); return; }
      setPay({ orderId: d.orderId, clientSecret: d.clientSecret, total: d.total });
      setStep("pay");
    } catch {
      setError("Network error. Please try again.");
    } finally { setBusy(false); }
  }

  const cashAllowed = basket.fulfilment === "collection" ? ctx.cashOnCollection : ctx.cashOnDelivery;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="mt-4 space-y-4">
      <ol className="flex gap-2 text-xs font-semibold text-muted">
        {(["fulfilment", "details", "pay"] as Step[]).map((s, i) => <li key={s} className={step === s ? "text-brand" : ""}>{i + 1}. {s === "fulfilment" ? "Delivery or collection" : s === "details" ? "Your details" : "Pay"}</li>)}
      </ol>

      {step === "fulfilment" ? (
        <section className="lf-card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {ctx.fulfilment.map((f) => <button key={f} className={`lf-btn ${basket.fulfilment === f ? "lf-btn-secondary" : "lf-btn-ghost"}`} onClick={() => basket.setFulfilment(f)}>{f === "delivery" ? "Delivery" : "Collection"}</button>)}
          </div>
          {basket.fulfilment === "delivery" ? (
            <div>
              <label className="lf-label" htmlFor="pc">Delivery postcode</label>
              <input id="pc" className="lf-input uppercase" autoComplete="postal-code" value={form.postcode} onChange={(e) => { setForm((f) => ({ ...f, postcode: e.target.value })); basket.setPostcode(e.target.value.toUpperCase(), ""); }} placeholder="SS14 1AB" />
              {price?.location ? <p className="text-sm text-success mt-1">Delivering from {price.location.name} · {gbp(price.location.deliveryFee)} fee · {gbp(price.location.minOrder)} minimum</p> : form.postcode.length >= 5 && !loading ? <p className="text-sm text-danger mt-1">We don&apos;t deliver to that postcode. Try collection.</p> : null}
            </div>
          ) : (
            <div>
              <label className="lf-label">Collect from</label>
              <div className="space-y-2">{ctx.locations.map((l) => (
                <label key={l.key} className={`flex items-center gap-3 p-3 rounded-xl border ${(location?.key ?? ctx.locations[0]?.key) === l.key ? "border-brand" : "border-line"}`}>
                  <input type="radio" name="loc" checked={(location?.key ?? ctx.locations[0]?.key) === l.key} onChange={() => basket.setPostcode(basket.postcode, l.key)} className="accent-brand" />
                  <span><span className="font-semibold">{l.name}</span>{l.address ? <span className="block text-sm text-muted">{l.address}</span> : null}<span className="block text-xs text-muted">Ready in ~{l.prepMinutes} min</span></span>
                </label>
              ))}</div>
            </div>
          )}
          {location ? (
            <div>
              <label className="lf-label" htmlFor="when">When</label>
              {closedNow ? <p className="text-sm text-danger mb-1">{location.paused ? `Ordering is paused${location.pauseReason ? ` (${location.pauseReason})` : ""}.` : "We're closed right now."} Pick a time to pre-order.</p> : null}
              <select id="when" className="lf-input" value={when} onChange={(e) => setWhen(e.target.value)}>
                {!closedNow ? <option value="asap">As soon as possible (~{basket.fulfilment === "delivery" ? location.deliveryMinutes : location.prepMinutes} min)</option> : null}
                {location.slots.map((s) => <option key={s} value={s}>{new Intl.DateTimeFormat("en-GB", { timeZone: location.timezone, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(s))}</option>)}
              </select>
            </div>
          ) : null}
          {price?.errors.length ? <p className="text-sm text-danger">{price.errors[0]}</p> : null}
          <button className="lf-btn lf-btn-primary lf-btn-block" disabled={!location || mustSchedule || (basket.fulfilment === "delivery" && !price?.location) || !!price?.errors.length} onClick={() => setStep("details")}>Continue</button>
        </section>
      ) : null}

      {step === "details" ? (
        <form className="lf-card p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void placeOrder(cashAllowed && (e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-cash") ? "cash" : "card"); }}>
          <div><label className="lf-label" htmlFor="name">Name</label><input id="name" className="lf-input" required autoComplete="name" value={form.name} onChange={set("name")} /></div>
          <div><label className="lf-label" htmlFor="phone">Mobile number</label><input id="phone" className="lf-input" required type="tel" autoComplete="tel" inputMode="tel" placeholder="07..." value={form.phone} onChange={set("phone")} /><p className="text-xs text-muted mt-1">We text you order updates.</p></div>
          <div><label className="lf-label" htmlFor="email">Email (optional, for your receipt)</label><input id="email" className="lf-input" type="email" autoComplete="email" value={form.email} onChange={set("email")} /></div>
          {basket.fulfilment === "delivery" ? (
            <>
              <div><label className="lf-label" htmlFor="line1">Address line 1</label><input id="line1" className="lf-input" required autoComplete="address-line1" value={form.line1} onChange={set("line1")} /></div>
              <div><label className="lf-label" htmlFor="line2">Address line 2</label><input id="line2" className="lf-input" autoComplete="address-line2" value={form.line2} onChange={set("line2")} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="lf-label" htmlFor="city">Town</label><input id="city" className="lf-input" autoComplete="address-level2" value={form.city} onChange={set("city")} /></div>
                <div><label className="lf-label" htmlFor="pc2">Postcode</label><input id="pc2" className="lf-input uppercase" required autoComplete="postal-code" value={form.postcode} readOnly /></div>
              </div>
            </>
          ) : null}
          <div><label className="lf-label" htmlFor="notes">Order notes</label><input id="notes" className="lf-input" maxLength={300} placeholder="Gate code, ring the bell, etc." value={form.notes} onChange={set("notes")} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand w-4 h-4" checked={form.marketingOptIn} onChange={set("marketingOptIn")} /> Text me occasional deals (opt out any time)</label>
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <div className="flex gap-2 pt-2">
            <button type="button" className="lf-btn lf-btn-ghost" onClick={() => setStep("fulfilment")}>Back</button>
            {ctx.stripe ? <button className="lf-btn lf-btn-primary flex-1" disabled={busy}>{busy ? "…" : `Pay ${price ? gbp(price.total) : ""}`}</button> : null}
            {cashAllowed ? <button className={`lf-btn ${ctx.stripe ? "lf-btn-ghost" : "lf-btn-primary flex-1"}`} data-cash="1" disabled={busy}>{basket.fulfilment === "collection" ? "Pay cash on collection" : "Pay cash on delivery"}</button> : null}
          </div>
          {!ctx.stripe && !cashAllowed ? <p className="text-sm text-danger">Online payment is not set up yet. Please call the shop.</p> : null}
        </form>
      ) : null}

      {step === "pay" && pay && ctx.stripe ? (
        <PayStep publishableKey={ctx.stripe.publishableKey} accountId={ctx.stripe.accountId} clientSecret={pay.clientSecret} orderId={pay.orderId} total={pay.total} onBack={() => { setPay(null); setStep("details"); }} />
      ) : null}
    </div>
  );
}
