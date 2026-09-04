import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/** Heading and container live inside CheckoutFlow so the empty-basket state can
 *  carry its own heading, as in the prototype. */
export default function CheckoutPage() {
  return <CheckoutFlow />;
}
