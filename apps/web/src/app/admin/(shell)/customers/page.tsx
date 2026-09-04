import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { SEGMENTS, segmentWhere } from "@/lib/segments";

export const dynamic = "force-dynamic";

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string; segment?: string }> }) {
  const sp = await searchParams;
  const client = await getClientRow();
  const where = { clientId: client.id, ordersCount: { gt: 0 }, ...(sp.segment ? segmentWhere(sp.segment) : {}), ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" as const } }, { phone: { contains: sp.q } }, { email: { contains: sp.q, mode: "insensitive" as const } }] } : {}) };
  const [customers, counts] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { lastOrderAt: "desc" }, take: 200 }),
    Promise.all(SEGMENTS.map(async (s) => ({ ...s, n: await prisma.customer.count({ where: { clientId: client.id, marketingOptIn: true, ...segmentWhere(s.key) } }) }))),
  ]);
  return (
    <div>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Customers</h1>
        </div>
      </header>
      <div className="flex flex-wrap gap-2 mt-3 text-sm">{counts.map((s) => <a key={s.key} href={`?segment=${s.key}`} className={`lf-pill border ${sp.segment === s.key ? "bg-ink text-white" : "bg-surface border-line"}`}>{s.label}: {s.n} opted in</a>)}</div>
      <form className="mt-3 flex gap-2"><input name="q" placeholder="Search name, phone, email" defaultValue={sp.q} className="lf-input max-w-sm" /><button className="lf-btn lf-btn-ghost">Search</button></form>
      <div className="overflow-x-auto mt-3"><table className="table" style={{ width: "100%" }}>
        <thead><tr className="text-left border-b border-line"><th className="p-2">Name</th><th className="p-2">Phone</th><th className="p-2">Orders</th><th className="p-2">Spent</th><th className="p-2">Last order</th><th className="p-2">Marketing</th></tr></thead>
        <tbody>{customers.map((c) => (
          <tr key={c.id} className="border-b border-line"><td className="p-2">{c.name || <span className="text-muted">—</span>}{c.email ? <span className="block text-xs text-muted">{c.email}</span> : null}</td><td className="p-2">{c.phone}</td><td className="p-2">{c.ordersCount}</td><td className="p-2">{gbp(c.totalSpent)}</td><td className="p-2">{c.lastOrderAt?.toLocaleDateString("en-GB") ?? ""}</td><td className="p-2">{c.marketingOptIn ? "✓" : ""}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
