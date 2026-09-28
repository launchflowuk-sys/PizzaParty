"use client";
import { useEffect, useState } from "react";
import { gbp } from "@/lib/money";
import type { PosCustomer } from "@/lib/pos-types";
import type { PosOrderState } from "./usePosOrder";
import type { Fulfilment } from "@/lib/basket-types";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

/** Phone mode: dial a number, find (or start) the customer, then choose
 *  collection or delivery to drop into the normal till view. */
export function CustomerPanel({ order, onContinue }: { order: PosOrderState; onContinue: (fulfilment: Fulfilment) => void }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [checked, setChecked] = useState(false);
  const [newName, setNewName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (phone.replace(/\D/g, "").length < 10) { setCustomer(null); setChecked(false); return; }
    const ctrl = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/pos/customers?phone=${encodeURIComponent(phone)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { customer: PosCustomer | null }) => { setCustomer(d.customer); setNotes(d.customer?.staffNotes ?? ""); setChecked(true); })
      .catch(() => { if (!ctrl.signal.aborted) setError("Could not look up that number."); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [phone]);

  function key(k: string) {
    if (k === "clear") return setPhone("");
    if (k === "back") return setPhone((p) => p.slice(0, -1));
    setPhone((p) => (p.length >= 15 ? p : p + k));
  }

  async function saveNotes() {
    if (!customer) return;
    await fetch(`/api/pos/customers/${customer.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ staffNotes: notes }) }).catch(() => {});
  }

  function proceed(fulfilment: Fulfilment) {
    order.setCustomer(customer);
    order.setWalkInName(customer ? customer.name : newName);
    onContinue(fulfilment);
  }

  const canProceed = customer ? true : newName.trim().length > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, maxWidth: 800 }}>
      <div>
        <input className="input pos-bignum" style={{ minHeight: 60, fontSize: 24, textAlign: "center", marginBottom: 10 }} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ""))} placeholder="Phone number" inputMode="tel" />
        <div className="pos-keypad">
          {KEYS.map((k) => (
            <button key={k} type="button" className="pos-key" onClick={() => key(k)}>{k === "back" ? "⌫" : k === "clear" ? "C" : k}</button>
          ))}
        </div>
      </div>

      <div>
        {loading ? <p>Looking up…</p> : null}
        {error ? <p className="fp-error">{error}</p> : null}

        {checked && !customer ? (
          <div>
            <p>New customer — no order history on this number.</p>
            <input className="input" style={{ minHeight: 52 }} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
        ) : null}

        {customer ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20 }}>{customer.name}</span>
              <span>{customer.ordersCount} orders · {gbp(customer.totalSpent)} spent</span>
            </div>
            {customer.blocked ? <p className="fp-error" style={{ fontWeight: 700 }}>BLOCKED — take this order with care.</p> : null}

            <label className="field">
              <span>Staff notes / allergy</span>
              <textarea className="input" style={{ minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} />
            </label>

            {customer.addresses.length ? (
              <div>
                <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>Saved addresses</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {customer.addresses.map((a) => (
                    <button key={a.id} type="button" className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => order.setAddress({ line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode })}>
                      {a.line1}, {a.postcode}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {customer.lastOrders.length ? (
              <div>
                <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>Last orders</span>
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  {customer.lastOrders.map((o) => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", padding: "8px 12px" }}>
                      <span>#{o.number} · {o.summary} · {gbp(o.total)}</span>
                      <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => order.loadLines(o.lines)}>Repeat</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button type="button" className="btn btn-primary" style={{ minHeight: 60, flex: 1 }} disabled={!canProceed} onClick={() => proceed("collection")}>Collection</button>
          <button type="button" className="btn btn-primary" style={{ minHeight: 60, flex: 1 }} disabled={!canProceed} onClick={() => proceed("delivery")}>Delivery</button>
        </div>
      </div>
    </div>
  );
}
