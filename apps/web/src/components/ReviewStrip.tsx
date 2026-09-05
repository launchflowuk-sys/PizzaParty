import Link from "next/link";

type Review = {
  id: string;
  customerName: string;
  rating: number;
  body: string;
  source: string;
  reply: string;
  externalUrl: string;
  postedAt: Date | null;
  createdAt: Date;
};

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n} out of 5`} style={{ color: "var(--color-accent)", letterSpacing: "1px", fontSize: 15 }}>
      {"★".repeat(n)}
      <span style={{ color: "var(--color-neutral-400)" }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

/**
 * What customers said, on the home page.
 *
 * Real reviews from Google and from people who ordered here, not testimonials
 * someone typed. Each Google one links back to itself on Google, which is both
 * honest and the only place the shop can reply to it.
 *
 * Renders nothing at all when there is nothing worth showing - an empty
 * "reviews" heading with a placeholder under it is worse than no section.
 */
export function ReviewStrip({
  reviews,
  summary,
  reviewUrl,
}: {
  reviews: Review[];
  summary: { count: number; average: number };
  reviewUrl: string;
}) {
  if (reviews.length === 0) return null;

  return (
    <section className="fp-wrap" style={{ padding: "56px 32px" }}>
      <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <span className="fp-kicker" style={{ marginBottom: 10 }}>What people say</span>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 36, letterSpacing: "-.02em", margin: 0, lineHeight: 1.05 }}>
            {summary.average.toFixed(1)} out of 5
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--color-neutral-700)" }}>
            from {summary.count} review{summary.count === 1 ? "" : "s"}
          </p>
        </div>
        {reviewUrl ? (
          <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Leave a review
          </a>
        ) : null}
      </div>

      <div className="fp-grid fp-grid-3">
        {reviews.map((r) => (
          <article key={r.id} className="fp-cell" style={{ padding: 18, gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Stars n={r.rating} />
              {r.source === "google" ? (
                <span style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-neutral-700)", fontWeight: 700 }}>
                  Google
                </span>
              ) : null}
            </div>

            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, flex: 1 }}>
              &ldquo;{r.body}&rdquo;
            </p>

            <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
              <strong style={{ color: "var(--color-text)" }}>{r.customerName}</strong>
              {(r.postedAt ?? r.createdAt) ? (
                <> &middot; {(r.postedAt ?? r.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</>
              ) : null}
            </div>

            {r.reply ? (
              <div style={{ borderLeft: "3px solid var(--color-accent-2)", paddingLeft: 12, fontSize: 13, lineHeight: 1.55, color: "var(--color-neutral-800)" }}>
                <strong>Our reply:</strong> {r.reply}
              </div>
            ) : null}

            {r.externalUrl ? (
              <Link href={r.externalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                Read it on Google &rarr;
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
