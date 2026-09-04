import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@launchflow/db";
import { connectOpts, getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { getConfig } from "@/lib/config";
import { addEvent, markPlaced } from "@/lib/orders";


/** Resolve a PaymentIntent's receipt URL, tolerating an unexpanded latest_charge. */
async function chargeReceiptUrl(latestCharge: Stripe.Charge | string | null | undefined): Promise<string | undefined> {
  if (latestCharge && typeof latestCharge === "object") return latestCharge.receipt_url ?? undefined;
  if (typeof latestCharge !== "string" || !latestCharge) return undefined;
  try {
    const charge = await getStripe().charges.retrieve(latestCharge, {}, connectOpts(getConfig().payments.stripeAccountId));
    return charge.receipt_url ?? undefined;
  } catch (e) {
    console.error("[stripe] could not fetch receipt url", (e as Error).message);
    return undefined;
  }
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !env.stripeWebhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, env.stripeWebhookSecret);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: pi.id } });
      const orderId = payment?.orderId ?? (pi.metadata?.orderId as string | undefined);
      if (!orderId) break;
      // Webhook payloads never expand nested objects, so latest_charge arrives as
      // a bare id. Fetch the charge to get its receipt URL; best-effort only, a
      // failure here must not stop the order being marked paid.
      const receiptUrl = await chargeReceiptUrl(pi.latest_charge);
      await prisma.payment.update({ where: { orderId }, data: { status: "succeeded", stripePaymentIntentId: pi.id, receiptUrl } }).catch(() => null);
      await addEvent(orderId, "paid", "stripe", `PaymentIntent ${pi.id}`);
      await markPlaced(orderId, "stripe");
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: pi.id } });
      if (payment) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
        await addEvent(payment.orderId, "payment_failed", "stripe", pi.last_payment_error?.message ?? "");
      }
      break;
    }
    case "charge.refunded": {
      const ch = event.data.object;
      const piId = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (piId) {
        const payment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: piId } });
        if (payment) {
          await prisma.payment.update({ where: { id: payment.id }, data: { status: "refunded", refundedAmount: ch.amount_refunded } });
          await addEvent(payment.orderId, "refunded", "stripe", `Refunded ${ch.amount_refunded}p`);
        }
      }
      break;
    }
  }
  return NextResponse.json({ received: true });
}
