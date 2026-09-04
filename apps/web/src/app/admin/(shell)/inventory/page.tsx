import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { reorderStock, reorderAllBelowPar } from "../actions";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Inventory from `Farm Pizza Admin.dc.html`: four ruled counters over a themed
 *  table with a level bar per line. Par is what a busy night needs. */
export default async function InventoryPage() {
  await requireScreen("inventory");
  const client = await getClientRow();
  const items = await prisma.stockItem.findMany({ where: { clientId: client.id }, orderBy: { sortOrder: "asc" } });

  const out = items.filter((i) => i.onHand <= 0);
  const low = items.filter((i) => i.onHand > 0 && i.onHand < i.par);
  const onOrder = items.filter((i) => i.onOrder);

  const stats: [string, string, boolean][] = [
    [String(out.length), "Out of stock", true],
    [String(low.length), "Below par", false],
    [String(onOrder.length), "On order", false],
    [items.length ? `${Math.round((items.filter((i) => i.onHand >= i.par).length / items.length) * 100)}%` : "—", "At or above par", false],
  ];

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Inventory</h1>
        </div>
        <form action={reorderAllBelowPar}>
          <button className="btn btn-primary" disabled={low.length + out.length === 0}>
            Reorder everything below par
          </button>
        </form>
      </header>

      <div className="fp-stats4" style={{ marginBottom: 24 }}>
        {stats.map(([n, l, accent]) => (
          <div key={l} className="fp-statcell">
            <span className="l">{l}</span>
            <span className="n" style={accent ? undefined : { color: "var(--color-text)" }}>{n}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 12px" }}>
        Par is what a busy night needs. Reordering marks the line; it does not yet message the supplier.
      </p>

      {items.length === 0 ? (
        <p style={{ color: "var(--color-neutral-600)", fontSize: 14 }}>
          No stock lines yet. Add them to <code>config/{client.slug}/ops.json</code> and re-seed.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Ingredient</th><th>On hand</th><th>Par</th><th>Level</th>
                <th>Supplier</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const pct = i.par > 0 ? Math.min(100, Math.round((i.onHand / i.par) * 100)) : 100;
                const isOut = i.onHand <= 0;
                const isLow = !isOut && i.onHand < i.par;
                const bar = isOut ? "var(--color-accent)" : isLow ? "var(--color-accent-400)" : "var(--color-text)";
                return (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.name}</td>
                    <td>{i.onHand} {i.unit}</td>
                    <td className="text-muted">{i.par} {i.unit}</td>
                    <td>
                      <div style={{ width: 120, height: 10, background: "var(--color-surface)" }}>
                        <div style={{ height: "100%", background: bar, width: `${pct}%` }} />
                      </div>
                    </td>
                    <td>{i.supplier || "—"}</td>
                    <td>
                      <span className={isOut ? "tag tag-accent" : isLow ? "tag tag-outline" : "tag tag-neutral"}>
                        {isOut ? "Out" : isLow ? "Below par" : "In stock"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <form action={reorderStock}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="btn btn-secondary" disabled={i.onOrder}>
                          {i.onOrder ? "On order" : "Reorder"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
