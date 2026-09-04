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
  const mode = order.fulfilment === "delivery" ? "Delivery" : "Collection";

  return (
    <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
      <span className="fp-kicker" style={{ marginBottom: 12 }}>
        Order #{order.number} &middot; {mode} &middot; {order.location.name}
      </span>

      <OrderLive
        orderId={order.id}
        initial={{ status: order.status, label: order.status === "pending_payment" ? "Confirming payment…" : STATUS_LABEL[order.status], etaAt: order.etaAt?.toISOString() ?? null, etaMinutes: order.etaMinutes, fulfilment: order.fulfilment, rejectReason: order.rejectReason, scheduledFor: order.scheduledFor?.toISOString() ?? null, tz }}
      />

      <div className="fp-split-checkout" style={{ marginTop: 48 }}>
        <div>
          {/* Where it's going */}
          <div style={{ border: "2px solid var(--color-text)", padding: 24, display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>
              {order.fulfilment === "delivery" ? "Delivering to" : "Collect from"}
            </span>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, letterSpacing: "-.02em" }}>
              {order.fulfilment === "delivery"
                ? [order.deliveryLine1, order.deliveryCity, order.deliveryPostcode].filter(Boolean).join(", ")
                : order.location.name}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-800)" }}>
              {order.fulfilment === "delivery"
                ? `From ${order.location.name}${order.location.address ? `, ${order.location.address}` : ""}.`
                : `${order.location.address || ""}`}
            </p>
            {order.scheduledFor ? <p style={{ margin: 0, fontSize: 14 }}>Scheduled for {formatTime(order.scheduledFor, tz)}</p> : null}
            {order.notes ? <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-700)" }}>&ldquo;{order.notes}&rdquo;</p> : null}
          </div>

          {cfg.contact.phone ? (
            <p style={{ fontSize: 13, color: "var(--color-neutral-600)", marginTop: 16 }}>
              Problem with your order? Call{" "}
              <a href={`tel:${cfg.contact.phone.replace(/\s+/g, "")}`} style={{ textDecoration: "underline" }}>{cfg.contact.phone}</a>
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <ReorderButton orderId={order.id} />
            <Link href="/menu" className="btn btn-secondary">Back to the menu</Link>
          </div>
        </div>

        <aside style={{ border: "2px solid var(--color-text)", padding: 24, display: "grid", gap: 10, fontSize: 14 }}>
          {order.items.map((i) => (
            <div key={i.id} style={{ display: "grid", gap: 2, paddingBottom: 10, borderBottom: "1px solid var(--color-divider)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontWeight: 600 }}>{i.qty} × {i.name}{i.sizeName ? ` (${i.sizeName})` : ""}</span>
                <span style={{ fontWeight: 600 }}>{gbp(i.lineTotal)}</span>
              </div>
              {i.modifiers.length ? <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{i.modifiers.map((m) => m.name).join(", ")}</span> : null}
              {i.components.map((c) => (
                <span key={c.id} style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                  • {c.name}{c.sizeName ? ` (${c.sizeName})` : ""}{c.modifiers.length ? ` +${c.modifiers.map((m) => m.name).join(", ")}` : ""}
                </span>
              ))}
              {i.notes ? <span style={{ fontSize: 12, fontStyle: "italic", color: "var(--color-neutral-600)" }}>&ldquo;{i.notes}&rdquo;</span> : null}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{gbp(order.subtotal)}</span></div>
          {order.deliveryFee ? <div style={{ display: "flex", justifyContent: "space-between" }}><span>Delivery</span><span>{gbp(order.deliveryFee)}</span></div> : null}
          {order.discount ? <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-accent-700)" }}><span>{order.promoCode || "Discount"}</span><span>&minus;{gbp(order.discount)}</span></div> : null}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "2px solid var(--color-divider)", paddingTop: 12 }}>
            <span style={{ fontWeight: 600 }}>Total</span>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, letterSpacing: "-.02em" }}>{gbp(order.total)}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-600)" }}>
            {order.paymentMethod === "cash" ? `Pay cash on ${order.fulfilment}` : order.payment?.status === "succeeded" ? "Paid by card" : "Card payment pending"}
          </p>
        </aside>
      </div>
    </section>
  );
}
