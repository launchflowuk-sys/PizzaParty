import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getConfig } from "@/lib/config";
import { getFullOrder, markPlaced, STATUS_LABEL } from "@/lib/orders";
import { connectOpts, getStripe, stripeEnabled } from "@/lib/stripe";
import { gbp } from "@/lib/money";
import { formatTime } from "@/lib/availability";
import { OrderLive } from "@/components/order/OrderLive";
import { ReorderButton } from "@/components/order/ReorderButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false } };
type Params = { params: Promise<{ id: string }> };

export default async function OrderPage({ params }: Params) {
  const { id } = await params;
  const cfg = getConfig();
  let order = await getFullOrder(id);
  if (!order) notFound();

  // Webhook lag fallback: reconcile with Stripe if still awaiting payment.
  if (order.status === "pending_payment" && order.payment?.stripePaymentIntentId && stripeEnabled()) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(order.payment.stripePaymentIntentId, undefined, connectOpts(cfg.payments.stripeAccountId));
      if (pi.status === "succeeded") {
        await prisma.payment.update({ where: { orderId: order.id }, data: { status: "succeeded" } });
        await markPlaced(order.id, "stripe");
        order = (await getFullOrder(id))!;
      }
    } catch { /* show pending */ }
  }

  const tz = order.location.timezone;
  return (
    <div className="lf-container max-w-xl">
      <p className="pt-6 text-sm text-muted">Order #{order.number} · {order.fulfilment} · {order.location.name}</p>
      <h1 className="lf-h1 mt-1">{order.status === "pending_payment" ? "Confirming payment…" : `Thanks, ${order.customerName.split(" ")[0]}!`}</h1>
      <OrderLive orderId={order.id} initial={{ status: order.status, label: STATUS_LABEL[order.status], etaAt: order.etaAt?.toISOString() ?? null, etaMinutes: order.etaMinutes, fulfilment: order.fulfilment, rejectReason: order.rejectReason, scheduledFor: order.scheduledFor?.toISOString() ?? null, tz }} />

      <section className="lf-card mt-6 divide-y divide-line">
        {order.items.map((i) => (
          <div key={i.id} className="p-4 flex justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold">{i.qty} × {i.name}{i.sizeName ? ` (${i.sizeName})` : ""}</p>
              {i.modifiers.length ? <p className="text-muted">{i.modifiers.map((m) => m.name).join(", ")}</p> : null}
              {i.components.map((c) => <p key={c.id} className="text-muted">• {c.name}{c.sizeName ? ` (${c.sizeName})` : ""}{c.modifiers.length ? ` +${c.modifiers.map((m) => m.name).join(", ")}` : ""}</p>)}
              {i.notes ? <p className="text-muted italic">“{i.notes}”</p> : null}
            </div>
            <p className="font-semibold">{gbp(i.lineTotal)}</p>
          </div>
        ))}
        <div className="p-4 text-sm space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{gbp(order.subtotal)}</span></div>
          {order.deliveryFee ? <div className="flex justify-between"><span>Delivery</span><span>{gbp(order.deliveryFee)}</span></div> : null}
          {order.discount ? <div className="flex justify-between text-success"><span>Discount {order.promoCode}</span><span>−{gbp(order.discount)}</span></div> : null}
          <div className="flex justify-between font-extrabold text-base"><span>Total</span><span>{gbp(order.total)}</span></div>
          <p className="text-muted">{order.paymentMethod === "cash" ? `Pay cash on ${order.fulfilment}` : order.payment?.status === "succeeded" ? "Paid by card" : "Card payment pending"}</p>
        </div>
      </section>

      <section className="lf-card mt-4 p-4 text-sm">
        {order.fulfilment === "delivery" ? <p><span className="font-semibold">Deliver to:</span> {[order.deliveryLine1, order.deliveryLine2, order.deliveryCity, order.deliveryPostcode].filter(Boolean).join(", ")}</p> : <p><span className="font-semibold">Collect from:</span> {order.location.name}{order.location.address ? `, ${order.location.address}` : ""}</p>}
        {order.scheduledFor ? <p className="mt-1"><span className="font-semibold">Scheduled for:</span> {formatTime(order.scheduledFor, tz)}</p> : null}
        {order.notes ? <p className="mt-1"><span className="font-semibold">Notes:</span> {order.notes}</p> : null}
        {cfg.contact.phone ? <p className="mt-2 text-muted">Problem with your order? Call <a className="text-brand font-semibold" href={`tel:${cfg.contact.phone.replace(/\s+/g, "")}`}>{cfg.contact.phone}</a></p> : null}
      </section>

      <div className="mt-6 flex gap-2">
        <ReorderButton orderId={order.id} />
        <Link href="/menu" className="lf-btn lf-btn-ghost">Back to menu</Link>
      </div>
    </div>
  );
}
