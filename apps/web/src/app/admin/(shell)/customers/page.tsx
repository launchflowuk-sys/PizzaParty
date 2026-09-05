import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { SEGMENTS, segmentWhere, segmentLabel } from "@/lib/segments";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { getConfig } from "@/lib/config";
import { adjustPoints } from "../loyalty-actions";

export const dynamic = "force-dynamic";

/** The customer list, cut by the segments the campaign screen sends to. */
export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string; segment?: string; m?: string; e?: string }> }) {
  await requireScreen("customers");
  const sp = await searchParams;
  const client = await getClientRow();
  // The points column only earns its width when the club is actually running.
  const loyaltyOn = getConfig().loyalty.enabled;

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
          <h1>
            Customers
            <HelpSpot title="Can I fix somebody’s details here?" article="customers" anchor="read-only">
              No. This screen only displays. There is no way to correct a misspelled name, merge two
              records for the same person, add a note, block a nuisance customer or delete anybody
              &mdash; that has to go to LaunchFlow, so do not promise a same-day fix.
            </HelpSpot>
          </h1>
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
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <HelpSpot title="Why does a chip count not match the rows?" article="customers" anchor="two-numbers-that-disagree">
            The chip counts the people in that group you are allowed to text &mdash; the ones who
            opted in. The table below shows everyone in the group either way, so you can still look
            somebody up. Forty-one on the chip with sixty rows underneath is not a fault.
          </HelpSpot>
        </span>
      </div>

      <form style={{ display: "flex", gap: 8, marginBottom: 20, maxWidth: 460 }}>
        {sp.segment ? <input type="hidden" name="segment" value={sp.segment} /> : null}
        <input name="q" className="input" placeholder="Search name, phone or email" defaultValue={sp.q} />
        <button className="btn btn-secondary">Search</button>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <HelpSpot title="It cannot find a number I know we have." article="customers" anchor="finding-a-customer">
            The phone search looks for the characters you typed inside the number exactly as it was
            saved, so 07700 900 201 and +447700900201 will not find each other. Try it again without
            the spaces, and with +44 in place of the leading 0.
          </HelpSpot>
        </span>
      </form>

      {sp.segment ? (
        <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 16px" }}>
          Showing <strong>{segmentLabel(sp.segment)}</strong> &mdash; {shown} customer{shown === 1 ? "" : "s"}.{" "}
          <Link href="/admin/campaigns">Send this group a message</Link>
        </p>
      ) : null}

      <AdminNotice message={sp.m} error={sp.e} back="/admin/customers" />

      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Name</th><th>Phone</th>
              <th style={{ textAlign: "right" }}>Orders</th>
              <th style={{ textAlign: "right" }}>Spent</th>
              {loyaltyOn ? (
                <th style={{ textAlign: "right" }}>
                  Points
                  <HelpSpot title="Can I give somebody points by hand?" article="rewards-club" anchor="points-given-by-hand">
                    Yes &mdash; type how many in the box next to their balance, put a reason on it and
                    press Save. A minus number takes points away. The customer sees the reason you type
                    on their rewards page, so write it as you would say it to them.
                  </HelpSpot>
                </th>
              ) : null}
              <th>Last order</th>
              <th>
                Marketing
                <HelpSpot title="Can I opt somebody out from here?" article="customers" anchor="opting-someone-out-by-hand">
                  No, and there is no override anywhere else either. Only the customer can change it
                  &mdash; the tick box at the checkout, or texting STOP to the shop number, which is
                  acted on within seconds. If somebody rings to come off the list, ask them to text
                  STOP.
                </HelpSpot>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={loyaltyOn ? 7 : 6} style={{ color: "var(--color-neutral-700)" }}>Nobody matches.</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>
                  {c.name || <span style={{ color: "var(--color-neutral-700)", fontWeight: 400 }}>&mdash;</span>}
                  {c.email ? <><br /><span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-neutral-700)" }}>{c.email}</span></> : null}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{c.phone}</td>
                <td style={{ textAlign: "right" }}>{c.ordersCount}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{gbp(c.totalSpent)}</td>
                {loyaltyOn ? (
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 700 }}>{c.loyaltyPoints}</span>
                    <form action={adjustPoints} style={{ display: "inline-flex", gap: 4, marginLeft: 8, verticalAlign: "middle" }}>
                      <input type="hidden" name="back" value="/admin/customers" />
                      <input type="hidden" name="customerId" value={c.id} />
                      <input name="delta" className="input" inputMode="numeric" placeholder="+/-" aria-label={`Adjust points for ${c.name || c.phone}`} style={{ width: 56 }} />
                      <input name="reason" className="input" placeholder="Reason" aria-label={`Reason for ${c.name || c.phone}`} style={{ width: 130 }} />
                      <button className="btn btn-secondary">Save</button>
                    </form>
                  </td>
                ) : null}
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
