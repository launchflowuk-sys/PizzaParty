import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { MenuFilter } from "@/components/admin/MenuFilter";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { moveProduct, toggleModifier, toggleProduct, updateProductText, updateSizePrice } from "../actions";
import {
  createCategory, updateCategory, deleteCategory, moveCategory,
  createProduct, createModifierGroup, updateModifierGroup, deleteModifierGroup,
  addModifier, updateModifier, deleteModifier,
} from "../menu-actions";

export const dynamic = "force-dynamic";

const BACK = "/admin/menu";

/**
 * Menu and pricing.
 *
 * Two jobs share this screen and they are not equally common. Marking something
 * off mid-service happens nightly and has to be one click from arriving; adding
 * a pizza or renaming a section happens when the menu changes and can afford a
 * disclosure. So the nightly controls stay on the surface and everything that
 * reshapes the menu sits behind a summary the shop opens on purpose.
 *
 * Anything belonging to a single item - its sizes, which options it offers, its
 * photo - is on the item's own screen rather than repeated sixty-eight times
 * here.
 */
export default async function AdminMenu({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; e?: string }>;
}) {
  await requireScreen("menu");
  const client = await getClientRow();
  const { m, e } = await searchParams;

  const [categories, groups] = await Promise.all([
    prisma.category.findMany({
      where: { clientId: client.id },
      orderBy: { sortOrder: "asc" },
      include: { products: { orderBy: { sortOrder: "asc" }, include: { sizes: { orderBy: { sortOrder: "asc" } } } } },
    }),
    prisma.modifierGroup.findMany({ where: { clientId: client.id }, include: { modifiers: { orderBy: { sortOrder: "asc" } } } }),
  ]);

  const all = categories.flatMap((c) => c.products);
  const soldOut = all.filter((p) => p.soldOut).length;
  const hidden = all.filter((p) => !p.active).length;

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            Back office &middot; {all.length} items
            {soldOut > 0 ? <> &middot; <span className="fp-num-danger">{soldOut} sold out</span></> : null}
            {hidden > 0 ? <> &middot; <span className="fp-num-warn">{hidden} hidden</span></> : null}
            <HelpSpot title="What is the difference between sold out and hidden?" article="menu-and-pricing" anchor="hiding-vs-sold-out">
              Sold out is for tonight: the item stays on the menu with a Sold out tag where Add used to be.
              Hide takes it off the website altogether. Neither one clears itself overnight — whatever you
              switch off tonight is still off tomorrow lunchtime unless somebody puts it back.
            </HelpSpot>
          </span>
          <h1>
            Menu &amp; pricing
            <HelpSpot title="Does a change here hit both shops?" article="menu-and-pricing" anchor="sold-out">
              Yes. Prices, names, sold out and hidden are set once for the whole menu, not per shop, so every
              branch always shows the same thing. There is no way to price one shop differently here.
            </HelpSpot>
          </h1>
        </div>
      </header>

      <AdminNotice message={m} error={e} back={BACK} />

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 20px", maxWidth: "78ch" }}>
        Price and name changes save the moment you press Save and are live straight away.
        <HelpSpot title="Why has a price saved as £0.00?" article="menu-and-pricing" anchor="putting-a-price-up">
          Each size has its own box and its own Save, and it saves that size only. If what you type is not a
          number the screen does not refuse it — it saves £0.00 and the item goes out at nothing, so check the
          box shows what you expect afterwards.
        </HelpSpot>{" "}
        This menu is yours: nothing here is overwritten when the site is updated.
      </p>

      {/* ---- Add an item ---- */}
      <details className="fp-panel" data-tone="ok" style={{ marginBottom: 12 }}>
        <summary>
          <div className="fp-panelbar">+ Add an item</div>
        </summary>
        <div className="body">
          <form action={createProduct} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <input type="hidden" name="back" value={BACK} />
            <label style={{ flex: "0 1 220px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Name
              <input name="name" className="input" placeholder="Hot Honey Pepperoni" style={{ width: "100%", marginTop: 4, fontWeight: 700 }} />
            </label>
            <label style={{ flex: "0 1 180px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Section
              <select name="categoryId" className="input" style={{ display: "block", width: "100%", marginTop: 4 }}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label style={{ flex: "0 1 130px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              First size
              <input name="sizeName" className="input" placeholder="Regular" style={{ width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ flex: "0 1 110px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Price £
              <input name="price" className="input" inputMode="decimal" placeholder="0.00" style={{ width: "100%", marginTop: 4, fontWeight: 700 }} />
            </label>
            <label style={{ flex: "1 1 260px", minWidth: 0, fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Description
              <input name="description" className="input" placeholder="What is on it" style={{ width: "100%", marginTop: 4 }} />
            </label>
            <button className="btn btn-ok">Add item</button>
          </form>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "12px 0 0", maxWidth: "72ch" }}>
            It goes on live straight away, at the bottom of its section. Open it afterwards to add more
            sizes, choose which toppings it offers, and put a photo on it.
          </p>
        </div>
      </details>

      {/* ---- Sections ---- */}
      <details className="fp-panel" style={{ marginBottom: 20 }}>
        <summary>
          <div className="fp-panelbar">
            <span>Sections</span>
            <span style={{ opacity: .85 }}>{categories.length}</span>
          </div>
        </summary>
        <div className="body" style={{ padding: 0 }}>
          {categories.map((c) => (
            <div key={c.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--color-divider)" }}>
              <form action={updateCategory} style={{ display: "flex", gap: 8, flex: "1 1 420px", minWidth: 0 }}>
                <input type="hidden" name="back" value={BACK} />
                <input type="hidden" name="id" value={c.id} />
                <input name="name" defaultValue={c.name} className="input" aria-label={`${c.name} name`} style={{ flex: "0 1 180px", fontWeight: 700 }} />
                <input name="description" defaultValue={c.description} className="input" aria-label={`${c.name} description`} style={{ flex: 1, minWidth: 0 }} />
                <button className="btn btn-secondary">Save</button>
              </form>
              <span style={{ fontSize: 12, color: "var(--color-neutral-700)", fontWeight: 700, minWidth: 64 }}>
                {c.products.length} item{c.products.length === 1 ? "" : "s"}
              </span>
              <form action={moveCategory} style={{ display: "flex" }}>
                <input type="hidden" name="back" value={BACK} />
                <input type="hidden" name="id" value={c.id} />
                <button name="dir" value="up" className="btn btn-secondary" aria-label={`Move ${c.name} up`}>&uarr;</button>
                <button name="dir" value="down" className="btn btn-secondary" aria-label={`Move ${c.name} down`}>&darr;</button>
              </form>
              <form action={deleteCategory}>
                <input type="hidden" name="back" value={BACK} />
                <input type="hidden" name="id" value={c.id} />
                <button className="btn btn-secondary" aria-label={`Delete the ${c.name} section`}>Delete</button>
              </form>
            </div>
          ))}
          <form action={createCategory} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "12px 14px" }}>
            <input type="hidden" name="back" value={BACK} />
            <input name="name" className="input" placeholder="New section, e.g. Salads" aria-label="New section name" style={{ flex: "0 1 200px" }} />
            <input name="description" className="input" placeholder="Description (optional)" aria-label="New section description" style={{ flex: "1 1 240px", minWidth: 0 }} />
            <button className="btn btn-ok">Add section</button>
          </form>
        </div>
      </details>

      <MenuFilter total={all.length} />

      {categories.map((c) => {
        const out = c.products.filter((p) => p.soldOut).length;
        return (
          <details key={c.id} data-menu-group open={c.products.length <= 12} className="fp-panel" style={{ marginTop: 16 }}>
            <summary>
              <div className="fp-panelbar">
                <span>
                  {c.name}
                  {out > 0 ? <span className="tag tag-danger" style={{ marginLeft: 10 }}>{out} sold out</span> : null}
                </span>
                <span data-menu-count data-menu-count-value={c.products.length} style={{ fontWeight: 700, opacity: .85 }}>
                  {c.products.length}
                </span>
              </div>
            </summary>

            <div className="body" style={{ padding: 0 }}>
              {c.products.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-neutral-700)", padding: "14px 16px", margin: 0 }}>
                  Nothing in this section yet. Add an item at the top of the screen and pick {c.name}.
                </p>
              ) : null}

              {c.products.map((p) => (
                <div
                  key={p.id}
                  data-menu-item
                  data-search={`${p.name} ${p.description}`.toLowerCase()}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--color-divider)",
                    background: p.soldOut ? "var(--danger-bg)" : undefined,
                    boxShadow: p.soldOut ? "inset 4px 0 0 var(--danger)" : !p.active ? "inset 4px 0 0 var(--color-neutral-400)" : undefined,
                    opacity: p.active ? 1 : .62,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <form action={updateProductText} style={{ display: "flex", gap: 8, flex: "1 1 420px", minWidth: 0 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        name="name"
                        defaultValue={p.name}
                        className="input"
                        aria-label={`${p.name} name`}
                        style={{ fontWeight: 700, flex: "0 1 220px", textDecoration: p.active ? undefined : "line-through" }}
                      />
                      <input name="description" defaultValue={p.description} className="input" aria-label={`${p.name} description`} style={{ flex: 1, minWidth: 0 }} />
                      <button className="btn btn-secondary">Save</button>
                    </form>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <form action={toggleProduct}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="field" value="soldOut" />
                        <button className={p.soldOut ? "btn btn-danger" : "btn btn-secondary"}>
                          {p.soldOut ? "Sold out — put back on" : "Mark sold out"}
                        </button>
                      </form>
                      <form action={toggleProduct}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="field" value="featured" />
                        <button className={p.featured ? "btn btn-warn" : "btn btn-secondary"} title="Show on the home page">
                          {p.featured ? "★ Featured" : "☆"}
                        </button>
                      </form>
                      <form action={toggleProduct}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="field" value="active" />
                        <button className="btn btn-secondary">{p.active ? "Hide" : "Show"}</button>
                      </form>
                      <form action={moveProduct} style={{ display: "flex" }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button name="dir" value="up" className="btn btn-secondary" aria-label={`Move ${p.name} up`}>&uarr;</button>
                        <button name="dir" value="down" className="btn btn-secondary" aria-label={`Move ${p.name} down`}>&darr;</button>
                      </form>
                      <Link href={`/admin/menu/${p.id}`} className="btn btn-primary">Edit</Link>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    {p.sizes.map((s) => (
                      <form key={s.id} action={updateSizePrice} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--color-divider)", padding: "5px 8px" }}>
                        <input type="hidden" name="id" value={s.id} />
                        <span style={{ fontSize: 12, color: "var(--color-neutral-700)", minWidth: 62 }}>{s.name}</span>
                        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>£</span>
                        <input
                          name="price"
                          defaultValue={(s.price / 100).toFixed(2)}
                          className="input"
                          inputMode="decimal"
                          aria-label={`${p.name} ${s.name} price`}
                          style={{ width: 76, fontWeight: 700 }}
                        />
                        <button className="btn btn-secondary">Save</button>
                      </form>
                    ))}
                    <Link href={`/admin/menu/${p.id}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                      Sizes &amp; options &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}

      {/* ---- Option groups ---- */}
      <span className="fp-kicker" id="options" style={{ margin: "32px 0 12px", display: "block", scrollMarginTop: 24 }}>
        Options &amp; toppings
        <HelpSpot title="What does switching a topping off actually do?" article="menu-and-pricing" anchor="toppings-and-options">
          There is no confirmation and no undo besides clicking it again, and nothing switches it back on
          overnight — the group bar stays red and counts how many you have left off until somebody does.
        </HelpSpot>
      </span>
      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 16px", maxWidth: "78ch" }}>
        Click a topping to mark it off. On every product that offers it, it goes pale and cannot be
        ticked, straight away. It stays on the list rather than vanishing. To rename one, change what it
        costs, or add a new one, open <strong>Edit this group</strong> underneath it.
      </p>

      {groups.map((g) => {
        const off = g.modifiers.filter((m) => m.soldOut).length;
        return (
          <div key={g.id} className="fp-panel" data-tone={off ? "danger" : undefined} style={{ marginBottom: 12 }}>
            <header>
              <span>{g.name}</span>
              <span style={{ fontWeight: 700, opacity: .85 }}>
                choose {g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}
                {off > 0 ? ` · ${off} off` : ""}
              </span>
            </header>
            <div className="body" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {g.modifiers.map((mod) => (
                <form key={mod.id} action={toggleModifier}>
                  <input type="hidden" name="id" value={mod.id} />
                  <button
                    className={mod.soldOut ? "tag tag-danger" : "tag tag-ok"}
                    style={{ cursor: "pointer", textDecoration: mod.soldOut ? "line-through" : undefined }}
                    title={mod.soldOut ? "Off — click to put back on" : "On — click to mark off"}
                  >
                    {mod.name}{mod.price ? ` +${gbp(mod.price)}` : ""}
                  </button>
                </form>
              ))}
              {g.modifiers.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: 0 }}>
                  Nothing in this group yet.
                </p>
              ) : null}
            </div>

            <details style={{ borderTop: "1px solid var(--color-divider)" }}>
              <summary style={{ cursor: "pointer", padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                Edit this group
              </summary>
              <div style={{ padding: "0 14px 14px" }}>
                <form action={updateModifierGroup} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
                  <input type="hidden" name="back" value={BACK} />
                  <input type="hidden" name="id" value={g.id} />
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                    Group name
                    <input name="name" defaultValue={g.name} className="input" style={{ display: "block", marginTop: 4, width: 200, fontWeight: 700 }} />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                    Choose at least
                    <input name="min" defaultValue={g.minSelect} className="input" inputMode="numeric" style={{ display: "block", marginTop: 4, width: 74 }} />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                    At most
                    <input name="max" defaultValue={g.maxSelect} className="input" inputMode="numeric" style={{ display: "block", marginTop: 4, width: 74 }} />
                  </label>
                  <button className="btn btn-secondary">Save group</button>
                </form>

                {g.modifiers.map((mod) => (
                  <div key={mod.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <form action={updateModifier} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="hidden" name="back" value={BACK} />
                      <input type="hidden" name="id" value={mod.id} />
                      <input name="name" defaultValue={mod.name} className="input" aria-label={`${mod.name} name`} style={{ width: 190 }} />
                      <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>+£</span>
                      <input name="price" defaultValue={(mod.price / 100).toFixed(2)} className="input" inputMode="decimal" aria-label={`${mod.name} price`} style={{ width: 78, fontWeight: 700 }} />
                      <button className="btn btn-secondary">Save</button>
                    </form>
                    <form action={deleteModifier}>
                      <input type="hidden" name="back" value={BACK} />
                      <input type="hidden" name="id" value={mod.id} />
                      <button className="btn btn-secondary" aria-label={`Remove ${mod.name}`}>Remove</button>
                    </form>
                  </div>
                ))}

                <form action={addModifier} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                  <input type="hidden" name="back" value={BACK} />
                  <input type="hidden" name="groupId" value={g.id} />
                  <input name="name" className="input" placeholder="New option" aria-label="New option name" style={{ width: 190 }} />
                  <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>+£</span>
                  <input name="price" className="input" inputMode="decimal" placeholder="0.00" aria-label="New option price" style={{ width: 78 }} />
                  <button className="btn btn-ok">Add option</button>
                </form>

                <form action={deleteModifierGroup} style={{ marginTop: 16 }}>
                  <input type="hidden" name="back" value={BACK} />
                  <input type="hidden" name="id" value={g.id} />
                  <button className="btn btn-danger">Delete the whole {g.name} group</button>
                </form>
              </div>
            </details>
          </div>
        );
      })}

      <div className="fp-panel">
        <header><span>New option group</span></header>
        <div className="body">
          <form action={createModifierGroup} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
            <input type="hidden" name="back" value={BACK} />
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Group name
              <input name="name" className="input" placeholder="Extra toppings" style={{ display: "block", marginTop: 4, width: 220, fontWeight: 700 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Choose at least
              <input name="min" defaultValue={0} className="input" inputMode="numeric" style={{ display: "block", marginTop: 4, width: 74 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              At most
              <input name="max" defaultValue={10} className="input" inputMode="numeric" style={{ display: "block", marginTop: 4, width: 74 }} />
            </label>
            <button className="btn btn-ok">Add group</button>
          </form>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "12px 0 0", maxWidth: "72ch" }}>
            A new group is offered on nothing until you switch it on for an item — open the item and click
            the group. &ldquo;Choose at least 1&rdquo; makes it a question the customer has to answer before
            they can add the item.
          </p>
        </div>
      </div>
    </>
  );
}
