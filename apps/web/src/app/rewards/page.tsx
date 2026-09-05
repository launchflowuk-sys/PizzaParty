import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@launchflow/db";
import { getConfig } from "@/lib/config";
import { currentCustomer } from "@/lib/session";
import { pageTitle } from "@/lib/seo";
import { rewardCatalogue, unspentRewards, rewardValue } from "@/lib/loyalty";
import { claimReward } from "./actions";

export const dynamic = "force-dynamic";

/**
 * The ladder is whatever the shop is actually offering, read from the rewards
 * it has set up. It used to be a hardcoded "250 points for a free medium",
 * which was a promise nothing in the system could keep - there was no such
 * reward and no way to claim one.
 */
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

/**
 * Crust Club. Gated on `loyalty.enabled`, so a shop that does not run the scheme
 * 404s here rather than advertising one that does not accrue.
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; e?: string }>;
}) {
  const { code: claimedCode, e: claimError } = await searchParams;
  const cfg = getConfig();
  if (!cfg.loyalty.enabled) notFound();

  const customer = await currentCustomer();
  const catalogue = await rewardCatalogue();
  const cheapest = catalogue[0] ?? null;

  if (!customer) {
    return (
      <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Crust Club</span>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 56, lineHeight: 1.02, letterSpacing: "-.02em", margin: "0 0 16px", maxWidth: "16ch" }}>
          {cheapest
            ? <>A point for every pound. {cheapest.name} for every {cheapest.points}.</>
            : <>A point for every pound you spend.</>}
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
  const [ledger, unspent] = await Promise.all([
    prisma.loyaltyLedger.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    unspentRewards(customer.id),
  ]);

  // The next thing actually within reach, rather than a fixed ladder: the
  // cheapest reward they cannot afford yet. Once everything is affordable there
  // is nothing to count towards, and the bar says so instead of resetting.
  const next = catalogue.find((r) => r.points > points) ?? null;
  const toNext = next ? next.points - points : 0;
  const pct = next ? Math.min(100, (points / next.points) * 100) : 100;
  const stamps = next ? Math.round((pct / 100) * STAMPS) : STAMPS;

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
            <span style={{ color: "var(--color-neutral-700)" }}>
              {next
                ? `${toNext} more for ${next.name}.`
                : catalogue.length
                  ? "Enough for everything on the list below."
                  : "Rewards are being set up — your points are safe in the meantime."}
            </span>
          </div>
          <div style={{ height: 4, background: "var(--color-neutral-300)", marginTop: 20, position: "relative" }}>
            <div style={{ position: "absolute", inset: "0 auto 0 0", background: "var(--color-accent)", width: `${pct}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-neutral-700)", marginTop: 6 }}>
            <span>0</span><span>{next ? `${next.points} · ${next.name}` : "All rewards unlocked"}</span>
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
            <span><span style={{ color: "var(--color-neutral-700)" }}>Rate</span> &nbsp;{cfg.loyalty.pointsPerPound} pt / £1</span>
            <span><span style={{ color: "var(--color-neutral-700)" }}>Member since</span> &nbsp;{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(customer.createdAt)}</span>
          </div>
        </div>
      </div>

      {claimedCode ? (
        <div style={{ marginTop: 40, padding: "20px 24px", background: "var(--color-accent)", color: "#fff", borderRadius: 12 }}>
          <p style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", margin: "0 0 8px", opacity: .85 }}>
            Claimed — here is your code
          </p>
          <p style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 40, letterSpacing: ".04em", margin: "0 0 8px" }}>
            {claimedCode}
          </p>
          <p style={{ fontSize: 14, margin: 0, opacity: .9 }}>
            Put it in at checkout. It is yours alone — nobody else can use it, so there is no rush.
          </p>
        </div>
      ) : null}

      {claimError ? (
        <div role="status" style={{ marginTop: 40, padding: "16px 20px", background: "var(--color-neutral-100)", borderRadius: 12, fontSize: 15, fontWeight: 700 }}>
          {claimError}
        </div>
      ) : null}

      {/* ---- What points buy ---- */}
      <div style={{ marginTop: 48 }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>What your points buy</span>
        {catalogue.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>
            Rewards are being set up. Keep ordering — your points are counting either way.
          </p>
        ) : (
          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {catalogue.map((r) => {
              const affordable = points >= r.points;
              return (
                <div key={r.id} style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--color-divider)" }}>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{r.name}</p>
                    <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "4px 0 0" }}>
                      {rewardValue(r)} &middot; use within {r.expiryDays} days of claiming
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, color: affordable ? "var(--color-accent)" : "var(--color-neutral-700)" }}>
                      {r.points} pts
                    </span>
                    {affordable ? (
                      <form action={claimReward}>
                        <input type="hidden" name="rewardId" value={r.id} />
                        <button className="btn btn-primary">Claim</button>
                      </form>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                        {r.points - points} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Codes claimed and not yet spent ---- */}
      {unspent.length > 0 ? (
        <div style={{ marginTop: 48 }}>
          <span className="fp-kicker" style={{ marginBottom: 12 }}>Ready to use</span>
          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {unspent.map((p) => (
              <div key={p.code} style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, letterSpacing: ".04em" }}>{p.code}</span>
                <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                  {rewardValue(p)}
                  {p.endsAt ? ` · until ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(p.endsAt)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 48 }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Points history</span>
        {ledger.length ? (
          <div style={{ borderTop: "2px solid var(--color-divider)" }}>
            {ledger.map((e) => (
              <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 24, alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <span style={{ fontSize: 14 }}>{e.reason}</span>
                <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                  {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(e.createdAt)}
                </span>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, color: e.delta >= 0 ? "var(--color-accent)" : "var(--color-neutral-700)" }}>
                  {e.delta >= 0 ? "+" : ""}{e.delta}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>
            No points yet. They land the moment an order is paid.
          </p>
        )}
      </div>
    </section>
  );
}
