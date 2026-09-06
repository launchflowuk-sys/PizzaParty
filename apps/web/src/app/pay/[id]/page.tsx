import { notFound } from "next/navigation";
import { prisma } from "@launchflow/db";
import { getConfig } from "@/lib/config";
import { connectOpts, getStripe, stripeEnabled } from "@/lib/stripe";
import { env } from "@/lib/env";
import { MobilePay } from "@/components/checkout/MobilePay";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * Card payment for the phone app.
 *
 * The app opens this in an in-app browser (SFSafariViewController on iOS,
 * Custom Tabs on Android) and closes it again on the deep link at the end.
 * It exists rather than a native Stripe SDK for one reason: card details never
 * touch a screen this codebase drew. Stripe's own iframe collects them, which
 * is the difference between a PCI questionnaire the shop can answer in an
 * afternoon and one it cannot answer at all.
 *
 * The client secret is fetched here, server side, from the order - never
 * handed to the app and never put in the URL. A client secret in a query
 * string ends up in browser history, in any proxy's logs, and in the referrer
 * of every request the page then makes.
 */
export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!stripeEnabled()) notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true, number: true, total: true, status: true,
      payment: { select: { stripePaymentIntentId: true, status: true } },
    },
  });
  if (!order?.payment?.stripePaymentIntentId) notFound();

  const cfg = getConfig();

  // Already paid, or moved on. Bounce straight back into the app rather than
  // showing a card form for money that has been taken.
  if (order.status !== "pending_payment" || order.payment.status === "succeeded") {
    return <MobilePay done orderId={order.id} clientSecret="" publishableKey="" accountId={null} total={order.total} number={order.number} brand={cfg.brand.primary} />;
  }

  // The connected-account option is the third argument here, not the second -
  // the second is query params, and passing request options there type-errors
  // rather than silently reading the platform account.
  const intent = await getStripe().paymentIntents.retrieve(
    order.payment.stripePaymentIntentId,
    undefined,
    connectOpts(cfg.payments.stripeAccountId) ?? undefined,
  );
  if (!intent.client_secret) notFound();

  return (
    <MobilePay
      orderId={order.id}
      number={order.number}
      clientSecret={intent.client_secret}
      publishableKey={env.stripePublishableKey}
      accountId={cfg.payments.stripeAccountId || null}
      total={order.total}
      brand={cfg.brand.primary}
    />
  );
}
