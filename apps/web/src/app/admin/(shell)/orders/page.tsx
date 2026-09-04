import Link from "next/link";
import { prisma, type OrderStatus } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";
const STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; from?: string; to?: string; q?: string; page?: string }> }) {
  await requireScreen("orders");
  const sp = await searchParams;
  const client = await getClientRow();
  const page = Math.max(1, Number(sp.page ?? 1));
  const where = {
    clientId: client.id,
    ...(sp.status && STATUSES.includes(sp.status as OrderStatus) ? { status: sp.status as OrderStatus } : { status: { not: "pending_payment" as const } }),
    ...(sp.from ? { createdAt: { gte: new Date(sp.from), ...(sp.to ? { lte: new Date(sp.to + "T23:59:59") } : {}) } } : {}),
    ...(sp.q ? { OR: [{ customerName: { contains: sp.q, mode: "insensitive" as const } }, { customerPhone: { contains: sp.q } }, { deliveryPostcode: { contains: sp.q.toUpperCase() } }] } : {}),
  };
  const [orders, total] = await Promise.all([prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { location: true } }), prisma.order.count({ where })]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office &middot; {total} order{total === 1 ? "" : "s"}</span>
          <h1>Orders</h1>
        </div>
        <a href={`/api/admin/orders.csv?${qs}`} className="btn btn-secondary">Export CSV</a>
      </header>
      <form className="lf-card p-3 mt-3 flex flex-wrap gap-2 text-sm">
        <select name="status" defaultValue={sp.status ?? ""} className="lf-input w-auto"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <input name="from" type="date" defaultValue={sp.from} className="lf-input w-auto" /><input name="to" type="date" defaultValue={sp.to} className="lf-input w-auto" />
        <input name="q" placeholder="Name, phone, postcode" defaultValue={sp.q} className="lf-input w-56" />
        <button className="lf-btn lf-btn-ghost">Filter</button>
      </form>
      <div className="overflow-x-auto mt-3"><table className="table" style={{ width: "100%" }}>
        <thead><tr className="text-left border-b border-line"><th className="p-2">#</th><th className="p-2">When</th><th className="p-2">Customer</th><th className="p-2">Type</th><th className="p-2">Shop</th><th className="p-2">Status</th><th className="p-2 text-right">Total</th></tr></thead>
        <tbody>{orders.map((o) => (
          <tr key={o.id} className="border-b border-line"><td className="p-2 font-semibold"><Link href={`/order/${o.id}`}>#{o.number}</Link></td><td className="p-2 whitespace-nowrap">{o.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td><td className="p-2">{o.customerName}<span className="block text-xs text-muted">{o.customerPhone}</span></td><td className="p-2">{o.fulfilment}<span className="block text-xs text-muted">{o.paymentMethod}</span></td><td className="p-2">{o.location.name}</td><td className="p-2">{STATUS_LABEL[o.status]}</td><td className="p-2 text-right">{gbp(o.total)}</td></tr>
        ))}</tbody>
      </table></div>
      {total > 50 ? <p className="mt-3 text-sm">{page > 1 ? <Link className="underline mr-3" href={`?${new URLSearchParams({ ...sp, page: String(page - 1) })}`}>← Prev</Link> : null}{page * 50 < total ? <Link className="underline" href={`?${new URLSearchParams({ ...sp, page: String(page + 1) })}`}>Next →</Link> : null}</p> : null}
    </div>
  );
}
