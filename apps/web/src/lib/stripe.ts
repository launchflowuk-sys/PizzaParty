import "server-only";
import Stripe from "stripe";
import { env } from "./env";

let client: Stripe | null = null;

export function stripeEnabled() {
  return !!env.stripeSecretKey && !!env.stripePublishableKey;
}

/**
 * The till's card reader is server-driven, so it needs only the secret key. Keeping it
 * apart from stripeEnabled() lets a shop take card payments at the counter without
 * switching on online card checkout on the website and app.
 */
export function stripeServerEnabled() {
  return !!env.stripeSecretKey;
}

export function getStripe(): Stripe {
  if (!env.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) client = new Stripe(env.stripeSecretKey, { appInfo: { name: "LaunchFlow Takeaway" } });
  return client;
}

/** Request options for a Connect direct charge on the client's account, when configured. */
export function connectOpts(stripeAccountId: string): Stripe.RequestOptions | undefined {
  return stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
}
