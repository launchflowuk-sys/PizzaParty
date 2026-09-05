import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { createDeal, deleteDeal } from "../deal-actions";

export const dynamic = "force-dynamic";

const BACK = "/admin/deals";

/**
 * Deals.
 *
 * This screen used to be three checkboxes and a price, and told the shop that
 * building or removing a deal was something only LaunchFlow could do. That was
 * honest while config rewrote the deals on every deploy; now that the shop owns
 * its menu, it owns its deals too, and the list links through to a builder.
 */
export default async function AdminDeals({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; e?: string }>;
}) {
  await requireScreen("deals");
  const client = await getClientRow();
  const { m, e } = await searchParams;

  const deals = await prisma.deal.findMany({
    where: { clientId: client.id },
    orderBy: { sortOrder: "asc" },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });

  const live = deals.filter((d) => d.active).length;

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            Back office &middot; {deals.length} deal{deals.length === 1 ? "" : "s"}
            {live > 0 ? <> &middot; <span className="fp-num-ok">{live} running</span></> : null}
          </span>
          <h1>
            Deals
            <HelpSpot title="What can I change on this screen?" article="deals" anchor="what-this-screen-cannot-do">
              All of it. Open a deal to change its price, what goes in it, which sizes it allows and which
              days it runs — or build a new one from scratch. Nothing here is overwritten when the site is
              updated.
            </HelpSpot>
          </h1>
        </div>
      </header>

      <AdminNotice message={m} error={e} back={BACK} />

      {deals.map((d) => (
        <div key={d.id} className="fp-panel" style={{ marginBottom: 12, opacity: d.active ? 1 : .68 }}>
          <header>
            <span>
              {d.name}
              {d.featured ? <span className="tag tag-warn" style={{ marginLeft: 10 }}>Most popular</span> : null}
            </span>
            <span style={{ fontWeight: 700, opacity: .85 }}>
              {d.active ? "Running" : "Off"} &middot; {gbp(d.price)}
            </span>
          </header>
          <div className="body" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: 0, maxWidth: "62ch" }}>
              {d.slots.length === 0
                ? "Nothing in it yet — it cannot be switched on until something is."
                : d.slots.map((s) => `${s.qty} × ${s.name}`).join(" + ")}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href={`/admin/deals/${d.id}`} className="btn btn-primary">Edit</Link>
              <form action={deleteDeal}>
                <input type="hidden" name="back" value={BACK} />
                <input type="hidden" name="id" value={d.id} />
                <button className="btn btn-secondary">Delete</button>
              </form>
            </div>
          </div>
        </div>
      ))}

      {deals.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--color-neutral-700)", margin: "0 0 20px" }}>
          No deals yet. Build the first one below.
        </p>
      ) : null}

      <div className="fp-panel" style={{ marginTop: 20 }}>
        <header><span>New deal</span></header>
        <div className="body">
          <form action={createDeal} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <input type="hidden" name="back" value={BACK} />
            <label style={{ flex: "0 1 240px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Name
              <input name="name" className="input" placeholder="Family Feast" style={{ width: "100%", marginTop: 4, fontWeight: 700 }} />
            </label>
            <label style={{ flex: "0 1 120px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Price £
              <input name="price" className="input" inputMode="decimal" placeholder="0.00" style={{ width: "100%", marginTop: 4, fontWeight: 700 }} />
            </label>
            <label style={{ flex: "1 1 280px", minWidth: 0, fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Description
              <input name="description" className="input" placeholder="2 large pizzas, sides and a drink" style={{ width: "100%", marginTop: 4 }} />
            </label>
            <button className="btn btn-ok">Create deal</button>
          </form>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "12px 0 0", maxWidth: "72ch" }}>
            It starts switched off so nobody can buy an empty deal. You will be taken straight to it to
            say what goes in.
          </p>
        </div>
      </div>
    </>
  );
}
