import type { Metadata } from "next";
import Link from "next/link";
import { getConfig } from "@/lib/config";
import { getMenu, productPath } from "@/lib/menu";
import { pageTitle } from "@/lib/seo";

export const dynamic = "force-dynamic";
export function generateMetadata(): Metadata { const cfg = getConfig(); return { title: { absolute: pageTitle(cfg, "Allergen Information") }, alternates: { canonical: "/allergens" } }; }

export default async function AllergensPage() {
  const cfg = getConfig();
  const menu = await getMenu();
  return (
    <div className="lf-container max-w-3xl">
      <h1 className="lf-h1 pt-8">Allergen information</h1>
      <p className="mt-3 text-muted">All food is prepared in a kitchen that handles gluten, milk, eggs, nuts, soya, sesame, celery, mustard, fish, crustaceans, molluscs, sulphites and lupin. Cross-contamination is possible. If you have a severe allergy, call {cfg.contact.phone || "the shop"} before ordering.</p>
      <div className="overflow-x-auto mt-6">
        <table className="text-sm w-full">
          <thead><tr className="text-left border-b border-line"><th className="py-2">Item</th><th className="py-2">Contains</th><th className="py-2">Diet</th></tr></thead>
          <tbody>
            {menu.categories.flatMap((c) => c.products.map((p) => (
              <tr key={p.id} className="border-b border-line">
                <td className="py-2"><Link href={productPath(c, p)} className="font-semibold">{p.name}</Link></td>
                <td className="py-2 capitalize">{p.allergens.join(", ") || "—"}</td>
                <td className="py-2 capitalize">{p.tags.filter((t) => ["vegetarian", "vegan", "halal", "gluten-free"].includes(t)).join(", ") || "—"}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
