import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="lf-container max-w-xl">
      <h1 className="lf-h1 pt-6">Checkout</h1>
      <CheckoutFlow />
    </div>
  );
}
