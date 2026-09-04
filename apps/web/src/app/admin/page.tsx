import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const client = await getClientRow();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const week = new Date(Date.now() - 7 * 86400_000);
  const [today, weekAgg, live, recent, customers] = await Promise.all([
    prisma.order.aggregate({ where: { clientId: client.id, placedAt: { gte: start }, status: { notIn: ["pending_payment", "cancelled", "rejected"] } }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { clientId: client.id, placedAt: { gte: week }, status: { notIn: ["pending_payment", "cancelled", "rejected"] } }, _sum: { total: true }, _count: true }),
    prisma.order.count({ where: { clientId: client.id, status: { in: ["placed", "accepted", "preparing", "ready", "out_for_delivery"] } } }),
    prisma.order.findMany({ where: { clientId: client.id, status: { not: "pending_payment" } }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.customer.count({ where: { clientId: client.id, ordersCount: { gt: 0 } } }),
  ]);
  const Stat = ({ l, v }: { l: string; v: string }) => <div className="lf-card p-4"><p className="text-xs text-muted">{l}</p><p className="text-2xl font-extrabold mt-1">{v}</p></div>;
  return (
    <div>
      <h1 className="lf-h2">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Stat l="Today" v={`${gbp(today._sum.total ?? 0)} · ${today._count}`} />
        <Stat l="Last 7 days" v={`${gbp(weekAgg._sum.total ?? 0)} · ${weekAgg._count}`} />
        <Stat l="Live orders" v={String(live)} />
        <Stat l="Customers" v={String(customers)} />
      </div>
      <h2 className="font-bold mt-8">Recent orders</h2>
      <table className="w-full text-sm mt-2 lf-card">
        <tbody>{recent.map((o) => (
          <tr key={o.id} className="border-b border-line"><td className="p-2 font-semibold"><Link href={`/order/${o.id}`}>#{o.number}</Link></td><td className="p-2">{o.customerName}</td><td className="p-2">{o.fulfilment}</td><td className="p-2">{STATUS_LABEL[o.status]}</td><td className="p-2 text-right">{gbp(o.total)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
