"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useBasket } from "@/components/basket/store";
import { gbpShort } from "@/lib/money";
import { Photo } from "@/components/Photo";

export type TileItem = {
  slug: string;
  categorySlug: string;
  name: string;
  description: string;
  href: string;
  image: string;
  tags: string[];
  soldOut: boolean;
  /** Cheapest size, in pence. */
  fromPrice: number;
  sizeNote: string;
  /** First size key, used when adding straight to the basket. */
  firstSizeKey: string;
  /** True when the product has a required modifier group, so it cannot be added blind. */
  needsChoice: boolean;
};

export type TileCategory = { slug: string; name: string; count: number };

const TAG_LABEL: Record<string, string> = { vegetarian: "V", vegan: "VG", spicy: "Spicy", new: "New" };

/** Menu screen from `Farm Pizza.dc.html`: sticky category rail, search, and a 3-up
 *  ruled grid. Filtering is client-side to match the prototype's live behaviour; the
 *  full menu still ships in the page's JSON-LD for search engines. */
export function MenuBrowser({ categories, items }: { categories: TileCategory[]; items: TileItem[] }) {
  const [cat, setCat] = useState(categories[0]?.slug ?? "");
  const [query, setQuery] = useState("");
  const add = useBasket((s) => s.add);
  const [added, setAdded] = useState("");

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => items.filter((i) => (q ? `${i.name} ${i.description}`.toLowerCase().includes(q) : i.categorySlug === cat)),
    [items, cat, q],
  );
  const title = q ? `Search: ${query}` : (categories.find((c) => c.slug === cat)?.name ?? "Menu");

  function quickAdd(it: TileItem) {
    add({
      kind: "product", product: it.slug, size: it.firstSizeKey, modifiers: [], qty: 1,
      // Display cache. The server reprices every line on its own, but without these the
      // basket badge and basket page would show the line at £0.00.
      name: it.name, detail: it.sizeNote, unitPrice: it.fromPrice, lineTotal: it.fromPrice,
    });
    setAdded(it.name);
    window.setTimeout(() => setAdded(""), 2600);
  }

  return (
    <>
      <section
        className="fp-wrap fp-split-rail"
        style={{ padding: "40px 32px 64px" }}
      >
        <aside style={{ position: "sticky", top: 104 }}>
          <span className="fp-kicker" style={{ marginBottom: 12 }}>Menu</span>
          <div style={{ display: "grid", borderBottom: "2px solid var(--color-divider)" }}>
            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => { setCat(c.slug); setQuery(""); }}
                aria-current={!q && c.slug === cat ? "true" : undefined}
                style={{
                  textAlign: "left", background: "none", border: 0, borderTop: "2px solid var(--color-divider)",
                  padding: "12px 0", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18,
                  cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  color: !q && c.slug === cat ? "var(--color-accent)" : "var(--color-text)",
                }}
              >
                <span>{c.name}</span>
                <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 12, color: "var(--color-neutral-700)" }}>{c.count}</span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: "16px 0 0", lineHeight: 1.5 }}>
            V vegetarian &middot; VG vegan. Allergen information is available on request.
          </p>
          <Link href="/allergens" className="btn btn-secondary btn-block" style={{ marginTop: 16 }}>
            Allergen sheet &rarr;
          </Link>
        </aside>

        <div>
          <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
            <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 44, lineHeight: 1.05, letterSpacing: "-.02em", margin: 0 }}>
              {title}
            </h1>
            <input
              className="input"
              style={{ maxWidth: 280 }}
              placeholder="Search the menu"
              aria-label="Search the menu"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="fp-grid fp-grid-3">
            {shown.map((it, i) => (
              <div key={it.slug} className="fp-cell">
                {/* The first row is above the fold and holds the LCP element, so it
                    must load eagerly - lazy-loading it costs ~1s of LCP. */}
                <Photo src={it.image} alt={it.name} caption={`photo · ${it.name.toLowerCase()} · b/w`} priority={i < 3} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{it.name}</span>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17 }}>{gbpShort(it.fromPrice)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--color-neutral-700)", flex: 1 }}>{it.description}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minHeight: 20 }}>
                  {it.tags.filter((t) => TAG_LABEL[t]).map((t) => (
                    <span key={t} className="tag tag-neutral">{TAG_LABEL[t]}</span>
                  ))}
                  <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>{it.sizeNote}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {it.soldOut ? (
                    <span className="tag tag-outline">Sold out</span>
                  ) : it.needsChoice ? (
                    /* Required options (base, size) cannot be guessed, so the only
                       action is to open the product and choose. */
                    <Link href={it.href} className="btn btn-primary">Choose options</Link>
                  ) : (
                    <>
                      <button className="btn btn-primary" onClick={() => quickAdd(it)}>Add</button>
                      <Link href={it.href} className="btn btn-secondary">Details</Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {shown.length === 0 ? (
            <p style={{ margin: "24px 0 0", color: "var(--color-neutral-700)" }}>
              Nothing matches &ldquo;{query}&rdquo;. Try a topping, or clear the search.
            </p>
          ) : null}
        </div>
      </section>

      {added ? (
        <div
          role="status"
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 20,
            background: "var(--color-text)", color: "var(--color-bg)", padding: "12px 16px",
            display: "flex", gap: 20, alignItems: "center", fontSize: 14, boxShadow: "var(--shadow-lg)",
          }}
        >
          <span>Added {added}</span>
          <Link href="/basket" style={{ color: "var(--color-accent-400)" }}>View basket</Link>
        </div>
      ) : null}
    </>
  );
}
