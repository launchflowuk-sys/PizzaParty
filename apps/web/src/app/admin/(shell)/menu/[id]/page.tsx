import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { requireScreen } from "@/lib/session";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { updateProductText } from "../../actions";
import {
  addSize, deleteSize, updateSize, toggleSizeSoldOut,
  deleteProduct, moveProductToCategory, toggleProductGroup, updateProductMeta,
} from "../../menu-actions";

export const dynamic = "force-dynamic";

/**
 * One item, in full.
 *
 * Sizes and options live here rather than on the list because there are sixty-
 * eight items and eight option groups: rendering every size box and every
 * on/off toggle inline would be several hundred forms on one page, for the sake
 * of a job that is done once when an item is set up and rarely again. The list
 * stays quick for the thing done nightly - marking something off - and the
 * shape of an item is edited on its own screen.
 */
export default async function EditProduct({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; e?: string }>;
}) {
  await requireScreen("menu");
  const client = await getClientRow();
  const { id } = await params;
  const { m, e } = await searchParams;

  const product = await prisma.product.findFirst({
    where: { id, clientId: client.id },
    include: {
      sizes: { orderBy: { sortOrder: "asc" } },
      modifierGroups: { select: { groupId: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!product) notFound();

  const [categories, groups] = await Promise.all([
    prisma.category.findMany({ where: { clientId: client.id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.modifierGroup.findMany({
      where: { clientId: client.id },
      orderBy: { name: "asc" },
      include: { modifiers: { orderBy: { sortOrder: "asc" }, select: { name: true, price: true } } },
    }),
  ]);
  const on = new Set(product.modifierGroups.map((g) => g.groupId));
  const back = `/admin/menu/${product.id}`;

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            <Link href="/admin/menu" style={{ color: "inherit" }}>Menu &amp; pricing</Link>
            {" "}&middot; {product.category.name}
            {product.soldOut ? <> &middot; <span className="fp-num-danger">Sold out</span></> : null}
            {!product.active ? <> &middot; <span className="fp-num-warn">Hidden</span></> : null}
          </span>
          <h1>{product.name}</h1>
        </div>
      </header>

      <AdminNotice message={m} error={e} back={back} />

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 20px", maxWidth: "78ch" }}>
        Lives at <code>/menu/{product.category.slug}/{product.slug}</code>. Renaming it does not move it,
        so a link somebody has already shared keeps working — but moving it to another section does.
        <HelpSpot title="Why does renaming not change the web address?" article="menu-and-pricing" anchor="putting-a-price-up">
          The last part of the address is fixed when the item is created, because changing it would break
          every link already shared and quietly drop the item out of any meal deal that names it. Rename
          freely — customers see the name, not the address. Moving it to a different section is the one
          thing that does change the address, since the section is part of it.
        </HelpSpot>
      </p>

      {/* ---- Name, description, section ---- */}
      <div className="fp-panel">
        <header><span>Name and description</span></header>
        <div className="body">
          <form action={updateProductText} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <input type="hidden" name="id" value={product.id} />
            <label style={{ flex: "0 1 260px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Name
              <input name="name" defaultValue={product.name} className="input" style={{ fontWeight: 700, width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ flex: "1 1 340px", minWidth: 0, fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Description
              <input name="description" defaultValue={product.description} className="input" style={{ width: "100%", marginTop: 4 }} />
            </label>
            <button className="btn btn-primary">Save</button>
          </form>

          <form action={moveProductToCategory} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14 }}>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={product.id} />
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Section
              <select name="categoryId" defaultValue={product.categoryId} className="input" style={{ display: "block", marginTop: 4, minWidth: 200 }}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <button className="btn btn-secondary">Move</button>
          </form>
        </div>
      </div>

      {/* ---- Photo, tags, allergens ---- */}
      <div className="fp-panel" style={{ marginTop: 16 }}>
        <header><span>Photo and labels</span></header>
        <div className="body">
          <form action={updateProductMeta} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={product.id} />
            <label style={{ flex: "1 1 320px", minWidth: 0, fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Photo
              <input name="image" defaultValue={product.image} className="input" placeholder="/images/products/margherita.jpg" style={{ width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ flex: "0 1 220px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Labels
              <input name="tags" defaultValue={product.tags.join(", ")} className="input" placeholder="vegetarian, spicy" style={{ width: "100%", marginTop: 4 }} />
            </label>
            <label style={{ flex: "0 1 220px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Allergens
              <input name="allergens" defaultValue={product.allergens.join(", ")} className="input" placeholder="gluten, dairy" style={{ width: "100%", marginTop: 4 }} />
            </label>
            <button className="btn btn-primary">Save</button>
          </form>
          {product.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={product.image} alt="" style={{ marginTop: 12, height: 90, width: 90, objectFit: "cover", borderRadius: 8 }} />
          ) : (
            <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "12px 0 0" }}>
              No photo yet. The item still sells — it shows with the section&rsquo;s fallback image.
            </p>
          )}
        </div>
      </div>

      {/* ---- Sizes ---- */}
      <div className="fp-panel" style={{ marginTop: 16 }}>
        <header>
          <span>Sizes and prices</span>
          <span style={{ fontWeight: 700, opacity: .85 }}>{product.sizes.length}</span>
        </header>
        <div className="body" style={{ padding: 0 }}>
          {product.sizes.map((s) => (
            <div key={s.id} style={{
              display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
              padding: "10px 14px", borderBottom: "1px solid var(--color-divider)",
              background: s.soldOut ? "var(--danger-bg)" : undefined,
            }}>
              <form action={updateSize} style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 320px" }}>
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="id" value={s.id} />
                <input name="name" defaultValue={s.name} className="input" aria-label="Size name" style={{ flex: "0 1 150px", fontWeight: 700 }} />
                <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>£</span>
                <input name="price" defaultValue={(s.price / 100).toFixed(2)} className="input" inputMode="decimal" aria-label={`${s.name} price`} style={{ width: 84, fontWeight: 700 }} />
                <button className="btn btn-secondary">Save</button>
              </form>
              <div style={{ display: "flex", gap: 6 }}>
                <form action={toggleSizeSoldOut}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className={s.soldOut ? "btn btn-danger" : "btn btn-secondary"}>
                    {s.soldOut ? "Sold out — put back on" : "Mark sold out"}
                  </button>
                </form>
                <form action={deleteSize}>
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="id" value={s.id} />
                  <button className="btn btn-secondary" aria-label={`Remove the ${s.name} size`}>Remove</button>
                </form>
              </div>
            </div>
          ))}

          <form action={addSize} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "12px 14px" }}>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="productId" value={product.id} />
            <input name="name" className="input" placeholder="Another size, e.g. 16 inch" aria-label="New size name" style={{ flex: "0 1 200px" }} />
            <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>£</span>
            <input name="price" className="input" inputMode="decimal" placeholder="0.00" aria-label="New size price" style={{ width: 84 }} />
            <button className="btn btn-ok">Add size</button>
          </form>
        </div>
      </div>

      {/* ---- Options ---- */}
      <div className="fp-panel" style={{ marginTop: 16 }}>
        <header>
          <span>Options offered on this item</span>
          <span style={{ fontWeight: 700, opacity: .85 }}>{on.size} of {groups.length}</span>
        </header>
        <div className="body">
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 12px" }}>
            Click a group to offer it here or take it away. The groups themselves — what is in them and
            what they cost — are edited on the{" "}
            <Link href="/admin/menu#options">menu screen</Link>, once for the whole menu.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {groups.map((g) => (
              <form key={g.id} action={toggleProductGroup}>
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="groupId" value={g.id} />
                <button
                  className={on.has(g.id) ? "tag tag-ok" : "tag tag-neutral"}
                  style={{ cursor: "pointer" }}
                  title={on.has(g.id) ? "Offered — click to take it off this item" : "Not offered — click to add it"}
                >
                  {on.has(g.id) ? "✓ " : "+ "}{g.name}
                  <span style={{ opacity: .7, fontWeight: 600 }}> · {g.modifiers.length}</span>
                </button>
              </form>
            ))}
            {groups.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: 0 }}>
                No option groups yet. Make one on the menu screen and it will appear here.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* ---- Delete ---- */}
      <div className="fp-panel" data-tone="danger" style={{ marginTop: 24 }}>
        <header><span>Delete this item</span></header>
        <div className="body" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: 0, maxWidth: "62ch" }}>
            Past orders keep their own copy of the name, size and price, so takings and order history
            read exactly the same afterwards. If you just want it off the menu for now, use Hide on the
            menu screen instead — that can be undone.
          </p>
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={product.id} />
            <button className="btn btn-danger">Delete {product.name}</button>
          </form>
        </div>
      </div>
    </>
  );
}
