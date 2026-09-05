import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { requireScreen } from "@/lib/session";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { updateDeal, deleteDeal, saveSlot, deleteSlot, saveSupplements } from "../../deal-actions";

export const dynamic = "force-dynamic";

const DAYS = [
  { n: 1, label: "Mon" }, { n: 2, label: "Tue" }, { n: 3, label: "Wed" }, { n: 4, label: "Thu" },
  { n: 5, label: "Fri" }, { n: 6, label: "Sat" }, { n: 0, label: "Sun" },
];

type SlotShape = {
  id?: string;
  supplements?: { productSlug: string; extra: number }[];
  name: string;
  qty: number;
  categorySlugs: string[];
  productSlugs: string[];
  sizeKeys: string[];
  extraPerModifier: boolean;
};

/**
 * One deal, and what goes in it.
 *
 * A slot is a line of the deal - "2 x Large pizza" - and what fills it is either
 * anything from a section, or one of a named handful of items. Sections are the
 * usual answer and are ticked; the exact-items list is there for a deal built
 * around three specific pizzas, and is a multiple-choice box because there are
 * sixty-eight items and nobody wants sixty-eight checkboxes per line.
 */
export default async function EditDeal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; e?: string }>;
}) {
  await requireScreen("deals");
  const client = await getClientRow();
  const { id } = await params;
  const { m, e } = await searchParams;

  const deal = await prisma.deal.findFirst({
    where: { id, clientId: client.id },
    include: { slots: { orderBy: { sortOrder: "asc" }, include: { supplements: true } } },
  });
  if (!deal) notFound();

  const categories = await prisma.category.findMany({
    where: { clientId: client.id },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, products: { orderBy: { name: "asc" }, select: { slug: true, name: true, sizes: { select: { key: true, name: true } } } } },
  });

  // Every distinct size across the menu, so a slot can be limited to "large"
  // without the shop having to know the internal name for it.
  const sizes = new Map<string, string>();
  for (const c of categories) for (const p of c.products) for (const s of p.sizes) if (!sizes.has(s.key)) sizes.set(s.key, s.name);

  const back = `/admin/deals/${deal.id}`;

  const slotForm = (slot: SlotShape, index: number | null) => (
    <form action={saveSlot} style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-divider)" }}>
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="dealId" value={deal.id} />
      {slot.id ? <input type="hidden" name="id" value={slot.id} /> : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
          How many
          <input name="qty" defaultValue={slot.qty} className="input" inputMode="numeric" style={{ display: "block", marginTop: 4, width: 70, fontWeight: 700 }} />
        </label>
        <label style={{ flex: "0 1 240px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
          Called
          <input name="name" defaultValue={slot.name} className="input" placeholder="Large pizza" style={{ display: "block", width: "100%", marginTop: 4, fontWeight: 700 }} />
        </label>
        <button className="btn btn-primary">{slot.id ? "Save line" : "Add line"}</button>
        {slot.id ? (
          <button formAction={deleteSlot} name="id" value={slot.id} className="btn btn-secondary">Remove line</button>
        ) : null}
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
        <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)", padding: 0, marginBottom: 6 }}>
          Anything from these sections
        </legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {categories.map((c) => (
            <label key={c.slug} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" name="categories" value={c.slug} defaultChecked={slot.categorySlugs.includes(c.slug)} />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        <label style={{ flex: "1 1 280px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
          Or only these exact items
          <select name="products" multiple defaultValue={slot.productSlugs} className="input" style={{ display: "block", width: "100%", marginTop: 4, height: 120 }}>
            {categories.map((c) => (
              <optgroup key={c.slug} label={c.name}>
                {c.products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>

        <fieldset style={{ flex: "0 1 300px", border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)", padding: 0, marginBottom: 6 }}>
            Only these sizes
          </legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[...sizes].map(([key, name]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" name="sizes" value={key} defaultChecked={slot.sizeKeys.includes(key)} />
                {name}
              </label>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "8px 0 0" }}>
            Tick none to allow any size.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 10 }}>
            <input type="checkbox" name="extraPerModifier" defaultChecked={slot.extraPerModifier} />
            Charge for extra toppings on top
          </label>
        </fieldset>
      </div>

      {index === 0 ? (
        <HelpSpot title="Sections or exact items — which should I use?" article="deals" anchor="what-this-screen-cannot-do">
          Sections are the usual answer: tick Pizzas and the line accepts any pizza, including one you add
          next month. Use the exact-items box only when the deal is built around specific items — anything
          you add later will not be in it until you come back and tick it.
        </HelpSpot>
      ) : null}
    </form>
  );

  /**
   * What the dear items cost extra on this line.
   *
   * Only the items this line actually accepts are listed, because a supplement
   * on something the line will never offer is noise. Blank or zero means no
   * supplement, so clearing the boxes clears the lot.
   */
  const supplementForm = (slot: typeof deal.slots[number]) => {
    const allowed = categories
      .flatMap((c) => c.products.map((p) => ({ p, c })))
      .filter(({ p, c }) =>
        (slot.productSlugs.length ? slot.productSlugs.includes(p.slug) : true) &&
        (slot.categorySlugs.length ? slot.categorySlugs.includes(c.slug) : true));
    if (allowed.length === 0) return null;
    const current = new Map(slot.supplements.map((x) => [x.productSlug, x.extra]));

    return (
      <details style={{ padding: "0 16px 14px" }}>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
          Charge extra for the dear ones on &ldquo;{slot.name}&rdquo;
          {slot.supplements.length ? ` (${slot.supplements.length} set)` : ""}
        </summary>
        <form action={saveSupplements} style={{ marginTop: 10 }}>
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="slotId" value={slot.id} />
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 10px", maxWidth: "72ch" }}>
            The deal price covers any of these. Anything you put a figure against costs that much on top —
            which is how &ldquo;any 10&Prime; pizza&rdquo; stays on the poster without the Meat Machine
            costing you money every time somebody picks it. Leave a box empty for no supplement.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
            {allowed.map(({ p }) => (
              <label key={p.slug} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="hidden" name="slug" value={p.slug} />
                <span style={{ flex: 1, minWidth: 0 }}>{p.name}</span>
                <span style={{ color: "var(--color-neutral-700)" }}>+£</span>
                <input
                  name="extra" className="input" inputMode="decimal"
                  defaultValue={current.get(p.slug) ? (current.get(p.slug)! / 100).toFixed(2) : ""}
                  placeholder="0.00" aria-label={`Supplement for ${p.name}`}
                  style={{ width: 74 }}
                />
              </label>
            ))}
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 10 }}>Save supplements</button>
        </form>
      </details>
    );
  };

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            <Link href="/admin/deals" style={{ color: "inherit" }}>Deals</Link>
            {" "}&middot; {deal.active ? <span className="fp-num-ok">Running</span> : "Off"}
          </span>
          <h1>{deal.name}</h1>
        </div>
      </header>

      <AdminNotice message={m} error={e} back={back} />

      <div className="fp-panel">
        <header><span>Price, name and when it runs</span></header>
        <div className="body">
          <form action={updateDeal}>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={deal.id} />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
              <label style={{ flex: "0 1 240px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                Name
                <input name="name" defaultValue={deal.name} className="input" style={{ display: "block", width: "100%", marginTop: 4, fontWeight: 700 }} />
              </label>
              <label style={{ flex: "0 1 120px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                Price £
                <input name="price" defaultValue={(deal.price / 100).toFixed(2)} className="input" inputMode="decimal" style={{ display: "block", width: "100%", marginTop: 4, fontWeight: 700 }} />
                <HelpSpot title="Why has the price saved as £0.00?" article="deals" anchor="repricing-a-deal">
                  Anything that is not a number saves as £0.00 rather than being refused, and the deal goes
                  out free. Check the box shows what you expect after saving.
                </HelpSpot>
              </label>
              <label style={{ flex: "1 1 300px", minWidth: 0, fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                Description
                <input name="description" defaultValue={deal.description} className="input" style={{ display: "block", width: "100%", marginTop: 4 }} />
              </label>
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
              <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)", padding: 0, marginBottom: 6 }}>
                Days it runs
              </legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {DAYS.map((d) => (
                  <label key={d.n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" name="days" value={d.n} defaultChecked={deal.daysOfWeek.includes(d.n)} />
                    {d.label}
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "8px 0 0" }}>Tick none for every day.</p>
            </fieldset>

            <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
              <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)", padding: 0, marginBottom: 6 }}>
                Available for
              </legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                {["delivery", "collection"].map((f) => (
                  <label key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, textTransform: "capitalize" }}>
                    <input type="checkbox" name="fulfilment" value={f} defaultChecked={deal.fulfilment.includes(f)} />
                    {f}
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "8px 0 0" }}>Tick none for both.</p>
            </fieldset>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" name="active" defaultChecked={deal.active} />
                Running
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                <input type="checkbox" name="featured" defaultChecked={deal.featured} />
                Label it Most popular
                <HelpSpot title="Does this put the deal on the home page?" article="deals" anchor="featured-on-home">
                  No. The home page shows the first four running deals in the order they are listed, ticked
                  or not. All this changes is one line on the Deals page: Most popular instead of Every day.
                </HelpSpot>
              </label>
              <button className="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>

      <div className="fp-panel" style={{ marginTop: 16 }}>
        <header>
          <span>What is in it</span>
          <span style={{ fontWeight: 700, opacity: .85 }}>{deal.slots.length} line{deal.slots.length === 1 ? "" : "s"}</span>
        </header>
        <div className="body" style={{ padding: 0 }}>
          {deal.slots.map((s, i) => (
            <div key={s.id}>
              {slotForm(s, i)}
              {supplementForm(s)}
            </div>
          ))}
          <div style={{ background: "var(--ok-bg)" }}>
            {slotForm({ name: "", qty: 1, categorySlugs: [], productSlugs: [], sizeKeys: [], extraPerModifier: true }, null)}
          </div>
        </div>
      </div>

      <div className="fp-panel" data-tone="danger" style={{ marginTop: 24 }}>
        <header><span>Delete this deal</span></header>
        <div className="body" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: 0, maxWidth: "62ch" }}>
            Orders that already used it keep their own copy of what was sold and what it cost. If you only
            want it off for now, untick Running above instead — that keeps the price and the contents.
          </p>
          <form action={deleteDeal}>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={deal.id} />
            <button className="btn btn-danger">Delete {deal.name}</button>
          </form>
        </div>
      </div>
    </>
  );
}
