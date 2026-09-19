import type { Metadata } from "next";
import { getConfig } from "@/lib/config";
import { pageTitle } from "@/lib/seo";

export function generateMetadata(): Metadata { const cfg = getConfig(); return { title: { absolute: pageTitle(cfg, "Privacy Policy") }, alternates: { canonical: "/privacy" } }; }

export default function PrivacyPage() {
  const cfg = getConfig();
  return (
    <div className="lf-container max-w-3xl lf-prose">
      <h1 className="lf-h1 pt-8 mb-4">Privacy policy</h1>
      <p><strong>Who we are.</strong> {cfg.name}{cfg.contact.address ? `, ${cfg.contact.address}` : ""}. Contact: {cfg.contact.email || cfg.contact.phone || "see our contact page"}.</p>
      <h2>What we collect</h2>
      <p>Name, phone number, delivery address, email (optional), order history and the postcode you check. Card details are processed by Stripe and never touch our servers.</p>
      <h2>Why</h2>
      <p>To take and deliver your order, send order status messages by SMS, and, only if you opt in, occasional offers. You can opt out of marketing at any time by replying STOP or from your account page.</p>
      <h2>Retention</h2>
      <p>Orders are kept for 6 years for accounting. You can ask us to delete your account and personal details at any time.</p>
      <h2>Deleting your account</h2>
      <p>Email {cfg.contact.email || "us"} from the address on your account, or text the mobile number on it, saying you want your {cfg.name} account deleted. We do it within 30 days and write back to confirm. If you are signed in to the {cfg.name} app you can also delete the account from the <strong>Account</strong> screen.</p>
      <p>Deleting removes your name, phone number, email, saved addresses and login sessions. Past orders are kept for 6 years without your contact details, because we have to keep them for accounting.</p>
      <h2>Cookies</h2>
      <p>We use strictly necessary cookies only: your basket, your last postcode and your login session. No advertising trackers.</p>
      <h2>Your rights</h2>
      <p>You can request a copy, correction or deletion of your data by contacting us. This site is operated on the LaunchFlow platform, which processes data on our behalf under contract.</p>
    </div>
  );
}
