"use client";
import { AddressAutocomplete } from "@/components/checkout/AddressAutocomplete";
import type { DeliveryAddress } from "./usePosOrder";

export function DeliveryFields({ address, onChange }: { address: DeliveryAddress; onChange: (a: DeliveryAddress) => void }) {
  return (
    <div style={{ display: "grid", gap: 8, padding: "12px 12px 0" }}>
      <AddressAutocomplete
        value={address.line1}
        onType={(v) => onChange({ ...address, line1: v })}
        onPick={(a) => onChange({ line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode })}
      />
      <input className="input" style={{ minHeight: 48 }} placeholder="Flat / house (optional)" value={address.line2} onChange={(e) => onChange({ ...address, line2: e.target.value })} />
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input" style={{ minHeight: 48, flex: 2 }} placeholder="Town" value={address.city} onChange={(e) => onChange({ ...address, city: e.target.value })} />
        <input className="input" style={{ minHeight: 48, flex: 1 }} placeholder="Postcode" value={address.postcode} onChange={(e) => onChange({ ...address, postcode: e.target.value })} />
      </div>
    </div>
  );
}
