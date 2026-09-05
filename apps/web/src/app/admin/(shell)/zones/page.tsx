import { getLocations } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { updateZone, saveBand, deleteBand } from "../actions";

export const dynamic = "force-dynamic";

/** Where each shop delivers, and what it charges to get there. */
export default async function AdminZones() {
  await requireScreen("zones");
  const locations = await getLocations();

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Delivery zones</h1>
        </div>
      </header>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 24px", maxWidth: "78ch" }}>
        Postcode districts are comma separated (RM17, RM20). A letters-only entry like RM covers
        the whole area. Add a <strong>charge band</strong> when part of the patch costs more to
        reach &mdash; the district price always wins over an area price, so a band on RM20 beats a
        band on RM. Anywhere no band names is charged the shop&rsquo;s standard fee below.
      </p>

      {locations.map((l) => (
        <section key={l.id} style={{ marginBottom: 40 }}>
          <span className="fp-kicker" style={{ marginBottom: 12 }}>{l.name}</span>

          <form action={updateZone} style={{ border: "2px solid var(--color-text)", padding: 24, display: "grid", gap: 12 }}>
            <input type="hidden" name="locationId" value={l.id} />
            <div className="field">
              <label htmlFor={`prefixes-${l.id}`}>Postcode districts we deliver to</label>
              <input id={`prefixes-${l.id}`} name="prefixes" defaultValue={l.postcodePrefixes.join(", ")} className="input" style={{ textTransform: "uppercase" }} />
            </div>
            <div className="fp-fields">
              <div className="field">
                <label htmlFor={`fee-${l.id}`}>Standard delivery fee £</label>
                <input id={`fee-${l.id}`} name="deliveryFee" defaultValue={(l.deliveryFee / 100).toFixed(2)} className="input" inputMode="decimal" />
              </div>
              <div className="field">
                <label htmlFor={`min-${l.id}`}>Minimum order £</label>
                <input id={`min-${l.id}`} name="minOrder" defaultValue={(l.minOrder / 100).toFixed(2)} className="input" inputMode="decimal" />
              </div>
              <div className="field">
                <label htmlFor={`prep-${l.id}`}>Collection time (min)</label>
                <input id={`prep-${l.id}`} name="prepMinutes" defaultValue={l.prepMinutes} className="input" inputMode="numeric" />
              </div>
              <div className="field">
                <label htmlFor={`del-${l.id}`}>Delivery time (min)</label>
                <input id={`del-${l.id}`} name="deliveryMinutes" defaultValue={l.deliveryMinutes} className="input" inputMode="numeric" />
              </div>
              <div className="field">
                <label htmlFor={`addr-${l.id}`}>Address</label>
                <input id={`addr-${l.id}`} name="address" defaultValue={l.address} className="input" />
              </div>
              <div className="field">
                <label htmlFor={`phone-${l.id}`}>Phone</label>
                <input id={`phone-${l.id}`} name="phone" defaultValue={l.phone} className="input" />
              </div>
            </div>
            <button className="btn btn-primary" style={{ justifySelf: "start" }}>Save shop settings</button>
          </form>

          <div style={{ border: "2px solid var(--color-neutral-300)", borderTop: 0, padding: 24 }}>
            <span className="fp-kicker" style={{ marginBottom: 12 }}>Charge bands</span>

            {l.bands.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 16px" }}>
                No bands. Everywhere this shop delivers is charged {gbp(l.deliveryFee)}.
              </p>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: 16 }}>
                <table className="table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Band</th><th>Districts</th>
                      <th style={{ textAlign: "right" }}>Fee</th>
                      <th style={{ textAlign: "right" }}>Min order</th>
                      <th style={{ textAlign: "right" }}>Extra time</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {l.bands.map((b) => (
                      <tr key={b.id}>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <form action={saveBand} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr .7fr .8fr .8fr auto", gap: 8, alignItems: "center", padding: "8px 0" }}>
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="locationId" value={l.id} />
                            <input name="name" defaultValue={b.name} className="input" aria-label="Band name" placeholder="Area name" />
                            <input name="prefixes" defaultValue={b.prefixes.join(", ")} className="input" style={{ textTransform: "uppercase" }} aria-label="Districts" />
                            <input name="fee" defaultValue={(b.fee / 100).toFixed(2)} className="input" inputMode="decimal" aria-label="Fee" />
                            <input name="minOrder" defaultValue={(b.minOrder / 100).toFixed(2)} className="input" inputMode="decimal" aria-label="Minimum order" />
                            <input name="extraMinutes" defaultValue={b.extraMinutes} className="input" inputMode="numeric" aria-label="Extra minutes" />
                            <span style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
                              <button className="btn btn-secondary">Save</button>
                              <button className="btn btn-secondary" formAction={deleteBand}>Remove</button>
                            </span>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form action={saveBand} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr .7fr .8fr .8fr auto", gap: 8, alignItems: "end", borderTop: "2px solid var(--color-divider)", paddingTop: 16 }}>
              <input type="hidden" name="locationId" value={l.id} />
              <div className="field">
                <label htmlFor={`bn-${l.id}`}>Area name</label>
                <input id={`bn-${l.id}`} name="name" className="input" placeholder="Chafford Hundred" />
              </div>
              <div className="field">
                <label htmlFor={`bp-${l.id}`}>Districts</label>
                <input id={`bp-${l.id}`} name="prefixes" className="input" style={{ textTransform: "uppercase" }} placeholder="RM16, RM20" required />
              </div>
              <div className="field">
                <label htmlFor={`bf-${l.id}`}>Fee £</label>
                <input id={`bf-${l.id}`} name="fee" className="input" inputMode="decimal" defaultValue="0.00" />
              </div>
              <div className="field">
                <label htmlFor={`bm-${l.id}`}>Min £</label>
                <input id={`bm-${l.id}`} name="minOrder" className="input" inputMode="decimal" defaultValue="0.00" />
              </div>
              <div className="field">
                <label htmlFor={`be-${l.id}`}>Extra min</label>
                <input id={`be-${l.id}`} name="extraMinutes" className="input" inputMode="numeric" defaultValue="0" />
              </div>
              <button className="btn btn-primary">Add band</button>
            </form>
            <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "10px 0 0", lineHeight: 1.5 }}>
              Leave a band&rsquo;s minimum at £0.00 to use the shop&rsquo;s own minimum. Extra minutes are
              added to the delivery time quoted to that area.
            </p>
          </div>
        </section>
      ))}
    </>
  );
}
