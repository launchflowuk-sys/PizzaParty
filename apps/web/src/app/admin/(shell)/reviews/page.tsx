import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { replyToReview, syncReviewsNow, toggleReviewHidden, toggleReviewFeatured } from "../actions";
import { googleReviewsConfigured } from "@/lib/google-reviews";
import { getConfig } from "@/lib/config";
import { HelpSpot } from "@/components/admin/HelpSpot";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Reviews from `Farm Pizza Admin.dc.html`: a rating summary rail on the left and a
 *  ruled list of reviews on the right, each replyable. */
export default async function ReviewsPage() {
  await requireScreen("reviews");
  const client = await getClientRow();
  const reviews = await prisma.review.findMany({
    where: { clientId: client.id },
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  const googleOn = googleReviewsConfigured();
  const cfg = getConfig();
  const fromGoogle = reviews.filter((r) => r.source === "google").length;

  const n = reviews.length;
  const avg = n ? reviews.reduce((a, r) => a + r.rating, 0) / n : 0;
  const unanswered = reviews.filter((r) => !r.reply).length;
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, n: reviews.filter((r) => r.rating === star).length }));

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>
            Reviews
            <HelpSpot title="What do Hide and Pin change?" article="reviews" anchor="hide-and-pin-change-the-website">
              The website, not this page. Hiding takes a review off the home page and out of the
              score shown there; it never deletes it, it stays in the list below, and it does
              nothing at all to Google. Pinning moves it to the front of that same strip &mdash;
              which only ever shows reviews of 4 stars or more that have some text written in them,
              so pinning anything else changes nothing anybody can see.
            </HelpSpot>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
            {unanswered} awaiting a reply
            <HelpSpot title="Why does this number not go down?" article="reviews" anchor="awaiting-a-reply-never-reaches-zero">
              It counts every review with no reply saved against it here, and a Google review has no
              reply box on this screen &mdash; those are answered on Google, and the answer never
              comes back to us. So Google reviews sit in this count whether or not you have dealt
              with them.
            </HelpSpot>
          </span>
          {googleOn ? (
            <form action={syncReviewsNow}>
              <button className="btn btn-secondary">Pull from Google</button>
            </form>
          ) : null}
        </div>
      </header>

      <div className="fp-panel" data-tone={googleOn ? undefined : "warn"} style={{ maxWidth: "78ch" }}>
        <header>Google reviews</header>
        <div className="body" style={{ fontSize: 13, lineHeight: 1.6 }}>
          {googleOn ? (
            <>
              <p style={{ marginTop: 0 }}>
                Connected. {fromGoogle} of the reviews below came from Google, pulled once a day.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Google only ever gives back five.</strong> Not the latest five you can page
                through &mdash; five in total, chosen by Google. There is no paid tier that returns
                more, so this is a rolling window of what Google is showing today rather than a
                full archive.
              </p>
              <p style={{ margin: "10px 0 0" }}>
                <strong>Replies have to be typed on Google.</strong> The API can read reviews but
                not answer them, so each Google review below carries a link straight to it. A reply
                typed here would go nowhere, so it is not offered.
              </p>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>
                Not connected yet. Two things are needed, and neither is a code change:
              </p>
              <ol style={{ margin: "0 0 10px", paddingLeft: 20 }}>
                <li><code>GOOGLE_PLACES_API_KEY</code> on the server, from a Google Cloud project with the Places API enabled.</li>
                <li><code>contact.googlePlaceId</code> in <code>config/{cfg.slug}/client.json</code> &mdash; the shop&rsquo;s Place ID.</li>
              </ol>
              <p style={{ margin: 0, color: "var(--color-neutral-700)" }}>
                Until then everything below is reviews left through this site.
              </p>
            </>
          )}
        </div>
      </div>

      {n === 0 ? (
        <p style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>
          No reviews yet. Seed some in <code>config/{client.slug}/ops.json</code>, or wire review
          requests to order receipts.
        </p>
      ) : (
        <div className="fp-split-shops">
          <div>
            <span className="fp-kicker" style={{ marginBottom: 12 }}>
              Rating
              <HelpSpot title="Is this our Google rating?" article="reviews" anchor="the-big-number-is-not-your-google-rating">
                No. It is the average of the fifty reviews shown on this page, Google ones and
                direct ones together, and it counts any you have hidden from the website. Your
                Google listing keeps its own score, and this will not match it.
              </HelpSpot>
            </span>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 96, lineHeight: 0.95, letterSpacing: "-.03em", color: "var(--color-accent)", marginLeft: "-.04em" }}>
              {avg.toFixed(1)}
            </div>
            <p style={{ fontSize: 14, margin: "8px 0 20px", color: "var(--color-neutral-700)" }}>
              from {n} review{n === 1 ? "" : "s"}
            </p>
            <div style={{ borderTop: "2px solid var(--color-divider)" }}>
              {counts.map((c) => (
                <div key={c.star} style={{ display: "grid", gridTemplateColumns: "28px 1fr 28px", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-divider)" }}>
                  <span style={{ fontWeight: 600 }}>{c.star}★</span>
                  <div style={{ height: 10, background: "var(--color-surface)" }}>
                    <div style={{ height: "100%", background: "var(--color-accent)", width: `${n ? (c.n / n) * 100 : 0}%` }} />
                  </div>
                  <span style={{ textAlign: "right", color: "var(--color-neutral-700)" }}>{c.n}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="fp-kicker" style={{ marginBottom: 12 }}>
              Latest
              <HelpSpot title="Can I change a reply after saving it?" article="reviews" anchor="you-cannot-edit-a-reply">
                No. The box disappears the moment you save, and there is no edit and no delete. The
                customer is not told about it either way, so a reply written in temper on a Friday
                night simply sits there. Read it back before you press Reply.
              </HelpSpot>
            </span>
            <div style={{ borderTop: "2px solid var(--color-divider)" }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--color-divider)", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>
                      {r.customerName}
                      <span style={{ color: "var(--color-accent)", marginLeft: 10 }}>{"★".repeat(r.rating)}<span style={{ color: "var(--color-neutral-400)" }}>{"★".repeat(5 - r.rating)}</span></span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
                      {r.source === "google" ? "Google" : "Direct"} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(r.postedAt ?? r.createdAt)}
                      {r.hidden ? <span className="tag tag-warn" style={{ marginLeft: 8 }}>Hidden</span> : null}
                    </span>
                  </div>

                  {r.body ? <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-800)" }}>{r.body}</p> : null}

                  {r.reply ? (
                    <div style={{ borderLeft: "4px solid var(--color-accent)", paddingLeft: 12, fontSize: 14 }}>
                      <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-700)", display: "block", marginBottom: 2 }}>
                        Your reply
                      </span>
                      {r.reply}
                    </div>
                  ) : r.source === "google" ? (
                    /* The Places API is read-only, so the only honest thing to
                       offer is the door to where replying actually works. */
                    r.externalUrl ? (
                      <a href={r.externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ justifySelf: "start" }}>
                        Reply on Google &rarr;
                      </a>
                    ) : null
                  ) : (
                    <form action={replyToReview} style={{ display: "flex", gap: 8 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input name="reply" className="input" maxLength={1000} placeholder="Reply to this review…" aria-label={`Reply to ${r.customerName}`} required />
                      <button className="btn btn-primary">Reply</button>
                    </form>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <form action={toggleReviewHidden}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className={r.hidden ? "btn btn-warn" : "btn btn-secondary"}>
                        {r.hidden ? "Hidden — show it again" : "Hide from the website"}
                      </button>
                    </form>
                    <form action={toggleReviewFeatured}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className={r.featured ? "btn btn-ok" : "btn btn-secondary"}>
                        {r.featured ? "★ Pinned" : "☆ Pin to the top"}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
