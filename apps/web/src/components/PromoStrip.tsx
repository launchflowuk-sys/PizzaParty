import Link from "next/link";
import { liveSlots } from "@/lib/promo-slots";
import { gbpShort } from "@/lib/money";

/**
 * The shop's own offers, on the website.
 *
 * The same records the app reads, so an offer cannot be running in one place
 * and missing from the other - which is what happens the moment a shop has two
 * places to type the same promotion into.
 *
 * Renders nothing at all when there are none. An empty "Offers" heading tells a
 * customer the shop has no offers, which is worse than not asking the question.
 */
export async function PromoStrip() {
  const slots = await liveSlots();
  if (slots.length === 0) return null;

  return (
    <section className="fp-promo-strip" aria-label="Offers">
      <div className="fp-promo-strip-inner">
        {slots.map((s) => (
          <Link
            key={s.id}
            href={s.target ? `/deals/${s.target}` : "/menu"}
            className="fp-promo-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.imageUrl} alt="" loading="lazy" />
            <div className="fp-promo-card-body">
              <strong>{s.title}</strong>
              {s.subtitle ? <span>{s.subtitle}</span> : null}
              {s.price != null ? <em>{gbpShort(s.price)}</em> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
