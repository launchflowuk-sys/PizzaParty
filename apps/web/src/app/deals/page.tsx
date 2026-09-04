import type { Metadata } from "next";
import Link from "next/link";
import { getConfig } from "@/lib/config";
import { getMenu } from "@/lib/menu";
import { pageTitle } from "@/lib/seo";
import { gbpShort } from "@/lib/money";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  return { title: { absolute: pageTitle(cfg, "Deals & Meal Deals") }, description: `${cfg.name} meal deals and bundles. Order online for delivery in ${cfg.seo.locality.join(" & ")} or collection.`, alternates: { canonical: "/deals" } };
}

export default async function DealsPage() {
  const menu = await getMenu();
  return (
    <div className="lf-container">
      <h1 className="lf-h1 pt-6">Deals</h1>
      <p className="text-muted mt-2">Bundles priced below buying separately. Build yours in a few taps.</p>
      <div className="grid gap-3 mt-6 sm:grid-cols-2">
        {menu.deals.map((d) => (
          <Link key={d.id} href={`/deals/${d.slug}`} className="lf-card p-5 border-l-4 border-brand">
            <p className="text-xl font-extrabold">{d.name}</p>
            <p className="text-muted mt-1">{d.description}</p>
            <ul className="mt-3 text-sm text-ink-soft">{d.slots.map((s) => <li key={s.id}>• {s.qty} × {s.name}</li>)}</ul>
            <p className="mt-3 font-bold text-brand">{gbpShort(d.price)}</p>
          </Link>
        ))}
        {menu.deals.length === 0 ? <p className="text-muted">No deals right now. Check back soon.</p> : null}
      </div>
    </div>
  );
}
