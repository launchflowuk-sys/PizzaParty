import { getLocations } from "@/lib/menu";
import { updateZone } from "../actions";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminZones() {
  await requireScreen("zones");
  const locations = await getLocations();
  return (
    <div>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Delivery zones</h1>
        </div>
      </header>
      <p className="text-sm text-muted mt-1">Postcode districts, comma separated (e.g. SS13, SS14). A letters-only entry like RM covers the whole area.</p>
      {locations.map((l) => (
        <form key={l.id} action={updateZone} className="lf-card p-4 mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="locationId" value={l.id} />
          <h2 className="font-bold text-lg sm:col-span-2">{l.name}</h2>
          <label className="text-sm sm:col-span-2">Postcode districts<input name="prefixes" defaultValue={l.postcodePrefixes.join(", ")} className="lf-input uppercase mt-1" /></label>
          <label className="text-sm">Delivery fee £<input name="deliveryFee" defaultValue={(l.deliveryFee / 100).toFixed(2)} className="lf-input mt-1" inputMode="decimal" /></label>
          <label className="text-sm">Minimum order £<input name="minOrder" defaultValue={(l.minOrder / 100).toFixed(2)} className="lf-input mt-1" inputMode="decimal" /></label>
          <label className="text-sm">Collection time (min)<input name="prepMinutes" defaultValue={l.prepMinutes} className="lf-input mt-1" inputMode="numeric" /></label>
          <label className="text-sm">Delivery time (min)<input name="deliveryMinutes" defaultValue={l.deliveryMinutes} className="lf-input mt-1" inputMode="numeric" /></label>
          <label className="text-sm">Address<input name="address" defaultValue={l.address} className="lf-input mt-1" /></label>
          <label className="text-sm">Phone<input name="phone" defaultValue={l.phone} className="lf-input mt-1" /></label>
          <div className="sm:col-span-2"><button className="lf-btn lf-btn-primary">Save</button></div>
        </form>
      ))}
    </div>
  );
}
