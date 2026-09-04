import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, productPath } from "@/lib/menu";
import { toPicker } from "@/lib/picker";
import { breadcrumbJsonLd, pageTitle, productJsonLd } from "@/lib/seo";
import { gbpShort } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";
import { Photo } from "@/components/Photo";
import { AddToBasket } from "@/components/product/AddToBasket";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ category: string; product: string }> };

const TAG_LABEL: Record<string, string> = { vegetarian: "V", vegan: "VG", spicy: "Spicy", new: "New" };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category, product } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const c = menu.categories.find((x) => x.slug === category);
  const p = c?.products.find((x) => x.slug === product);
  if (!c || !p) return {};
  const min = Math.min(...p.sizes.map((s) => s.price));
  return {
    title: { absolute: pageTitle(cfg, `${p.name} — ${c.name}`) },
    description: `${p.description || p.name} ${p.sizes.length > 1 ? "from" : ""} ${gbpShort(min)}. Order online from ${cfg.name} for delivery in ${cfg.seo.locality.join(" & ")} or collection.`,
    alternates: { canonical: productPath(c, p) },
    openGraph: { images: [`/og?product=${p.slug}`] },
  };
}

/** Product screen from `Farm Pizza.dc.html`: a sticky square photograph on the left,
 *  the choices and the add bar on the right. */
export default async function ProductPage({ params }: Params) {
  const { category, product } = await params;
  const cfg = getConfig();
  const menu = await getMenu();
  const c = menu.categories.find((x) => x.slug === category);
  const p = c?.products.find((x) => x.slug === product);
  if (!c || !p) notFound();

  return (
    <section
      className="fp-wrap fp-split-half"
      style={{ padding: "40px 32px 64px" }}
    >
      <JsonLd
        data={[
          productJsonLd(cfg, c, p),
          breadcrumbJsonLd([
            { name: "Menu", path: "/menu" },
            { name: c.name, path: `/menu/${c.slug}` },
            { name: p.name, path: productPath(c, p) },
          ]),
        ]}
      />

      <div style={{ position: "sticky", top: 104 }}>
        <Photo
          src={assetUrl(p.image)}
          alt={p.name}
          caption="product photograph &middot; overhead &middot; b/w"
          ratio="1/1"
          priority
          sizes="(max-width: 1000px) 100vw, 550px"
        />
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--color-neutral-700)", lineHeight: 1.5 }}>
          {p.allergens.length ? <>Allergens: {p.allergens.join(", ")}. </> : null}
          The full allergen sheet is <Link href="/allergens">available here</Link> and at the counter.
        </p>
      </div>

      <div>
        <Link href="/menu" style={{ fontSize: 13 }}>&larr; Back to the menu</Link>
        <span className="fp-kicker" style={{ margin: "20px 0 10px" }}>{c.name}</span>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 44, lineHeight: 1.05, letterSpacing: "-.02em", margin: "0 0 12px" }}>
          {p.name}
        </h1>
        {p.description ? (
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--color-neutral-800)", margin: "0 0 12px" }}>{p.description}</p>
        ) : null}
        {p.tags.filter((t) => TAG_LABEL[t]).length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {p.tags.filter((t) => TAG_LABEL[t]).map((t) => (
              <span key={t} className="tag tag-neutral">{TAG_LABEL[t]}</span>
            ))}
          </div>
        ) : null}

        <AddToBasket product={toPicker(p)} />
      </div>
    </section>
  );
}
