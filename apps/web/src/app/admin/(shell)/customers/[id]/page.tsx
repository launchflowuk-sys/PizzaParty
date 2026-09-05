import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { adjustPoints } from "../../loyalty-actions";

export const dynamic = "force-dynamic";

const DAY = 86400_000;
const days = (ms: number) => Math.round(ms / DAY);

/**
 * How overdue somebody is, judged against their own habit.
 *
 * Deliberately not a "likelihood to order" percentage. A number like 72% would
 * look authoritative and mean nothing - there is no model behind it, and a shop
 * owner would reasonably act on it. What can honestly be said is this: here is
 * the gap this person usually leaves between orders, and here is how long it has
 * actually been. Everything below is that comparison, in words, with the
 * arithmetic shown so it can be argued with.
 *
 * The median gap rather than the mean, because one Christmas order six months
 * out would drag an average badly.
 */
function rhythm(dates: Date[]): {
  gap: number | null;
  since: number | null;
  state: "new" | "due" | "early" | "late" | "lost" | "never";
  line: string;
} {
  if (dates.length === 0) return { gap: null, since: null, state: "never", line: "Has never ordered." };

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const since = days(Date.now() - sorted[sorted.length - 1]!.getTime());

  if (sorted.length < 3) {
    return {
      gap: null, since, state: "new",
      line: `Only ${sorted.length} order${sorted.length === 1 ? "" : "s"} so far — not enough to know their rhythm yet. Last one ${since} day${since === 1 ? "" : "s"} ago.`,
    };
  }

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(days(sorted[i]!.getTime() - sorted[i - 1]!.getTime()));
  gaps.sort((a, b) => a - b);
  const gap = gaps[Math.floor(gaps.length / 2)]!;

  const ratio = gap > 0 ? since / gap : 0;
  if (ratio < 0.75) return { gap, since, state: "early", line: `Orders about every ${gap} days and it has been ${since}. Not due yet.` };
  if (ratio < 1.4) return { gap, since, state: "due", line: `Orders about every ${gap} days and it has been ${since}. Due around now.` };
  if (ratio < 3) return { gap, since, state: "late", line: `Orders about every ${gap} days but it has been ${since}. Overdue — worth a nudge.` };
  return { gap, since, state: "lost", line: `Orders about every ${gap} days and it has been ${since}. Long gone by their own standards.` };
}

const STATE_TONE: Record<string, string> = {
  early: "tag tag-ok", due: "tag tag-warn", late: "tag tag-danger",
  lost: "tag tag-danger", new: "tag tag-neutral", never: "tag tag-neutral",
};
const STATE_LABEL: Record<string, string> = {
  early: "Not due yet", due: "Due now", late: "Overdue",
  lost: "Probably lost", new: "Still new", never: "Never ordered",
};

/**
 * One customer, in full.
 *
 * A proper screen rather than a panel over the list, because this is something
 * a manager sits and reads - who they are, what they order, whether the shop is
 * keeping them - and half of that does not fit in a drawer.
 */
export default async function CustomerFile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string; e?: string }>;
}) {
  await requireScreen("customers");
  const client = await getClientRow();
  const cfg = getConfig();
  const { id } = await params;
  const { m, e } = await searchParams;

  const customer = await prisma.customer.findFirst({
    where: { id, clientId: client.id },
    include: {
      addresses: { orderBy: { createdAt: "desc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: { select: { name: true, qty: true, sizeName: true, lineTotal: true } }, location: { select: { name: true } } },
      },
      loyalty: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (!customer) notFound();

  const back = `/admin/customers/${customer.id}`;
  const paid = customer.orders.filter((o) => o.status === "completed");
  const failed = customer.orders.filter((o) => o.status === "cancelled" || o.status === "rejected");
  const r = rhythm(paid.map((o) => o.createdAt));

  const avg = paid.length ? Math.round(paid.reduce((a, o) => a + o.total, 0) / paid.length) : 0;
  const first = paid.length ? paid[paid.length - 1]!.createdAt : null;
  const known = first ? days(Date.now() - first.getTime()) : 0;

  // What they actually order, counted across every completed order.
  const tally = new Map<string, number>();
  for (const o of paid) for (const it of o.items) tally.set(it.name, (tally.get(it.name) ?? 0) + it.qty);
  const favourites = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const delivery = paid.filter((o) => o.fulfilment === "delivery").length;

  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            <Link href="/admin/customers" style={{ color: "inherit" }}>Customers</Link>
            {" "}&middot; {customer.guest ? "Guest" : "Account"}
            {customer.marketingOptIn ? <> &middot; <span className="fp-num-ok">Opted in</span></> : <> &middot; opted out</>}
          </span>
          <h1>{customer.name || customer.phone}</h1>
        </div>
      </header>

      <AdminNotice message={m} error={e} back={back} />

      {/* ---- The numbers ---- */}
      <div className="fp-stats4" style={{ marginBottom: 20 }}>
        <div className="fp-statcell"><span className="l">Orders</span><span className="n" style={{ color: "var(--color-text)" }}>{paid.length}</span></div>
        <div className="fp-statcell"><span className="l">Spent</span><span className="n" style={{ color: "var(--color-text)" }}>{gbp(customer.totalSpent)}</span></div>
        <div className="fp-statcell"><span className="l">Average basket</span><span className="n" style={{ color: "var(--color-text)" }}>{avg ? gbp(avg) : "—"}</span></div>
        <div className="fp-statcell"><span className="l">Customer for</span><span className="n" style={{ color: "var(--color-text)" }}>{known ? `${known}d` : "—"}</span></div>
      </div>

      {/* ---- Where the relationship stands ---- */}
      <div className="fp-panel">
        <header>
          <span>Where things stand</span>
          <span className={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</span>
        </header>
        <div className="body">
          <p style={{ fontSize: 15, margin: 0, maxWidth: "68ch" }}>
            {r.line}
            <HelpSpot title="Is this a prediction?" article="customers" anchor="read-only">
              No, and deliberately not. There is no model behind it and a percentage would look far more
              authoritative than it deserved. All this does is compare the gap this person usually leaves
              between orders against how long it has actually been — arithmetic you can check yourself
              against the order list below.
            </HelpSpot>
          </p>
          {failed.length > 0 ? (
            <p style={{ fontSize: 14, color: "var(--danger)", margin: "10px 0 0", fontWeight: 600 }}>
              {failed.length} order{failed.length === 1 ? "" : "s"} cancelled or rejected — worth a look before sending them anything.
            </p>
          ) : null}
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "10px 0 0" }}>
            First ordered {fmt(first)} &middot; last {fmt(customer.lastOrderAt)} &middot;{" "}
            {paid.length ? `${Math.round((delivery / paid.length) * 100)}% delivery` : "no orders yet"}
          </p>
        </div>
      </div>

      {/* ---- Who they are ---- */}
      <div className="fp-panel" style={{ marginTop: 16 }}>
        <header><span>Details</span></header>
        <div className="body" style={{ display: "grid", gap: 8, fontSize: 14 }}>
          <div><strong>Phone</strong> &nbsp;<a href={`tel:${customer.phone}`}>{customer.phone}</a></div>
          <div><strong>Email</strong> &nbsp;{customer.email || <span style={{ color: "var(--color-neutral-700)" }}>none given</span>}</div>
          <div><strong>Marketing</strong> &nbsp;{customer.marketingOptIn ? "Opted in" : `Opted out${customer.optOutAt ? ` on ${fmt(customer.optOutAt)}` : ""}${customer.optOutSource ? ` (${customer.optOutSource})` : ""}`}</div>
          {customer.referralCode ? <div><strong>Referral code</strong> &nbsp;<code>{customer.referralCode}</code></div> : null}
          <div style={{ marginTop: 6 }}>
            <strong>Addresses</strong>
            {customer.addresses.length === 0 ? (
              <span style={{ color: "var(--color-neutral-700)" }}> &nbsp;none saved{customer.lastPostcode ? ` — last delivered to ${customer.lastPostcode}` : ""}</span>
            ) : (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {customer.addresses.map((a) => (
                  <li key={a.id} style={{ marginBottom: 2 }}>
                    {[a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ---- What they order ---- */}
      {favourites.length > 0 ? (
        <div className="fp-panel" style={{ marginTop: 16 }}>
          <header><span>What they order</span></header>
          <div className="body" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {favourites.map(([name, n]) => (
              <span key={name} className="tag tag-ok">{name} &times;{n}</span>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- Loyalty ---- */}
      {cfg.loyalty.enabled ? (
        <div className="fp-panel" style={{ marginTop: 16 }}>
          <header>
            <span>Rewards club</span>
            <span style={{ fontWeight: 700, opacity: .85 }}>{customer.loyaltyPoints} points</span>
          </header>
          <div className="body">
            <form action={adjustPoints} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
              <input type="hidden" name="back" value="/admin/customers" />
              <input type="hidden" name="customerId" value={customer.id} />
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                Points
                <input name="delta" className="input" inputMode="numeric" placeholder="+50" style={{ display: "block", marginTop: 4, width: 90 }} />
              </label>
              <label style={{ flex: "1 1 240px", fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
                Reason — the customer sees this
                <input name="reason" className="input" placeholder="Sorry about Friday" style={{ display: "block", marginTop: 4, width: "100%" }} />
              </label>
              <button className="btn btn-secondary">Apply</button>
            </form>
            {customer.loyalty.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: 0 }}>No points movement yet.</p>
            ) : (
              <div style={{ borderTop: "1px solid var(--color-divider)" }}>
                {customer.loyalty.map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
                    <span>{l.reason}</span>
                    <span style={{ color: "var(--color-neutral-700)", whiteSpace: "nowrap" }}>{fmt(l.createdAt)}</span>
                    <span style={{ fontWeight: 800, color: l.delta >= 0 ? "var(--ok)" : "var(--danger)" }}>{l.delta >= 0 ? "+" : ""}{l.delta}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ---- Every order ---- */}
      <div className="fp-panel" style={{ marginTop: 16 }}>
        <header>
          <span>Order history</span>
          <span style={{ fontWeight: 700, opacity: .85 }}>{customer.orders.length}</span>
        </header>
        <div className="body" style={{ padding: 0 }}>
          {customer.orders.length === 0 ? (
            <p style={{ padding: "14px 16px", margin: 0, fontSize: 14, color: "var(--color-neutral-700)" }}>
              Nothing yet. They gave you their number and have not ordered — the best possible person to send a first-order code to.
            </p>
          ) : customer.orders.map((o) => {
            const bad = o.status === "cancelled" || o.status === "rejected";
            return (
              <div key={o.id} style={{
                padding: "12px 16px", borderBottom: "1px solid var(--color-divider)",
                background: bad ? "var(--danger-bg)" : undefined,
                boxShadow: bad ? "inset 4px 0 0 var(--danger)" : undefined,
              }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700 }}>
                    #{o.number}
                    <span style={{ fontWeight: 400, color: "var(--color-neutral-700)" }}>
                      {" "}&middot; {fmt(o.createdAt)} &middot; {o.fulfilment} &middot; {o.location.name}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span className={bad ? "tag tag-danger" : "tag tag-ok"}>{o.status.replace(/_/g, " ")}</span>
                    <strong>{gbp(o.total)}</strong>
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--color-neutral-800)" }}>
                  {o.items.map((it) => `${it.qty}× ${it.name}${it.sizeName ? ` (${it.sizeName})` : ""}`).join(", ") || "—"}
                </p>
                {o.notes ? (
                  <p style={{ margin: "4px 0 0", fontSize: 13, fontStyle: "italic", color: "var(--color-neutral-700)" }}>&ldquo;{o.notes}&rdquo;</p>
                ) : null}
                {o.rejectReason ? (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>Rejected: {o.rejectReason}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
