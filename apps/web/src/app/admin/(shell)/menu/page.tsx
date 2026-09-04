import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { moveProduct, toggleModifier, toggleProduct, updateProductText, updateSizePrice } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminMenu() {
  const client = await getClientRow();
  const [categories, groups] = await Promise.all([
    prisma.category.findMany({ where: { clientId: client.id }, orderBy: { sortOrder: "asc" }, include: { products: { orderBy: { sortOrder: "asc" }, include: { sizes: { orderBy: { sortOrder: "asc" } } } } } }),
    prisma.modifierGroup.findMany({ where: { clientId: client.id }, include: { modifiers: { orderBy: { sortOrder: "asc" } } } }),
  ]);
  return (
    <div>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Menu & pricing</h1>
        </div>
      </header>
      <p className="text-sm text-muted mt-1">Inline price edits apply instantly. Structural changes (new items, categories, options) go in <code>config/{client.slug}/menu.json</code> then re-seed.</p>
      {categories.map((c) => (
        <section key={c.id} className="mt-6">
          <h2 className="font-bold text-lg">{c.name}</h2>
          <div className="lf-card mt-2 divide-y divide-line">
            {c.products.map((p) => (
              <div key={p.id} className={`p-3 ${!p.active ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={updateProductText} className="flex-1 min-w-60 flex gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="name" defaultValue={p.name} className="lf-input font-semibold" aria-label="Name" />
                    <input name="description" defaultValue={p.description} className="lf-input" aria-label="Description" />
                    <button className="lf-btn lf-btn-ghost">Save</button>
                  </form>
                  <form action={toggleProduct}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="field" value="soldOut" /><button className={`lf-btn ${p.soldOut ? "lf-btn-primary" : "lf-btn-ghost"}`}>{p.soldOut ? "Sold out ✓" : "Mark sold out"}</button></form>
                  <form action={toggleProduct}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="field" value="featured" /><button className="lf-btn lf-btn-ghost">{p.featured ? "★ Featured" : "☆ Feature"}</button></form>
                  <form action={toggleProduct}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="field" value="active" /><button className="lf-btn lf-btn-ghost">{p.active ? "Hide" : "Show"}</button></form>
                  <form action={moveProduct} className="flex"><input type="hidden" name="id" value={p.id} /><button name="dir" value="up" className="lf-btn lf-btn-ghost px-3" aria-label="Move up">↑</button><button name="dir" value="down" className="lf-btn lf-btn-ghost px-3" aria-label="Move down">↓</button></form>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.sizes.map((s) => (
                    <form key={s.id} action={updateSizePrice} className="flex items-center gap-1 text-sm">
                      <input type="hidden" name="id" value={s.id} />
                      <span className="text-muted">{s.name}</span>
                      <input name="price" defaultValue={(s.price / 100).toFixed(2)} className="lf-input w-24" inputMode="decimal" aria-label={`${p.name} ${s.name} price`} />
                      <button className="lf-btn lf-btn-ghost px-3">Save</button>
                      <span className="text-xs text-muted">({gbp(s.price)})</span>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="mt-8">
        <h2 className="font-bold text-lg">Options</h2>
        {groups.map((g) => (
          <div key={g.id} className="lf-card mt-2 p-3">
            <p className="font-semibold">{g.name} <span className="text-muted text-xs">min {g.minSelect} / max {g.maxSelect}</span></p>
            <div className="mt-2 flex flex-wrap gap-2">{g.modifiers.map((m) => (
              <form key={m.id} action={toggleModifier}><input type="hidden" name="id" value={m.id} /><button className={`lf-pill border ${m.soldOut ? "bg-danger/10 border-danger/40 line-through" : "bg-surface border-line"}`}>{m.name} {m.price ? `+${gbp(m.price)}` : ""}</button></form>
            ))}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
