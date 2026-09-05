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
    <span aria-label={`${n} out of 5`} className="fp-rv-stars">
      {"★".repeat(n)}
      <span className="fp-rv-stars-off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/** First letter of the first name, for the little coloured disc. */
const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

/**
 * Six warm hues, picked by name so the same person always gets the same disc.
 * A hash rather than the index, or the colours would shuffle every time the
 * order changed.
 */
const DISC = ["#C82323", "#3E6B48", "#B3671B", "#7A3E8F", "#1F6F7A", "#A8442B"];
function disc(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DISC[h % DISC.length]!;
}

function Card({ r }: { r: Review }) {
  return (
    <article className="fp-rv-card">
      <div className="fp-rv-head">
        <span className="fp-rv-disc" style={{ background: disc(r.customerName) }} aria-hidden="true">
          {initial(r.customerName)}
        </span>
        <div className="fp-rv-who">
          <strong>{r.customerName}</strong>
          <Stars n={r.rating} />
        </div>
        {r.source === "google" ? <span className="fp-rv-src">Google</span> : null}
      </div>
      <p className="fp-rv-body">&ldquo;{r.body}&rdquo;</p>
    </article>
  );
}

/**
 * What customers said, drifting across the home page.
 *
 * Two rows travelling in opposite directions, which reads as a busy shop rather
 * than a grid of testimonials sitting still. The trick is duplicating each row
 * and moving the track exactly half its width: the second copy arrives where
 * the first began, so the loop has no seam and no JavaScript.
 *
 * The duplicate is hidden from screen readers, or every review would be read
 * out twice. Anybody who has asked for reduced motion gets the rows standing
 * still, wrapped rather than scrolling.
 *
 * These are real reviews - from Google and from people who ordered here. The
 * rows are never padded out to look fuller, and the section renders nothing at
 * all when there is nothing worth showing.
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

  // Split into two rows. With an odd number the top row takes the extra, so the
  // rows never differ by more than one card.
  const half = Math.ceil(reviews.length / 2);
  const rows = [reviews.slice(0, half), reviews.slice(half)].filter((r) => r.length > 0);

  return (
    <section className="fp-rv">
      <div className="fp-wrap fp-rv-head-wrap">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 10 }}>What people say</span>
          <h2 className="fp-rv-h2">{summary.average.toFixed(1)} out of 5</h2>
          <p className="fp-rv-count">
            from {summary.count} review{summary.count === 1 ? "" : "s"}
          </p>
        </div>
        {reviewUrl ? (
          <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Leave a review
          </a>
        ) : null}
      </div>

      {rows.map((row, i) => (
        <div className="fp-rv-rail" key={i}>
          {/* Direction alternates, and the second row runs a touch slower so the
              two never fall into step and read as one moving block. */}
          <div className="fp-rv-track" data-dir={i % 2 === 0 ? "left" : "right"} style={{ "--speed": `${46 + i * 9}s` } as React.CSSProperties}>
            {row.map((r) => <Card key={r.id} r={r} />)}
            {/* The seamless half. Hidden from assistive tech: it is the same
                reviews again, not more of them. */}
            <div className="fp-rv-dupe" aria-hidden="true">
              {row.map((r) => <Card key={`dupe-${r.id}`} r={r} />)}
            </div>
          </div>
        </div>
      ))}

      {reviews.some((r) => r.externalUrl) ? (
        <div className="fp-wrap fp-rv-foot">
          <Link
            href={reviews.find((r) => r.externalUrl)?.externalUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read them on Google &rarr;
          </Link>
        </div>
      ) : null}
    </section>
  );
}
