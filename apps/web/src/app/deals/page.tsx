import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@launchflow/db";
import { getConfig, assetUrl } from "@/lib/config";
import { getMenu, getClientRow, dealsToday } from "@/lib/menu";
import { pageTitle } from "@/lib/seo";
import { gbpShort, gbp } from "@/lib/money";
import { ApplyCode } from "@/components/deals/ApplyCode";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  return {
    title: { absolute: pageTitle(cfg, "Deals & Meal Deals") },
    description: `${cfg.name} meal deals and bundles. Order online for delivery in ${cfg.seo.locality.join(" & ")} or collection.`,
    alternates: { canonical: "/deals" },
  };
}

/** Deals screen from `Farm Pizza.dc.html`: a ruled grid of deal cells with the price
 *  set large in the accent, then a ruled list of promo codes underneath. */
export default async function DealsPage() {
  const menu = await getMenu();
  // Only what is actually buyable today - see dealsToday.
  const deals = dealsToday(menu.deals);
  const client = await getClientRow();
  const promos = await prisma.promo.findMany({
    where: { clientId: client.id, active: true },
    orderBy: { code: "asc" },
    select: { code: true, type: true, value: true, minOrder: true, firstOrderOnly: true, fulfilment: true },
  });

  const describe = (p: (typeof promos)[number]) =>
    p.type === "percent" ? `${p.value}% off your order`
    : p.type === "fixed" ? `${gbp(p.value)} off your order`
    : "Free delivery";

  const conditions = (p: (typeof promos)[number]) => {
    const bits: string[] = [];
    if (p.minOrder) bits.push(`${gbp(p.minOrder)} minimum`);
    if (p.firstOrderOnly) bits.push("first order only");
    if (p.fulfilment.length === 1) bits.push(`${p.fulfilment[0]} only`);
    return bits.join(" · ");
  };

  return (
    <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
      <span className="fp-kicker" style={{ marginBottom: 12 }}>Deals &amp; offers</span>
      <h1 className="fp-h1" style={{ marginBottom: 12 }}>
        {deals.length} deals. No small print you need a lawyer for.
      </h1>
      <p style={{ fontSize: 15, color: "var(--color-neutral-800)", margin: "0 0 32px", maxWidth: "60ch" }}>
        Every deal works on delivery and collection unless it says otherwise. Prices include VAT. One code per order.
      </p>

      {deals.length ? (
        <div className="fp-dealgrid">
          {deals.map((d) => (
            <article key={d.id} className="fp-dealcard">
              <div className="fp-dealcard-media">
                <Link href={`/deals/${d.slug}`} className="fp-dealcard-imglink" aria-hidden="true" tabIndex={-1}>
                  {d.image ? (
                    <Image src={assetUrl(d.image)} alt="" fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw" style={{ objectFit: "cover" }} />
                  ) : null}
                </Link>
                <span className="fp-dealcard-price">{gbpShort(d.price)}</span>
                {d.featured ? <span className="fp-dealcard-flag">Most popular</span> : null}
              </div>
              <div className="fp-dealcard-body">
                <h3>{d.name}</h3>
                {d.description ? <p>{d.description}</p> : null}
                {d.slots.length ? (
                  <ul className="fp-dealcard-slots">
                    {d.slots.map((sl) => <li key={sl.id}>{sl.qty} &times; {sl.name}</li>)}
                  </ul>
                ) : null}
                <Link href={`/deals/${d.slug}`} className="btn btn-primary fp-dealcard-cta">Build this deal</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--color-neutral-700)" }}>No deals running right now. Check back soon.</p>
      )}

      {promos.length ? (
        <div style={{ marginTop: 48 }}>
          <span className="fp-kicker" style={{ marginBottom: 12 }}>Codes</span>
          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {promos.map((p) => (
              <div key={p.code} className="fp-coderow">
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 15, fontWeight: 600 }}>{p.code}</span>
                <span style={{ fontSize: 14 }}>{describe(p)}</span>
                <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{conditions(p)}</span>
                <ApplyCode code={p.code} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
