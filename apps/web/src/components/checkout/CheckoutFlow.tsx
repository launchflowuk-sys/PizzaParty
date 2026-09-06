"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBasket } from "@/components/basket/store";
import { useServerPrice } from "@/components/basket/useServerPrice";
import { AddressAutocomplete } from "@/components/checkout/AddressAutocomplete";
import { gbp } from "@/lib/money";
import { PayStep } from "./PayStep";

type Ctx = {
  name: string; fulfilment: ("delivery" | "collection")[]; cashOnCollection: boolean; cashOnDelivery: boolean;
  stripe: { publishableKey: string; accountId: string | null } | null;
  locations: { key: string; name: string; address: string; deliveryFee: number; minOrder: number; prepMinutes: number; deliveryMinutes: number; open: boolean; paused: boolean; pausedUntil: string | null; pauseReason: string; nextOpen: string | null; timezone: string; slots: string[] }[];
  customer: { name: string; phone: string; email: string; addresses: { id: string; line1: string; line2: string; city: string; postcode: string }[] } | null;
};

const ROW: React.CSSProperties = { borderTop: "2px solid var(--color-divider)", padding: "24px 0", display: "grid", gridTemplateColumns: "160px 1fr", gap: 24 };
const H3: React.CSSProperties = { fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, margin: 0 };
const NOTE: React.CSSProperties = { margin: 0, fontSize: 13, color: "var(--color-neutral-700)" };

/** Checkout from `Farm Pizza.dc.html`: one page, four ruled numbered sections, with
 *  the order summary sticking alongside. The prototype draws raw card number, expiry
 *  and CVC fields - those are deliberately NOT reproduced. Taking a card number into
 *  our own DOM would put the site in PCI scope; Stripe's PaymentElement handles it. */
export function CheckoutFlow() {
  const router = useRouter();
  const basket = useBasket();
  const { data: price, loading } = useServerPrice();
  const [ctx, setCtx] = useState<Ctx | null>(null);
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
    return (
      <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Checkout</span>
        <h1 className="fp-h1">Your basket is empty</h1>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Link href="/menu" className="btn btn-primary">See the menu</Link>
        </div>
      </section>
    );
  }
  if (!ctx) return <section className="fp-wrap" style={{ padding: "40px 32px" }}><p aria-busy style={{ color: "var(--color-neutral-700)" }}>Loading checkout…</p></section>;

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
    } catch {
      setError("Network error. Please try again.");
    } finally { setBusy(false); }
  }

  const cashAllowed = basket.fulfilment === "collection" ? ctx.cashOnCollection : ctx.cashOnDelivery;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const blocked = !location || mustSchedule || (basket.fulfilment === "delivery" && !price?.location) || !!price?.errors.length;

  return (
    <section className="fp-wrap fp-split-checkout" style={{ padding: "40px 32px 64px" }}>
      <div>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Checkout</span>
        <h1 className="fp-h1" style={{ marginBottom: 16 }}>Four questions, then the oven.</h1>

        {/* The way back.
            Reaching checkout used to be a one-way door on anything without a
            browser toolbar: the sticky basket bar stands down here on purpose,
            and a phone or a tablet in an app frame has no visible Back. Somebody
            who remembers the garlic bread had to abandon the order and start
            again. It sits above the form because that is where a person looks
            when they realise, not at the bottom after four questions. */}
        <Link
          href="/menu"
          className="btn btn-secondary"
          style={{ marginBottom: 28, alignSelf: "start" }}
        >
          &larr; Add more to your order
        </Link>

        {pay && ctx.stripe ? (
          <div style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 24 }}>
            <PayStep
              publishableKey={ctx.stripe.publishableKey} accountId={ctx.stripe.accountId}
              clientSecret={pay.clientSecret} orderId={pay.orderId} total={pay.total}
              onBack={() => setPay(null)}
            />
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); const cash = !!(e.nativeEvent as SubmitEvent).submitter?.getAttribute("data-cash"); void placeOrder(cash ? "cash" : "card"); }}>
            {/* 01 How */}
            <div style={ROW}>
              <h3 style={H3}>01&nbsp;&nbsp;How</h3>
              <div style={{ display: "grid", gap: 16 }}>
                <div className="seg" role="radiogroup" aria-label="Order mode">
                  {ctx.fulfilment.map((f) => (
                    <label key={f} className="seg-opt">
                      <input type="radio" name="mode-co" checked={basket.fulfilment === f} onChange={() => basket.setFulfilment(f)} />
                      {f === "delivery" ? "Delivery" : "Collection"}
                    </label>
                  ))}
                </div>

                {basket.fulfilment === "delivery" ? (
                  <>
                    <div className="fp-fields">
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label htmlFor="line1">Address</label>
                        {/* Suggests, never traps. Somebody in a new build or an
                            annexe Google has not heard of can still type it, and
                            if the lookup is off or failing the ordinary fields
                            below still take the order. */}
                        <AddressAutocomplete
                          value={form.line1}
                          onType={(v) => setForm((f) => ({ ...f, line1: v }))}
                          onPick={(a) => {
                            setForm((f) => ({ ...f, line1: a.line1, line2: a.line2 || f.line2, city: a.city || f.city, postcode: a.postcode || f.postcode }));
                            if (a.postcode) basket.setPostcode(a.postcode.toUpperCase(), "");
                          }}
                        />
                      </div>
                      <div className="field"><label htmlFor="city">Town</label><input id="city" className="input" autoComplete="address-level2" value={form.city} onChange={set("city")} /></div>
                      <div className="field">
                        <label htmlFor="pc">Postcode</label>
                        <input id="pc" className="input" required autoComplete="postal-code" placeholder="RM17 6QD" style={{ textTransform: "uppercase" }}
                          value={form.postcode}
                          onChange={(e) => { setForm((f) => ({ ...f, postcode: e.target.value })); basket.setPostcode(e.target.value.toUpperCase(), ""); }} />
                      </div>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label htmlFor="notes">Note for the driver</label>
                        <input id="notes" className="input" maxLength={300} placeholder="Gate code, flat number, leave at the door…" value={form.notes} onChange={set("notes")} />
                      </div>
                    </div>
                    {price?.location ? (
                      <p style={NOTE}>
                        Delivering from {price.location.name}
                        {price.location.band ? <> &middot; {price.location.band}</> : null}
                        {" "}&middot; about {price.location.etaMinutes ?? location?.deliveryMinutes} min
                        {" "}&middot; {gbp(price.location.deliveryFee)} delivery, {gbp(price.location.minOrder)} minimum.
                      </p>
                    ) : form.postcode.length >= 5 && !loading ? (
                      <p style={{ ...NOTE, color: "var(--color-accent-700)" }}>We don&apos;t deliver to that postcode. Try collection.</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="loc">Collect from</label>
                      <select id="loc" className="input" value={location?.key ?? ""} onChange={(e) => basket.setPostcode(basket.postcode, e.target.value)}>
                        {ctx.locations.map((l) => <option key={l.key} value={l.key}>{l.name}{l.address ? ` · ${l.address}` : ""}</option>)}
                      </select>
                    </div>
                    {location ? <p style={NOTE}>Ready in about {location.prepMinutes} minutes.</p> : null}
                  </>
                )}
              </div>
            </div>

            {/* 02 When */}
            <div style={ROW}>
              <h3 style={H3}>02&nbsp;&nbsp;When</h3>
              <div className="field">
                <label htmlFor="when">Time</label>
                {closedNow ? (
                  <p style={{ ...NOTE, color: "var(--color-accent-700)", marginBottom: 6 }}>
                    {location?.paused ? `Ordering is paused${location.pauseReason ? ` (${location.pauseReason})` : ""}.` : "We're closed right now."} Pick a time to pre-order.
                  </p>
                ) : null}
                <select id="when" className="input" value={when} onChange={(e) => setWhen(e.target.value)}>
                  {!closedNow ? <option value="asap">As soon as possible{location ? ` (~${basket.fulfilment === "delivery" ? location.deliveryMinutes : location.prepMinutes} min)` : ""}</option> : null}
                  {location?.slots.map((s) => (
                    <option key={s} value={s}>
                      {new Intl.DateTimeFormat("en-GB", { timeZone: location.timezone, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(s))}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 03 Who */}
            <div style={ROW}>
              <h3 style={H3}>03&nbsp;&nbsp;Who</h3>
              <div className="fp-fields">
                <div className="field"><label htmlFor="name">Name</label><input id="name" className="input" required autoComplete="name" value={form.name} onChange={set("name")} /></div>
                <div className="field"><label htmlFor="phone">Mobile</label><input id="phone" className="input" required type="tel" inputMode="tel" autoComplete="tel" placeholder="07…" value={form.phone} onChange={set("phone")} /></div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="email">Email for the receipt</label>
                  <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
                </div>
                <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={form.marketingOptIn} onChange={set("marketingOptIn")} />
                  Text me occasional deals (opt out any time)
                </label>
              </div>
            </div>

            {/* 04 Pay */}
            <div style={{ ...ROW, borderBottom: "2px solid var(--color-divider)" }}>
              <h3 style={H3}>04&nbsp;&nbsp;Pay</h3>
              <div style={{ display: "grid", gap: 16 }}>
                <p style={NOTE}>
                  {ctx.stripe
                    ? "Card, Apple Pay and Google Pay are handled by Stripe on the next step — we never see your card number."
                    : "Card payments are not set up yet."}
                </p>
                {error ? <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--color-accent-700)" }}>{error}</p> : null}
                {price?.errors.length ? <p style={{ margin: 0, fontSize: 13, color: "var(--color-accent-700)" }}>{price.errors[0]}</p> : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ctx.stripe ? (
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: "space-between", padding: "12px 16px", minWidth: 220 }} disabled={busy || blocked}>
                      <span>{busy ? "Working…" : "Pay by card"}</span><span>{price ? gbp(price.total) : ""}</span>
                    </button>
                  ) : null}
                  {cashAllowed ? (
                    <button className={ctx.stripe ? "btn btn-secondary" : "btn btn-primary"} data-cash="1" disabled={busy || blocked}
                      style={ctx.stripe ? undefined : { flex: 1, justifyContent: "space-between", padding: "12px 16px" }}>
                      {basket.fulfilment === "collection" ? "Pay cash on collection" : "Pay cash on delivery"}
                    </button>
                  ) : null}
                </div>
                {!ctx.stripe && !cashAllowed ? (
                  <p style={{ ...NOTE, color: "var(--color-accent-700)" }}>Online payment is not set up yet. Please call the shop.</p>
                ) : null}
              </div>
            </div>
          </form>
        )}
      </div>

      <aside style={{ border: "2px solid var(--color-text)", padding: 24, display: "grid", gap: 10, position: "sticky", top: "var(--header-h)", fontSize: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
          <span style={{ width: 8, height: 8, background: "var(--color-accent)", flex: "none" }} />
          <span>{basket.fulfilment === "delivery" ? "Delivery" : "Collection"}{location ? ` · ${location.name}` : ""}</span>
        </div>
        {basket.lines.map((l) => (
          <div key={l.key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--color-neutral-800)" }}>{l.qty}× {l.name ?? l.product ?? l.deal}</span>
            <span>{l.lineTotal != null ? gbp(l.lineTotal) : "…"}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--color-divider)", paddingTop: 10 }}><span>Subtotal</span><span>{price ? gbp(price.subtotal) : "…"}</span></div>
        {basket.fulfilment === "delivery" ? <div style={{ display: "flex", justifyContent: "space-between" }}><span>Delivery</span><span>{price ? gbp(price.deliveryFee) : "…"}</span></div> : null}
        {price?.discount ? <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-accent-700)" }}><span>{price.promoCode || "Discount"}</span><span>&minus;{gbp(price.discount)}</span></div> : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "2px solid var(--color-divider)", paddingTop: 12, marginTop: 4 }}>
          <span style={{ fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, letterSpacing: "-.02em" }}>{price ? gbp(price.total) : "…"}</span>
        </div>
        {/* Both ways out, as buttons rather than a line of small text. On a
            phone this panel stacks under the whole form, so anything here is
            the last thing on a long page - it cannot be the only way back,
            which is why there is a link above the form as well. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          <Link href="/menu" className="btn btn-secondary" style={{ flex: "1 1 auto" }}>&larr; Add more</Link>
          <Link href="/basket" className="btn btn-secondary" style={{ flex: "1 1 auto" }}>Edit basket</Link>
        </div>
      </aside>
    </section>
  );
}
