import type { Metadata } from "next";
import { getConfig } from "@/lib/config";
import { pageTitle } from "@/lib/seo";

export function generateMetadata(): Metadata { const cfg = getConfig(); return { title: { absolute: pageTitle(cfg, "Terms & Conditions") }, alternates: { canonical: "/terms" } }; }

export default function TermsPage() {
  const cfg = getConfig();
  return (
    <div className="lf-container max-w-3xl lf-prose">
      <h1 className="lf-h1 pt-8 mb-4">Terms & conditions</h1>
      <h2>Orders</h2>
      <p>An order is accepted when the kitchen confirms it on the status page or by SMS. Until then we may reject it (for example if an item is unavailable) and any payment is refunded in full.</p>
      <h2>Delivery</h2>
      <p>Delivery times are estimates. Delivery is available only to the postcodes shown at checkout. A minimum order and delivery fee apply per area.</p>
      <h2>Payment</h2>
      <p>Card, Apple Pay and Google Pay are processed by Stripe. Cash may be accepted on collection where shown.</p>
      <h2>Cancellations and refunds</h2>
      <p>Contact us straight away on {cfg.contact.phone || "the number on our contact page"} if you need to cancel. Once food is being prepared we cannot usually cancel. If something is wrong with your order, tell us within 24 hours and we will put it right or refund.</p>
      <h2>Allergens</h2>
      <p>See our allergen page. If you have a severe allergy, call before ordering.</p>
      <h2>Promotions</h2>
      <p>Promo codes cannot be combined and may be withdrawn at any time.</p>
    </div>
  );
}
