import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { replyToReview } from "../actions";

export const dynamic = "force-dynamic";

/** Reviews from `Farm Pizza Admin.dc.html`: a rating summary rail on the left and a
 *  ruled list of reviews on the right, each replyable. */
export default async function ReviewsPage() {
  const client = await getClientRow();
  const reviews = await prisma.review.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 50 });

  const n = reviews.length;
  const avg = n ? reviews.reduce((a, r) => a + r.rating, 0) / n : 0;
  const unanswered = reviews.filter((r) => !r.reply).length;
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, n: reviews.filter((r) => r.rating === star).length }));

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Reviews</h1>
        </div>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          {unanswered} awaiting a reply
        </span>
      </header>

      {n === 0 ? (
        <p style={{ color: "var(--color-neutral-600)", fontSize: 14 }}>
          No reviews yet. Seed some in <code>config/{client.slug}/ops.json</code>, or wire review
          requests to order receipts.
        </p>
      ) : (
        <div className="fp-split-shops">
          <div>
            <span className="fp-kicker" style={{ marginBottom: 12 }}>Rating</span>
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
                  <span style={{ textAlign: "right", color: "var(--color-neutral-600)" }}>{c.n}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="fp-kicker" style={{ marginBottom: 12 }}>Latest</span>
            <div style={{ borderTop: "2px solid var(--color-divider)" }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--color-divider)", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600 }}>
                      {r.customerName}
                      <span style={{ color: "var(--color-accent)", marginLeft: 10 }}>{"★".repeat(r.rating)}<span style={{ color: "var(--color-neutral-400)" }}>{"★".repeat(5 - r.rating)}</span></span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                      {r.source === "google" ? "Google" : "Direct"} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(r.createdAt)}
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
                  ) : (
                    <form action={replyToReview} style={{ display: "flex", gap: 8 }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input name="reply" className="input" maxLength={1000} placeholder="Reply to this review…" aria-label={`Reply to ${r.customerName}`} required />
                      <button className="btn btn-primary">Reply</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
