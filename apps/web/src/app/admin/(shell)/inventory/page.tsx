import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { requireScreen } from "@/lib/session";
import {
  createStockItem, updateStockItem, deleteStockItem,
  countStock, receiveDelivery, toggleOnOrder, reorderBelowPar,
} from "../stock-actions";

export const dynamic = "force-dynamic";

const BACK = "/admin/inventory";

/**
 * The stock cupboard.
 *
 * Grouped by supplier, because that is how ordering actually happens - you ring
 * the butcher about the meat and the wholesaler about the cola, and a single
 * alphabetical list makes you pick that apart in your head every time.
 *
 * Two things are done here nightly and get to stay on the surface: writing down
 * what is on the shelf, and booking in what arrived. Renaming a line or changing
 * its par level happens when the menu changes, so it sits behind a disclosure.
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; e?: string }>;
}) {
  await requireScreen("inventory");
  const client = await getClientRow();
  const { m, e } = await searchParams;

  const [items, locations] = await Promise.all([
    prisma.stockItem.findMany({ where: { clientId: client.id }, orderBy: { sortOrder: "asc" } }),
    prisma.location.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" }, select: { key: true, name: true } }),
  ]);

  const out = items.filter((i) => i.onHand <= 0);
  const low = items.filter((i) => i.onHand > 0 && i.onHand < i.par);
  const onOrder = items.filter((i) => i.onOrder);

  const stats: [string, string, boolean][] = [
    [String(out.length), "Out of stock", true],
    [String(low.length), "Below par", false],
    [String(onOrder.length), "On order", false],
    [items.length ? `${Math.round((items.filter((i) => i.onHand >= i.par).length / items.length) * 100)}%` : "—", "At or above par", false],
  ];

  // Supplier first, then the order the shop put them in. An unnamed supplier
  // collects at the end rather than under a blank heading.
  const bySupplier = new Map<string, typeof items>();
  for (const i of items) {
    const key = i.supplier || "";
    const bucket = bySupplier.get(key);
    if (bucket) bucket.push(i);
    else bySupplier.set(key, [i]);
  }
  const groups = [...bySupplier].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));

  const locationName = (key: string) => locations.find((l) => l.key === key)?.name ?? "";

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            Back office &middot; {items.length} line{items.length === 1 ? "" : "s"}
            {out.length > 0 ? <> &middot; <span className="fp-num-danger">{out.length} out</span></> : null}
          </span>
          <h1>
            Inventory
            <HelpSpot title="Does anything here stop customers ordering?" article="inventory" anchor="use-sold-out-instead">
              No. Every line could read Out and the website would carry on selling all night. To actually stop
              something being sold, find it on Menu &amp; pricing and press Mark sold out.
            </HelpSpot>
          </h1>
        </div>
        <form action={reorderBelowPar}>
          <button className="btn btn-primary" disabled={low.length + out.length === 0}>
            Reorder everything below par
          </button>
          <HelpSpot title="Does Reorder send anything to the supplier?" article="inventory" anchor="reorder-does-not-order">
            No — no email, no text, no order form. It only flags the line as On order so the next person on
            shift knows the ringing has been done. Press it again to clear the flag.
          </HelpSpot>
        </form>
      </header>

      <AdminNotice message={m} error={e} back={BACK} />

      <div className="fp-stats4" style={{ marginBottom: 20 }}>
        {stats.map(([n, l, accent]) => (
          <div key={l} className="fp-statcell">
            <span className="l">{l}</span>
            <span className="n" style={accent ? undefined : { color: "var(--color-text)" }}>{n}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 16px", maxWidth: "80ch" }}>
        <strong>Count</strong> is what is on the shelf — type what you can see and press it.
        <strong> Booked in</strong> adds a delivery to what is already there; leave the box empty and it assumes
        the full order arrived.
        <HelpSpot title="Does this count down as I sell?" article="inventory" anchor="what-this-screen-is">
          No, and deliberately. Nothing is deducted when an order goes out — a pizza does not know how much
          mozzarella is on it. This is a written cupboard sheet: the numbers move when somebody says they moved.
          That is honest, and a figure everybody knows is wrong would be worse than none.
        </HelpSpot>
      </p>

      {items.length === 0 ? (
        <p style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>
          Nothing on the list yet. Add the first line at the bottom of this screen.
        </p>
      ) : null}

      {groups.map(([supplier, rows]) => {
        const belowPar = rows.filter((i) => i.onHand < i.par).length;
        return (
          <div key={supplier || "none"} className="fp-panel" data-tone={belowPar ? "warn" : undefined} style={{ marginBottom: 16 }}>
            <header>
              <span>{supplier || "No supplier set"}</span>
              <span style={{ fontWeight: 700, opacity: .85 }}>
                {rows.length} line{rows.length === 1 ? "" : "s"}
                {belowPar > 0 ? ` · ${belowPar} below par` : ""}
              </span>
            </header>

            <div className="body" style={{ padding: 0 }}>
              {rows.map((i) => {
                const pct = i.par > 0 ? Math.min(100, Math.round((i.onHand / i.par) * 100)) : 100;
                const isOut = i.onHand <= 0;
                const isLow = !isOut && i.onHand < i.par;
                const bar = isOut ? "var(--danger)" : isLow ? "var(--warn)" : "var(--ok)";
                return (
                  <div
                    key={i.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--color-divider)",
                      background: isOut ? "var(--danger-bg)" : undefined,
                      boxShadow: isOut ? "inset 4px 0 0 var(--danger)" : isLow ? "inset 4px 0 0 var(--warn)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span style={{ fontWeight: 700, flex: "0 1 190px" }}>
                        {i.name}
                        {i.locationId ? (
                          <span className="tag tag-neutral" style={{ marginLeft: 8 }}>{locationName(i.locationId) || i.locationId}</span>
                        ) : null}
                      </span>

                      <div style={{ flex: "0 0 120px" }}>
                        <div style={{ width: 120, height: 10, background: "var(--color-surface)", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: bar, width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>
                          {i.onHand}{i.unit} of {i.par}{i.unit}
                        </span>
                      </div>

                      <form action={countStock} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="hidden" name="id" value={i.id} />
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-neutral-700)" }}>Count</label>
                        <input name="onHand" defaultValue={i.onHand} className="input" inputMode="decimal" aria-label={`${i.name} on hand`} style={{ width: 74, fontWeight: 700 }} />
                        <button className="btn btn-secondary">Set</button>
                      </form>

                      <form action={receiveDelivery} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="hidden" name="id" value={i.id} />
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-neutral-700)" }}>Arrived</label>
                        <input name="qty" className="input" inputMode="decimal" placeholder={`${Math.max(0, i.par - i.onHand)}`} aria-label={`${i.name} delivery quantity`} style={{ width: 74 }} />
                        <button className="btn btn-ok">Book in</button>
                      </form>

                      <form action={toggleOnOrder}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className={i.onOrder ? "btn btn-warn" : "btn btn-secondary"}>
                          {i.onOrder ? "On order — clear" : "Reorder"}
                        </button>
                      </form>

                      <span className={isOut ? "tag tag-danger" : isLow ? "tag tag-warn" : "tag tag-ok"}>
                        {isOut ? "Out" : isLow ? "Below par" : "In stock"}
                      </span>
                    </div>

                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                        Edit this line
                      </summary>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginTop: 10 }}>
                        <form action={updateStockItem} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                          <input type="hidden" name="id" value={i.id} />
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                            Name
                            <input name="name" defaultValue={i.name} className="input" style={{ display: "block", marginTop: 3, width: 180, fontWeight: 700 }} />
                          </label>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                            Unit
                            <input name="unit" defaultValue={i.unit} className="input" style={{ display: "block", marginTop: 3, width: 70 }} />
                          </label>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                            Par
                            <input name="par" defaultValue={i.par} className="input" inputMode="decimal" style={{ display: "block", marginTop: 3, width: 74 }} />
                          </label>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                            Supplier
                            <input name="supplier" defaultValue={i.supplier} className="input" style={{ display: "block", marginTop: 3, width: 170 }} />
                          </label>
                          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                            Shop
                            <select name="locationId" defaultValue={i.locationId} className="input" style={{ display: "block", marginTop: 3, width: 150 }}>
                              <option value="">Both shops</option>
                              {locations.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
                            </select>
                          </label>
                          <button className="btn btn-secondary">Save</button>
                        </form>
                        <form action={deleteStockItem}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className="btn btn-secondary">Remove</button>
                        </form>
                      </div>
                    </details>
                  </div>
                );
              })}

              {supplier ? (
                <form action={reorderBelowPar} style={{ padding: "12px 16px" }}>
                  <input type="hidden" name="supplier" value={supplier} />
                  <button className="btn btn-secondary" disabled={belowPar === 0}>
                    Reorder everything below par from {supplier}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        );
      })}

      <div className="fp-panel">
        <header><span>Add a line</span></header>
        <div className="body">
          <form action={createStockItem} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Ingredient
              <input name="name" className="input" placeholder="Mozzarella" style={{ display: "block", marginTop: 4, width: 200, fontWeight: 700 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Unit
              <input name="unit" className="input" placeholder="kg" style={{ display: "block", marginTop: 4, width: 74 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              On hand
              <input name="onHand" className="input" inputMode="decimal" placeholder="0" style={{ display: "block", marginTop: 4, width: 84 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Par
              <HelpSpot title="What is par?" article="inventory" anchor="what-this-screen-is">
                What a busy night needs. Anything under it shows as Below par and gets picked up by the reorder
                button — so set it to the amount you would be uncomfortable dropping below, not the amount you
                normally hold.
              </HelpSpot>
              <input name="par" className="input" inputMode="decimal" placeholder="0" style={{ display: "block", marginTop: 4, width: 84 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Supplier
              <input name="supplier" className="input" placeholder="Who you ring" style={{ display: "block", marginTop: 4, width: 180 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Shop
              <select name="locationId" className="input" style={{ display: "block", marginTop: 4, width: 150 }}>
                <option value="">Both shops</option>
                {locations.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
              </select>
            </label>
            <button className="btn btn-ok">Add line</button>
          </form>
        </div>
      </div>
    </>
  );
}
