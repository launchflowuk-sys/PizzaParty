import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { SEGMENTS, segmentWhere, segmentLabel } from "@/lib/segments";

export const dynamic = "force-dynamic";

/** The customer list, cut by the segments the campaign screen sends to. */
export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string; segment?: string }> }) {
  await requireScreen("customers");
  const sp = await searchParams;
  const client = await getClientRow();

  const where = {
    clientId: client.id,
    ordersCount: { gt: 0 },
    ...(sp.segment ? segmentWhere(sp.segment) : {}),
    ...(sp.q
      ? { OR: [
          { name: { contains: sp.q, mode: "insensitive" as const } },
          { phone: { contains: sp.q } },
          { email: { contains: sp.q, mode: "insensitive" as const } },
        ] }
      : {}),
  };

  const [customers, shown, counts, optedIn] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { lastOrderAt: "desc" }, take: 200 }),
    prisma.customer.count({ where }),
    Promise.all(SEGMENTS.map(async (s) => ({
      ...s,
      n: await prisma.customer.count({ where: { clientId: client.id, marketingOptIn: true, ...segmentWhere(s.key) } }),
    }))),
    prisma.customer.count({ where: { clientId: client.id, marketingOptIn: true } }),
  ]);

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Customers</h1>
        </div>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          {optedIn} of {shown} opted in to marketing
        </span>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <Link href="/admin/customers" className={sp.segment ? "tag tag-neutral" : "tag tag-accent"}>Everyone</Link>
        {counts.map((s) => (
          <a key={s.key} href={`?segment=${s.key}`} className={sp.segment === s.key ? "tag tag-accent" : "tag tag-neutral"} title={s.help}>
            {s.label} &middot; {s.n}
          </a>
        ))}
      </div>

      <form style={{ display: "flex", gap: 8, marginBottom: 20, maxWidth: 460 }}>
        {sp.segment ? <input type="hidden" name="segment" value={sp.segment} /> : null}
        <input name="q" className="input" placeholder="Search name, phone or email" defaultValue={sp.q} />
        <button className="btn btn-secondary">Search</button>
      </form>

      {sp.segment ? (
        <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 16px" }}>
          Showing <strong>{segmentLabel(sp.segment)}</strong> &mdash; {shown} customer{shown === 1 ? "" : "s"}.{" "}
          <Link href="/admin/campaigns">Send this group a message</Link>
        </p>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Name</th><th>Phone</th>
              <th style={{ textAlign: "right" }}>Orders</th>
              <th style={{ textAlign: "right" }}>Spent</th>
              <th>Last order</th><th>Marketing</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={6} style={{ color: "var(--color-neutral-700)" }}>Nobody matches.</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>
                  {c.name || <span style={{ color: "var(--color-neutral-700)", fontWeight: 400 }}>&mdash;</span>}
                  {c.email ? <><br /><span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-neutral-700)" }}>{c.email}</span></> : null}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{c.phone}</td>
                <td style={{ textAlign: "right" }}>{c.ordersCount}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{gbp(c.totalSpent)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{c.lastOrderAt?.toLocaleDateString("en-GB") ?? "—"}</td>
                <td>{c.marketingOptIn ? <span className="tag tag-accent">Opted in</span> : <span className="tag tag-neutral">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown > customers.length ? (
        <p style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 12 }}>
          Showing the {customers.length} most recent of {shown}. Narrow it with a segment or a search.
        </p>
      ) : null}
    </>
  );
}
