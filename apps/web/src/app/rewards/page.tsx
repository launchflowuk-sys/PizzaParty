import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@launchflow/db";
import { getConfig } from "@/lib/config";
import { currentCustomer } from "@/lib/session";
import { pageTitle } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Points needed for the headline reward. The prototype's ladder (250 for a free
 *  medium) is the default until a client configures its own. */
const NEXT_REWARD = 250;
const STAMPS = 10;

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  if (!cfg.loyalty.enabled) return {};
  return {
    title: { absolute: pageTitle(cfg, "Crust Club") },
    description: `Earn a point for every pound you spend at ${cfg.name}.`,
    alternates: { canonical: "/rewards" },
  };
}

/** Crust Club from `Farm Pizza.dc.html`. Gated on `loyalty.enabled` - this client has
 *  loyalty switched off, so the route 404s rather than advertising a scheme that does
 *  not accrue. Redemption is not built yet, so no dead "Redeem" buttons are shown. */
export default async function RewardsPage() {
  const cfg = getConfig();
  if (!cfg.loyalty.enabled) notFound();

  const customer = await currentCustomer();

  if (!customer) {
    return (
      <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Crust Club</span>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 56, lineHeight: 1.02, letterSpacing: "-.02em", margin: "0 0 16px", maxWidth: "16ch" }}>
          A point for every pound. A pizza for every {NEXT_REWARD}.
        </h1>
        <p style={{ fontSize: 15, color: "var(--color-neutral-800)", margin: "0 0 24px", maxWidth: "56ch" }}>
          No app, no card. Your mobile number is your membership. Points land the moment the order is paid.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/account" className="btn btn-primary">Join Crust Club</Link>
          <Link href="/menu" className="btn btn-secondary">See the menu</Link>
        </div>
      </section>
    );
  }

  const points = customer.loyaltyPoints;
  const ledger = await prisma.loyaltyLedger.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const toNext = Math.max(0, NEXT_REWARD - (points % NEXT_REWARD));
  const pct = Math.min(100, ((points % NEXT_REWARD) / NEXT_REWARD) * 100);
  const stamps = Math.min(STAMPS, Math.floor(points / (NEXT_REWARD / STAMPS)) % (STAMPS + 1));

  return (
    <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
      <span className="fp-kicker" style={{ marginBottom: 12 }}>Crust Club</span>

      <div className="fp-split-half" style={{ alignItems: "end" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 96, lineHeight: 0.95, letterSpacing: "-.03em", margin: 0, color: "var(--color-accent)", marginLeft: "-.04em" }}>
            {points}
          </h1>
          <div style={{ fontSize: 15, marginTop: 12 }}>
            points, {customer.name?.split(" ")[0] || "there"}.{" "}
            <span style={{ color: "var(--color-neutral-600)" }}>{toNext} more and the next medium is free.</span>
          </div>
          <div style={{ height: 4, background: "var(--color-neutral-300)", marginTop: 20, position: "relative" }}>
            <div style={{ position: "absolute", inset: "0 auto 0 0", background: "var(--color-accent)", width: `${pct}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-neutral-600)", marginTop: 6 }}>
            <span>0</span><span>{NEXT_REWARD} · free medium pizza</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>
            Stamp card · {stamps} of {STAMPS}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAMPS},1fr)`, gap: 8, marginTop: 12 }}>
            {Array.from({ length: STAMPS }, (_, i) => (
              <div key={i} style={{ aspectRatio: "1", border: "2px solid var(--color-accent)", background: i < stamps ? "var(--color-accent)" : "transparent" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 20, fontSize: 13, flexWrap: "wrap" }}>
            <span><span style={{ color: "var(--color-neutral-600)" }}>Rate</span> &nbsp;{cfg.loyalty.pointsPerPound} pt / £1</span>
            <span><span style={{ color: "var(--color-neutral-600)" }}>Member since</span> &nbsp;{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(customer.createdAt)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 48 }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Points history</span>
        {ledger.length ? (
          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {ledger.map((e) => (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 24, alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <span style={{ fontSize: 14 }}>{e.reason}</span>
                <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                  {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(e.createdAt)}
                </span>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, color: e.delta >= 0 ? "var(--color-accent)" : "var(--color-neutral-700)" }}>
                  {e.delta >= 0 ? "+" : ""}{e.delta}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: "var(--color-neutral-600)" }}>
            No points yet. They land the moment an order is paid.
          </p>
        )}
      </div>
    </section>
  );
}
