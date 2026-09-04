import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@launchflow/db";
import { currentCustomer } from "@/lib/session";
import { gbp } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { prettyPhone } from "@/lib/phone";
import { LoginForm } from "@/components/account/LoginForm";
import { ReorderButton } from "@/components/order/ReorderButton";
import { LogoutButton } from "@/components/account/LogoutButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage() {
  const customer = await currentCustomer();
  if (!customer) {
    return (
      <div className="lf-container max-w-md">
        <h1 className="lf-h1 pt-6">Log in</h1>
        <p className="text-muted mt-2">We&apos;ll text you a one-time code. No password needed.</p>
        <LoginForm />
      </div>
    );
  }
  const orders = await prisma.order.findMany({ where: { customerId: customer.id, status: { not: "pending_payment" } }, orderBy: { createdAt: "desc" }, take: 20, include: { items: { where: { parentId: null }, select: { qty: true, name: true } } } });
  return (
    <div className="lf-container max-w-xl">
      <div className="flex items-start justify-between pt-6">
        <div><h1 className="lf-h1">Hi {customer.name?.split(" ")[0] || "there"}</h1><p className="text-muted">{prettyPhone(customer.phone)}{customer.email ? ` · ${customer.email}` : ""}</p></div>
        <LogoutButton />
      </div>
      {customer.loyaltyPoints ? <p className="lf-card p-3 mt-4 text-sm"><span className="font-bold">{customer.loyaltyPoints} points</span> earned so far.</p> : null}

      <section className="mt-6">
        <h2 className="lf-h2">Saved addresses</h2>
        {customer.addresses.length ? (
          <ul className="mt-2 space-y-2">{customer.addresses.map((a) => <li key={a.id} className="lf-card p-3 text-sm">{[a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(", ")}</li>)}</ul>
        ) : <p className="text-muted text-sm mt-1">Addresses are saved automatically when you order.</p>}
      </section>

      <section className="mt-8">
        <h2 className="lf-h2">Past orders</h2>
        {orders.length === 0 ? <p className="text-muted text-sm mt-1">No orders yet. <Link href="/menu" className="underline">Start one</Link>.</p> : null}
        <ul className="mt-2 space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="lf-card p-4">
              <div className="flex justify-between text-sm"><span className="font-semibold">#{o.number} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(o.createdAt)}</span><span>{gbp(o.total)}</span></div>
              <p className="text-sm text-muted mt-1">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
              <div className="mt-3 flex items-center gap-3 text-sm"><span className="lf-pill bg-surface-2">{STATUS_LABEL[o.status]}</span><Link href={`/order/${o.id}`} className="underline">Details</Link><ReorderButton orderId={o.id} label="Reorder" /></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
