import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { requireScreen } from "@/lib/session";
import { SEGMENTS, segmentWhere, segmentLabel } from "@/lib/segments";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { PickCustomers } from "@/components/admin/PickCustomers";
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
    // No `ordersCount > 0` filter. Somebody who signed up and never ordered is
    // the most valuable person on this screen to know about, and they used to
    // be invisible here.
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

      <PickCustomers
        loyalty={loyaltyOn}
        adjustPoints={adjustPoints}
        rows={customers.map((c) => ({
          id: c.id,
          name: c.name ?? "",
          email: c.email ?? "",
          phone: c.phone,
          ordersCount: c.ordersCount,
          totalSpent: c.totalSpent,
          lastOrder: c.lastOrderAt?.toLocaleDateString("en-GB") ?? "",
          optIn: c.marketingOptIn,
          points: c.loyaltyPoints,
        }))}
      />

      {shown > customers.length ? (
        <p style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 12 }}>
          Showing the {customers.length} most recent of {shown}. Narrow it with a segment or a search.
        </p>
      ) : null}
    </>
  );
}
