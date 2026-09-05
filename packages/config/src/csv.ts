import type { MenuConfig, MenuProduct } from "./schema";

/** Minimal RFC4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((c) => c.trim() !== "")) rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const list = (s: string | undefined) => (s ? s.split(/[|;]/).map((x) => x.trim()).filter(Boolean) : []);
const slugify = (s: string) => s.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const bool = (s: string | undefined) => /^(1|true|yes|y)$/i.test(s ?? "");

/**
 * products.csv → menu.products (+ categories inferred if not supplied).
 * Columns (case-insensitive): category, name, description, size, price, slug?, modifier_groups?, tags?, allergens?, featured?, image?
 * One row per size. Rows without size become a single "regular" size.
 */
export function productsFromCsv(text: string): { products: MenuProduct[]; categories: MenuConfig["categories"]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const products = new Map<string, MenuProduct>();
  const categories = new Map<string, { slug: string; name: string; description: string; image: string }>();
  rows.forEach((r, idx) => {
    const line = idx + 2;
    const name = r.name ?? "";
    const catName = r.category ?? "";
    const priceRaw = (r.price ?? "").replace(/[£,\s]/g, "");
    const price = Number(priceRaw);
    if (!name) { errors.push(`line ${line}: missing name`); return; }
    if (!catName) { errors.push(`line ${line}: missing category for "${name}"`); return; }
    if (!priceRaw || Number.isNaN(price) || price < 0) { errors.push(`line ${line}: bad price "${r.price}" for "${name}"`); return; }
    const catSlug = slugify(catName);
    if (!categories.has(catSlug)) categories.set(catSlug, { slug: catSlug, name: catName, description: "", image: "" });
    const pSlug = r.slug ? slugify(r.slug) : slugify(name);
    const sizeName = r.size || "Regular";
    const sizeId = slugify(sizeName);
    let p = products.get(pSlug);
    if (!p) {
      p = {
        slug: pSlug, category: catSlug, name, description: r.description ?? "", story: r.story ?? "", image: r.image ?? "",
        sizes: [], modifierGroups: list(r.modifier_groups), tags: list(r.tags), allergens: list(r.allergens),
        featured: bool(r.featured), soldOut: bool(r.sold_out),
      };
      products.set(pSlug, p);
    }
    if (p.sizes.some((s) => s.id === sizeId)) { errors.push(`line ${line}: duplicate size "${sizeName}" for "${name}"`); return; }
    p.sizes.push({ id: sizeId, name: sizeName, price });
  });
  return { products: [...products.values()], categories: [...categories.values()], errors };
}
