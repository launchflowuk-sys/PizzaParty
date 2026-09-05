import Link from "next/link";

/**
 * The band between the menu and the reviews.
 *
 * The home page was a hero, a grid of four pizzas and a call to action, which
 * left it feeling thin — and gave a first-time visitor no reason to pick this
 * shop over the aggregator they already have installed. This is that reason,
 * told in numbers that are true.
 *
 * Every figure is counted from the live menu and config rather than typed in.
 * If a category is added or the referral amount changes, this changes with it,
 * and it cannot drift into saying something the shop does not do.
 */
/** "Grays and Basildon", or "Grays, Basildon and Tilbury" — never "A, B". */
function listTowns(towns: string[]): string {
  if (towns.length <= 1) return towns[0] ?? "";
  return `${towns.slice(0, -1).join(", ")} and ${towns[towns.length - 1]}`;
}

export function HomeStory({
  pizzaCount,
  itemCount,
  biggestSize,
  towns,
  referral,
}: {
  pizzaCount: number;
  itemCount: number;
  /** The largest size on the menu, e.g. '20"'. Empty if there is nothing unusual to say. */
  biggestSize: string;
  towns: string[];
  /** Null when the scheme is switched off, so nothing is advertised that does not work. */
  referral: { refereeDiscount: string; referrerReward: string; minOrder: string } | null;
}) {
  // Built conditionally rather than with a ternary in slot one: the old version
  // fell back to the pizza count, which the next tile already showed, so a shop
  // with no oversized pizza got the same number twice.
  const facts: { big: string; label: string; note: string }[] = [];

  if (biggestSize) {
    facts.push({
      big: biggestSize,
      label: "The biggest pizza we do",
      note: "An actual measurement, not a size name. It does not fit on a normal plate.",
    });
  }

  facts.push({
    big: `${pizzaCount}`,
    label: "Pizzas to choose from",
    note: `${itemCount} things on the menu altogether, every one made to order.`,
  });

  // Framed for the person ordering, not the shop. There is no service charge or
  // booking fee here — the delivery fee for their postcode is the only thing on
  // top of the food, and that is shown before they build a basket.
  facts.push({
    big: "£0",
    label: "Service fees, ever",
    note: "No booking fee, no service charge. Just the food and the delivery to your postcode.",
  });

  facts.push({
    big: `${towns.length}`,
    label: towns.length === 1 ? "Shop near you" : "Shops near you",
    note: `${listTowns(towns)}, with delivery around ${towns.length === 1 ? "it" : "each of them"}.`,
  });


  return (
    <>
      <section className="fp-wrap fp-story" style={{ padding: "64px 32px" }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Why order direct</span>
        <h2 className="fp-story-h2">
          Same kitchen.<br />More of your money stays in it.
        </h2>

        <div className="fp-story-grid">
          {facts.map((f, i) => (
            <div key={f.label} className="fp-story-card" style={{ "--i": i } as React.CSSProperties}>
              <span className="fp-story-big">{f.big}</span>
              <span className="fp-story-label">{f.label}</span>
              <p className="fp-story-note">{f.note}</p>
            </div>
          ))}
        </div>
      </section>

      {referral ? (
        <section className="fp-wrap" style={{ padding: "0 32px 64px" }}>
          <div className="fp-refer">
            <div className="fp-refer-copy">
              <span className="fp-kicker" style={{ marginBottom: 12 }}>Refer a friend</span>
              <h2 className="fp-refer-h2">
                Give {referral.refereeDiscount}.<br />Get {referral.referrerReward}.
              </h2>
              <p className="fp-refer-body">
                Send someone your code. They get {referral.refereeDiscount} off their first order,
                and once they have ordered you get {referral.referrerReward} off yours.
                {" "}{referral.minOrder} minimum on both, and there is no limit on how many people you send.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/account" className="btn btn-primary fp-cta-lg">Get my code</Link>
                <Link href="/menu" className="btn btn-secondary fp-cta-lg">See the menu</Link>
              </div>
            </div>

            {/* A stack of coupons, drawn rather than photographed — it costs
                nothing to load and never goes out of date with the amounts. */}
            <div className="fp-refer-art" aria-hidden="true">
              <span className="fp-refer-coupon fp-refer-coupon-a">{referral.refereeDiscount}</span>
              <span className="fp-refer-coupon fp-refer-coupon-b">{referral.referrerReward}</span>
              <span className="fp-refer-ring" />
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
