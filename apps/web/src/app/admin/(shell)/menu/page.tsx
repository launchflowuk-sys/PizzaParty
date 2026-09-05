import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { MenuFilter } from "@/components/admin/MenuFilter";
import { moveProduct, toggleModifier, toggleProduct, updateProductText, updateSizePrice } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Menu and pricing.
 *
 * Sixty-eight products used to sit in one undifferentiated list, which made the
 * single most common job on the screen - marking something sold out mid-service
 * - a scrolling exercise. Now: a filter that responds on the keystroke,
 * categories that collapse, and state you can see from a distance. Sold out is
 * red and says so on the row; hidden items are struck through; featured carries
 * a star. Colour is load-bearing here, not decoration.
 */
export default async function AdminMenu() {
  await requireScreen("menu");
  const client = await getClientRow();

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

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 20px", maxWidth: "78ch" }}>
        Price and name changes save the moment you press Save and are live straight away.
        <HelpSpot title="Why has a price saved as £0.00?" article="menu-and-pricing" anchor="putting-a-price-up">
          Each size has its own box and its own Save, and it saves that size only. If what you type is not a
          number the screen does not refuse it — it saves £0.00 and the item goes out at nothing, so check the
          box shows what you expect afterwards.
        </HelpSpot>{" "}
        Adding items, categories or new option groups is a config change in{" "}
        <code>config/{client.slug}/menu.json</code> followed by a re-seed.
      </p>

      <MenuFilter total={all.length} />

      {categories.map((c) => {
        const out = c.products.filter((p) => p.soldOut).length;
        return (
          <details key={c.id} data-menu-group open={c.products.length <= 12} className="fp-panel" style={{ marginTop: 16 }}>
            <summary style={{ listStyle: "none", cursor: "pointer" }}>
              <div style={{ background: "var(--color-text)", color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase" }}>
                  {c.name}
                  {out > 0 ? <span className="tag tag-danger" style={{ marginLeft: 10 }}>{out} sold out</span> : null}
                </span>
                <span data-menu-count data-menu-count-value={c.products.length} style={{ fontSize: 12, fontWeight: 700, opacity: .85 }}>
                  {c.products.length}
                </span>
              </div>
            </summary>

            <div className="body" style={{ padding: 0 }}>
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
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
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
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}

      <span className="fp-kicker" style={{ margin: "32px 0 12px", display: "block" }}>
        Options &amp; toppings
        <HelpSpot title="What does switching a topping off actually do?" article="menu-and-pricing" anchor="toppings-and-options">
          There is no confirmation and no undo besides clicking it again, and nothing switches it back on
          overnight — the group bar stays red and counts how many you have left off until somebody does.
        </HelpSpot>
      </span>
      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 16px" }}>
        Click a topping to mark it off. On every product that offers it, it goes pale and cannot be
        ticked, straight away. It stays on the list rather than vanishing.
      </p>

      {groups.map((g) => {
        const off = g.modifiers.filter((m) => m.soldOut).length;
        return (
          <div key={g.id} className="fp-panel" data-tone={off ? "danger" : undefined}>
            <header>
              <span>{g.name}</span>
              <span style={{ fontWeight: 700, opacity: .85 }}>
                choose {g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}
                {off > 0 ? ` · ${off} off` : ""}
              </span>
            </header>
            <div className="body" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {g.modifiers.map((m) => (
                <form key={m.id} action={toggleModifier}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    className={m.soldOut ? "tag tag-danger" : "tag tag-ok"}
                    style={{ cursor: "pointer", textDecoration: m.soldOut ? "line-through" : undefined }}
                    title={m.soldOut ? "Off — click to put back on" : "On — click to mark off"}
                  >
                    {m.name}{m.price ? ` +${gbp(m.price)}` : ""}
                  </button>
                </form>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
