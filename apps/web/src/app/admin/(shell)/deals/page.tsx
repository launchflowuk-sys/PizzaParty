import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { updateDeal } from "../actions";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminDeals() {
  await requireScreen("deals");
  const client = await getClientRow();
  const deals = await prisma.deal.findMany({ where: { clientId: client.id }, orderBy: { sortOrder: "asc" }, include: { slots: { orderBy: { sortOrder: "asc" } } } });
  return (
    <div>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Deals</h1>
        </div>
      </header>
      <div className="mt-4 space-y-3">
        {deals.map((d) => (
          <form key={d.id} action={updateDeal} className="lf-card p-4 flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={d.id} />
            <div className="flex-1 min-w-60"><p className="font-bold">{d.name}</p><p className="text-sm text-muted">{d.slots.map((s) => `${s.qty} × ${s.name}`).join(" + ")}</p></div>
            <label className="text-sm">£ <input name="price" defaultValue={(d.price / 100).toFixed(2)} className="lf-input w-24 inline-block" inputMode="decimal" /></label>
            <label className="text-sm flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={d.active} /> Active</label>
            <label className="text-sm flex items-center gap-1"><input type="checkbox" name="featured" defaultChecked={d.featured} /> Featured on home</label>
            <button className="lf-btn lf-btn-ghost">Save</button>
          </form>
        ))}
      </div>
    </div>
  );
}
