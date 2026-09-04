import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow, getLocations } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { availability } from "@/lib/availability";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Dashboard from `Farm Pizza Admin.dc.html`: a ruled row of accent numerals over a
 *  themed table of recent orders. */
export default async function AdminHome() {
  await requireScreen("dashboard");
  const client = await getClientRow();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const week = new Date(Date.now() - 7 * 86400_000);

  const [today, weekAgg, live, recent, customers, locations] = await Promise.all([
    prisma.order.aggregate({ where: { clientId: client.id, placedAt: { gte: start }, status: { notIn: ["pending_payment", "cancelled", "rejected"] } }, _sum: { total: true }, _count: true }),
    prisma.order.aggregate({ where: { clientId: client.id, placedAt: { gte: week }, status: { notIn: ["pending_payment", "cancelled", "rejected"] } }, _sum: { total: true }, _count: true }),
    prisma.order.count({ where: { clientId: client.id, status: { in: ["placed", "accepted", "preparing", "ready", "out_for_delivery"] } } }),
    prisma.order.findMany({ where: { clientId: client.id, status: { not: "pending_payment" } }, orderBy: { createdAt: "desc" }, take: 10, include: { location: { select: { name: true } } } }),
    prisma.customer.count({ where: { clientId: client.id, ordersCount: { gt: 0 } } }),
    getLocations(),
  ]);

  const primary = locations[0];
  const a = primary ? availability(primary) : null;
  const avg = weekAgg._count ? Math.round((weekAgg._sum.total ?? 0) / weekAgg._count) : 0;

  const stats: [string, string][] = [
    [gbp(today._sum.total ?? 0), `Today · ${today._count} order${today._count === 1 ? "" : "s"}`],
    [String(live), "Live in the kitchen"],
    [gbp(avg), "Average order, 7 days"],
    [String(customers), "Customers who have ordered"],
  ];

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            {primary?.name ?? client.name} &middot; {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
          </span>
          <h1>Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13, whiteSpace: "nowrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, background: a?.open ? "var(--color-accent)" : "var(--color-neutral-400)", animation: a?.open ? "fp-pulse 1.4s ease-in-out infinite" : undefined }} />
            {a?.open ? "Taking orders" : a?.paused ? "Paused" : "Closed"}
          </span>
          <Link href="/admin/hours" className="btn btn-secondary">Hours &amp; pause</Link>
        </div>
      </header>

      <div className="fp-stats4">
        {stats.map(([n, l]) => (
          <div key={l} className="fp-statcell">
            <span className="n">{n}</span>
            <span className="l">{l}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>Recent orders</span>
        {recent.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Mode</th><th>Shop</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th></tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}><Link href={`/order/${o.id}`}>#{o.number}</Link></td>
                    <td>{o.customerName}</td>
                    <td>{o.fulfilment === "delivery" ? "Delivery" : "Collection"}</td>
                    <td>{o.location.name}</td>
                    <td>{STATUS_LABEL[o.status]}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{gbp(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>No orders yet.</p>
        )}
      </div>
    </>
  );
}
