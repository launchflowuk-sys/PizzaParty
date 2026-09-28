import Link from "next/link";
import { Kaushan_Script } from "next/font/google";
import { liveSlots } from "@/lib/promo-slots";
import { gbpShort } from "@/lib/money";

const script = Kaushan_Script({ subsets: ["latin"], weight: ["400"], variable: "--font-promo-script", display: "swap" });

/** Last word of the title in the brand colour, the way the till's customer display sets it. */
function splitTitle(title: string): [string, string] {
  const t = title.trim();
  const i = t.lastIndexOf(" ");
  return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : ["", t];
}

/**
 * The shop's own offers, on the website, as full-width banners under the hero.
 *
 * The same records the app, the customer display and the kiosk read, so an offer
 * cannot be running in one place and missing from another. One offer is one
 * banner; several scroll sideways, one per screen, so the menu is never pushed
 * a long way down.
 *
 * Renders nothing at all when there are none. An empty "Offers" heading tells a
 * customer the shop has no offers, which is worse than not asking the question.
 */
export async function PromoStrip() {
  const slots = await liveSlots();
  if (slots.length === 0) return null;

  return (
    <section className={`fp-offers ${script.variable}`} aria-label="Offers">
      <div className="fp-wrap">
        <div className="fp-offers-track" data-count={slots.length}>
          {slots.map((s) => {
            const [lead, last] = splitTitle(s.title);
            return (
              <Link key={s.id} href={s.target ? `/deals/${s.target}` : "/menu"} className="fp-offer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="fp-offer-photo" src={s.imageUrl} alt="" loading="lazy" />
                <div className="fp-offer-text">
                  <span className="fp-offer-eyebrow">Special offer</span>
                  <strong className="fp-offer-title">
                    {lead ? <>{lead} </> : null}<em>{last}</em>
                  </strong>
                  {s.subtitle ? <span className="fp-offer-sub">{s.subtitle}</span> : null}
                  <span className="fp-offer-row">
                    {s.price != null ? <span className="fp-offer-price">{gbpShort(s.price)}</span> : null}
                    <span className="fp-offer-cta">Order now <span aria-hidden="true">→</span></span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
