import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getConfig } from "@/lib/config";
import { getMenu, dealsToday } from "@/lib/menu";
import { toPicker } from "@/lib/picker";
import { abs, breadcrumbJsonLd, pageTitle } from "@/lib/seo";
import { gbpShort } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";
import { DealBuilder, type BuilderDeal } from "@/components/deals/DealBuilder";

export const dynamic = "force-dynamic";
/** "Tuesdays", or "Tuesdays and Fridays" - what to tell someone who arrived early. */
const DAY_NAME = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
function runsOn(days: number[]): string {
  const names = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_NAME[d] ?? "");
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

type Params = { params: Promise<{ deal: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { deal } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const d = menu.deals.find((x) => x.slug === deal);
  if (!d) return {};
  return { title: { absolute: pageTitle(cfg, `${d.name} deal · ${gbpShort(d.price)}`) }, description: `${d.description} Order the ${d.name} from ${cfg.name} online.`, alternates: { canonical: `/deals/${d.slug}` } };
}

export default async function DealPage({ params }: Params) {
  const { deal } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const d = menu.deals.find((x) => x.slug === deal);
  if (!d) notFound();

  // Someone can reach this from a saved link or a search result on the wrong
  // day. Letting them build the deal would only take it off them at checkout,
  // so say when it runs instead of wasting their time.
  const runningToday = dealsToday([d]).length > 0;
  if (!runningToday) {
    return (
      <div className="lf-container max-w-2xl">
        <nav className="pt-4 text-sm text-muted"><Link href="/deals">Deals</Link> / {d.name}</nav>
        <h1 className="lf-h1 mt-2">{d.name}</h1>
        <p className="text-muted mt-2">
          This one runs on {runsOn(d.daysOfWeek)}. It is not available today, so it cannot be
          ordered — but it will be back.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/deals" className="btn btn-primary">See today&rsquo;s deals</Link>
          <Link href="/menu" className="btn btn-secondary">See the menu</Link>
        </div>
      </div>
    );
  }

  const all = menu.categories.flatMap((c) => c.products.map((p) => ({ p, c })));
  const builder: BuilderDeal = {
    slug: d.slug, name: d.name, price: d.price,
    slots: d.slots.map((s) => ({
      name: s.name, qty: s.qty, sizeKeys: s.sizeKeys,
      options: all
        .filter(({ p, c }) => (s.productSlugs.length ? s.productSlugs.includes(p.slug) : true) && (s.categorySlugs.length ? s.categorySlugs.includes(c.slug) : true))
        .filter(({ p }) => !s.sizeKeys.length || p.sizes.some((z) => s.sizeKeys.includes(z.key)))
        .map(({ p }) => toPicker(p)),
    })),
  };
  const jsonld = {
    "@context": "https://schema.org", "@type": "Offer", name: d.name, description: d.description, url: abs(`/deals/${d.slug}`),
    price: (d.price / 100).toFixed(2), priceCurrency: "GBP", availability: "https://schema.org/InStock", seller: { "@type": "Restaurant", name: cfg.name },
  };
  return (
    <div className="lf-container max-w-2xl">
      <JsonLd data={[jsonld, breadcrumbJsonLd([{ name: "Deals", path: "/deals" }, { name: d.name, path: `/deals/${d.slug}` }])]} />
      <nav className="pt-4 text-sm text-muted"><Link href="/deals">Deals</Link> / {d.name}</nav>
      <h1 className="lf-h1 mt-2">{d.name} <span className="text-brand">{gbpShort(d.price)}</span></h1>
      <p className="text-muted mt-2">{d.description}</p>
      <div className="mt-6"><DealBuilder deal={builder} /></div>
    </div>
  );
}
