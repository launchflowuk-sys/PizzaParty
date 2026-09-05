import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { HelpSpot } from "@/components/admin/HelpSpot";
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
          <h1>
            Deals
            <HelpSpot title="What can I actually change on this screen?" article="deals" anchor="what-this-screen-cannot-do">
              Three things per deal: the price, whether it is running, and the Most popular label. What is
              inside a deal, which sizes it allows, adding a new one or deleting one for good are all config
              changes only LaunchFlow can make.
            </HelpSpot>
          </h1>
        </div>
      </header>
      <div className="mt-4 space-y-3">
        {deals.map((d, i) => (
          <form key={d.id} action={updateDeal} className="lf-card p-4 flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={d.id} />
            <div className="flex-1 min-w-60"><p className="font-bold">{d.name}</p><p className="text-sm text-muted">{d.slots.map((s) => `${s.qty} × ${s.name}`).join(" + ")}</p></div>
            <label className="text-sm">£ <input name="price" defaultValue={(d.price / 100).toFixed(2)} className="lf-input w-24 inline-block" inputMode="decimal" /></label>
            {i === 0 ? (
              <HelpSpot title="Why has a deal price saved as £0.00?" article="deals" anchor="repricing-a-deal">
                Anything that is not a number is saved as £0.00 rather than refused, and the deal goes out
                free. Every row has its own Save, so changing three deals means pressing Save three times.
              </HelpSpot>
            ) : null}
            <label className="text-sm flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={d.active} /> Active</label>
            {i === 0 ? (
              <HelpSpot title="How do I delete a deal?" article="deals" anchor="what-this-screen-cannot-do">
                You cannot, and that is deliberate. Untick Active and press Save: it comes off the website
                straight away but keeps its price and its contents, ready for next time.
              </HelpSpot>
            ) : null}
            <label className="text-sm flex items-center gap-1"><input type="checkbox" name="featured" defaultChecked={d.featured} /> Featured on home</label>
            {i === 0 ? (
              <HelpSpot title="Does this put the deal on the home page?" article="deals" anchor="featured-on-home">
                No — the label oversells it. The home page shows the first four running deals in the order
                LaunchFlow set them up in, ticked or not. All this tick changes is one line on the website&rsquo;s
                Deals page: Most popular instead of Every day.
              </HelpSpot>
            ) : null}
            <button className="lf-btn lf-btn-ghost">Save</button>
          </form>
        ))}
      </div>
    </div>
  );
}
