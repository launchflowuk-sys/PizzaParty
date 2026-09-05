import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@launchflow/db";
import { getConfig, assetUrl } from "@/lib/config";
import { currentCustomer } from "@/lib/session";
import { pageTitle } from "@/lib/seo";
import { rewardCatalogue, unspentRewards, rewardValue } from "@/lib/loyalty";
import { claimReward } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  if (!cfg.loyalty.enabled) return {};
  return {
    title: { absolute: pageTitle(cfg, "Crust Club") },
    description: `Earn a point for every pound you spend at ${cfg.name}. No app, no card — your mobile number is your membership.`,
    alternates: { canonical: "/rewards" },
  };
}

/**
 * A photograph behind the hero if the shop has one, otherwise the accent.
 *
 * Named rather than hardcoded so a new tenant drops a file in and gets it, and
 * the page is not broken while they have not.
 */
const HERO = "rewards-hero.jpg";

/** How it works, in the order it happens. Three steps, because four is a form. */
function Steps({ rate, cheapest }: { rate: number; cheapest: number | null }) {
  const steps = [
    { n: "1", h: "Order as normal", p: "Nothing to join, nothing to carry. Your mobile number is your membership — it works the first time you use it." },
    { n: "2", h: `Collect ${rate} point per £1`, p: "Points land when the order is completed, on the food, before delivery. Nothing to scan and nothing to remember." },
    { n: "3", h: "Swap them for something", p: cheapest ? `The first reward is ${cheapest} points away from a standing start. Claim it whenever you like — the code is yours alone.` : "Rewards are being set up. Your points are counting in the meantime." },
  ];
  return (
    <div className="fp-cc-steps">
      {steps.map((s) => (
        <div key={s.n} className="fp-cc-step">
          <span className="fp-cc-stepno">{s.n}</span>
          <h3>{s.h}</h3>
          <p>{s.p}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Crust Club.
 *
 * Gated on `loyalty.enabled`, so a shop that does not run the scheme gets a 404
 * here rather than a page advertising one that does not accrue.
 *
 * Two quite different pages share this route, and that is the point. A stranger
 * needs the argument for joining; a member needs their balance, what is within
 * reach, and one obvious thing to do next. Showing either of them the other's
 * page is what made this feel like a leaflet.
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
  const rate = cfg.loyalty.pointsPerPound;
  const hero = assetUrl(HERO);

  /* ─────────────────────────── Not signed in ─────────────────────────── */
  if (!customer) {
    return (
      <>
        <section className="fp-cc-hero" style={{ backgroundImage: `url(${hero})` }}>
          <div className="fp-cc-hero-scrim" />
          <div className="fp-wrap fp-cc-hero-inner">
            <span className="fp-cc-badge">Crust Club</span>
            <h1 className="fp-cc-h1">
              {cheapest
                ? <>Every pound you spend<br />is {rate} point closer to<br /><em>{cheapest.name.toLowerCase()}</em>.</>
                : <>A point for every pound<br />you spend with us.</>}
            </h1>
            <p className="fp-cc-lede">
              No app to download. No card to lose. Your mobile number is your membership, and it
              starts working on your very next order.
            </p>
            <div className="fp-cc-cta">
              <Link href="/account" className="btn btn-primary fp-cta-lg">Join — it takes a second</Link>
              <Link href="/menu" className="btn btn-hero-ghost fp-cta-lg">Start an order</Link>
            </div>
          </div>
        </section>

        <section className="fp-wrap fp-cc-sec">
          <span className="fp-kicker">How it works</span>
          <h2 className="fp-cc-h2">Three steps, and you are already doing the first one.</h2>
          <Steps rate={rate} cheapest={cheapest?.points ?? null} />
        </section>

        {catalogue.length > 0 ? (
          <section className="fp-wrap fp-cc-sec">
            <span className="fp-kicker">The ladder</span>
            <h2 className="fp-cc-h2">What your points are worth.</h2>
            <div className="fp-cc-ladder">
              {catalogue.map((r, i) => (
                <div key={r.id} className="fp-cc-rung" data-first={i === 0 ? "1" : undefined}>
                  <span className="fp-cc-pts">{r.points}</span>
                  <span className="fp-cc-pts-l">points</span>
                  <h3>{r.name}</h3>
                  <p>{rewardValue(r)}</p>
                  {i === 0 ? <span className="fp-cc-tag">Closest first reward</span> : null}
                </div>
              ))}
            </div>
            <p className="fp-cc-note">
              Spend {cheapest ? Math.ceil(cheapest.points / rate) : 0} pounds and the first one is yours.
              That is roughly {cheapest ? Math.max(1, Math.round(cheapest.points / rate / 25)) : 0} normal orders.
            </p>
          </section>
        ) : null}

        {cfg.referral.enabled ? (
          <section className="fp-wrap fp-cc-sec">
            <div className="fp-cc-refer">
              <div>
                <span className="fp-kicker" style={{ color: "inherit", opacity: .85 }}>And there is a shortcut</span>
                <h2 className="fp-cc-h2" style={{ color: "inherit" }}>
                  Give £{cfg.referral.refereeDiscount}. Get £{cfg.referral.referrerReward}.
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.6, maxWidth: "46ch", margin: "0 0 22px" }}>
                  Send a friend your code. They get £{cfg.referral.refereeDiscount} off their first order,
                  and once they have ordered you get £{cfg.referral.referrerReward} off yours. No limit on
                  how many people you send.
                </p>
                <Link href="/account" className="btn btn-primary fp-cta-lg">Get my code</Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="fp-wrap fp-cc-sec fp-cc-plain">
          <h2 className="fp-cc-h2">The small print, without the small print.</h2>
          <div className="fp-cc-facts">
            <div><h4>Points do not expire</h4><p>They sit there. A claimed reward has a use-by date, which is shown before you claim it.</p></div>
            <div><h4>Nothing to carry</h4><p>Your number is your membership. Order from a different phone and it still knows you.</p></div>
            <div><h4>Both shops, one balance</h4><p>Earn at Grays, spend at Basildon. It makes no difference.</p></div>
            <div><h4>We will not pester you</h4><p>Joining is not signing up for messages. That is a separate tick box, and you control it.</p></div>
          </div>
          <div className="fp-cc-cta" style={{ marginTop: 28 }}>
            <Link href="/account" className="btn btn-primary fp-cta-lg">Join Crust Club</Link>
            <Link href="/menu" className="btn btn-secondary fp-cta-lg">See the menu</Link>
          </div>
        </section>
      </>
    );
  }

  /* ───────────────────────────── A member ─────────────────────────────── */
  const points = customer.loyaltyPoints;
  const [ledger, unspent] = await Promise.all([
    prisma.loyaltyLedger.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    unspentRewards(customer.id),
  ]);

  // The next thing actually within reach, rather than a fixed ladder.
  const next = catalogue.find((r) => r.points > points) ?? null;
  const toNext = next ? next.points - points : 0;
  const pct = next ? Math.min(100, Math.round((points / next.points) * 100)) : 100;
  const affordable = catalogue.filter((r) => points >= r.points);
  const firstName = customer.name?.split(" ")[0] || "there";

  return (
    <>
      <section className="fp-cc-hero fp-cc-hero-member" style={{ backgroundImage: `url(${hero})` }}>
        <div className="fp-cc-hero-scrim" />
        <div className="fp-wrap fp-cc-hero-inner">
          <span className="fp-cc-badge">Crust Club</span>
          <div className="fp-cc-balance">
            <span className="fp-cc-bignum">{points}</span>
            <span className="fp-cc-bigunit">points, {firstName}</span>
          </div>

          {next ? (
            <div className="fp-cc-prog">
              <div className="fp-cc-prog-bar"><span style={{ width: `${pct}%` }} /></div>
              <p className="fp-cc-prog-l">
                <strong>{toNext} more</strong> for {next.name} — about £{Math.ceil(toNext / rate)} of ordering.
              </p>
            </div>
          ) : catalogue.length ? (
            <p className="fp-cc-prog-l"><strong>Enough for everything below.</strong> Go on then.</p>
          ) : (
            <p className="fp-cc-prog-l">Rewards are being set up. Your points are safe and counting.</p>
          )}

          <div className="fp-cc-cta">
            {affordable.length > 0
              ? <a href="#claim" className="btn btn-primary fp-cta-lg">Claim a reward</a>
              : <Link href="/menu" className="btn btn-primary fp-cta-lg">Order and earn</Link>}
            <Link href="/menu" className="btn btn-hero-ghost fp-cta-lg">See the menu</Link>
          </div>
        </div>
      </section>

      {claimedCode ? (
        <section className="fp-wrap fp-cc-sec">
          <div className="fp-cc-code">
            <p className="fp-cc-code-k">Claimed — here is your code</p>
            <p className="fp-cc-code-v">{claimedCode}</p>
            <p className="fp-cc-code-p">Put it in at checkout. It is yours alone, so nobody else can use it.</p>
            <Link href="/menu" className="btn btn-primary fp-cta-lg" style={{ marginTop: 16 }}>Spend it now</Link>
          </div>
        </section>
      ) : null}

      {claimError ? (
        <section className="fp-wrap fp-cc-sec"><div className="fp-cc-err" role="status">{claimError}</div></section>
      ) : null}

      {unspent.length > 0 ? (
        <section className="fp-wrap fp-cc-sec">
          <span className="fp-kicker">Ready to use</span>
          <h2 className="fp-cc-h2">You have {unspent.length} code{unspent.length === 1 ? "" : "s"} waiting.</h2>
          <div className="fp-cc-codes">
            {unspent.map((p) => (
              <div key={p.code} className="fp-cc-codecard">
                <span className="fp-cc-codecard-v">{p.code}</span>
                <span className="fp-cc-codecard-w">{rewardValue(p)}</span>
                {p.endsAt ? <span className="fp-cc-codecard-x">Use by {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(p.endsAt)}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="fp-wrap fp-cc-sec" id="claim" style={{ scrollMarginTop: 88 }}>
        <span className="fp-kicker">What your points buy</span>
        <h2 className="fp-cc-h2">
          {affordable.length > 0
            ? `${affordable.length} of these ${affordable.length === 1 ? "is" : "are"} yours right now.`
            : "Keep going — the first one is close."}
        </h2>

        {catalogue.length === 0 ? (
          <p className="fp-cc-note">Rewards are being set up. Keep ordering — your points are counting either way.</p>
        ) : (
          <div className="fp-cc-grid">
            {catalogue.map((r) => {
              const can = points >= r.points;
              return (
                <div key={r.id} className="fp-cc-card" data-ready={can ? "1" : undefined}>
                  <div className="fp-cc-card-top">
                    <span className="fp-cc-pts">{r.points}</span>
                    <span className="fp-cc-pts-l">points</span>
                  </div>
                  <h3>{r.name}</h3>
                  <p className="fp-cc-card-w">{rewardValue(r)}</p>
                  <p className="fp-cc-card-x">Use within {r.expiryDays} days of claiming</p>
                  {can ? (
                    <form action={claimReward}>
                      <input type="hidden" name="rewardId" value={r.id} />
                      <button className="btn btn-primary fp-cc-claim">Claim it</button>
                    </form>
                  ) : (
                    <div className="fp-cc-locked">
                      <div className="fp-cc-lockbar"><span style={{ width: `${Math.min(100, Math.round((points / r.points) * 100))}%` }} /></div>
                      <span>{r.points - points} more</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="fp-wrap fp-cc-sec">
        <span className="fp-kicker">Ways to get there faster</span>
        <h2 className="fp-cc-h2">Two of them, and one is free.</h2>
        <div className="fp-cc-ways">
          <div className="fp-cc-way">
            <h3>Order as normal</h3>
            <p>{rate} point per pound, every time. Nothing to remember, nothing to scan.</p>
            <Link href="/menu" className="btn btn-primary">See the menu</Link>
          </div>
          {cfg.referral.enabled ? (
            <div className="fp-cc-way">
              <h3>Send a friend your code</h3>
              <p>They get £{cfg.referral.refereeDiscount} off their first order, you get £{cfg.referral.referrerReward} off yours once they have ordered. No limit.</p>
              <Link href="/account" className="btn btn-secondary">Get my code</Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="fp-wrap fp-cc-sec">
        <span className="fp-kicker">Your points</span>
        <h2 className="fp-cc-h2">Everything in and out.</h2>
        {ledger.length ? (
          <div className="fp-cc-ledger">
            {ledger.map((e) => (
              <div key={e.id}>
                <span>{e.reason}</span>
                <span className="fp-cc-ledger-d">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(e.createdAt)}</span>
                <span className="fp-cc-ledger-n" data-neg={e.delta < 0 ? "1" : undefined}>{e.delta >= 0 ? "+" : ""}{e.delta}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="fp-cc-note">No points yet. They land the moment an order is completed.</p>
        )}
      </section>
    </>
  );
}
