import { prisma } from "@launchflow/db";
import { getConfig } from "@/lib/config";
import { env } from "@/lib/env";
import { requireRole } from "@/lib/session";
import Link from "next/link";
import { stripeEnabled, getStripe } from "@/lib/stripe";
import { LaunchflowActions } from "@/components/admin/LaunchflowActions";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";

async function check(url: string) {
  try { const r = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5000) }); return `${r.status}${r.headers.get("location") ? ` → ${r.headers.get("location")}` : ""}`; } catch (e) { return `error: ${(e as Error).message}`; }
}

export default async function LaunchflowPage() {
  await requireScreen("launchflow");
  const agency = await requireRole("agency");
  if (!agency) return <p className="text-danger">Agency key required. <Link className="underline" href="/admin/login?next=/admin/launchflow">Log in with the LaunchFlow key</Link>.</p>;
  const cfg = getConfig();
  const client = await prisma.client.findUnique({ where: { slug: env.clientSlug } });
  const counts = client ? await Promise.all([prisma.product.count({ where: { clientId: client.id, active: true } }), prisma.order.count({ where: { clientId: client.id } }), prisma.customer.count({ where: { clientId: client.id } })]) : [0, 0, 0];
  let stripe = "not configured";
  if (stripeEnabled()) {
    try {
      const acct = await getStripe().accounts.retrieve(cfg.payments.stripeAccountId || null);
      stripe = `${acct.id} · charges ${acct.charges_enabled ? "enabled" : "DISABLED"} · payouts ${acct.payouts_enabled ? "enabled" : "DISABLED"}`;
    } catch (e) { stripe = `error: ${(e as Error).message}`; }
  }
  const domains = await Promise.all([cfg.domain, `www.${cfg.domain}`, ...cfg.legacyDomains].map(async (d) => ({ d, r: await check(`https://${d}/`) })));
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <tr className="border-b border-line"><td className="p-2 font-semibold whitespace-nowrap">{k}</td><td className="p-2 break-all">{v}</td></tr>;
  return (
    <div>
      <h1 className="lf-h2">LaunchFlow · {cfg.name}</h1>
      <table className="w-full text-sm mt-4 lf-card"><tbody>
        <Row k="Client slug" v={env.clientSlug} />
        <Row k="Seeded" v={client ? `yes · config hash ${client.configHash}` : "NO — run pnpm seed"} />
        <Row k="Counts" v={`${counts[0]} products · ${counts[1]} orders · ${counts[2]} customers`} />
        <Row k="Site URL" v={env.siteUrl} />
        <Row k="Stripe" v={stripe} />
        <Row k="Webhook secret" v={env.stripeWebhookSecret ? "set" : "MISSING"} />
        <Row k="SMS (Twilio)" v={env.twilioSid ? "configured" : "dry-run (logs only)"} />
        <Row k="Email (Resend)" v={env.resendApiKey ? "configured" : "dry-run (logs only)"} />
        <Row k="Kitchen notify" v={[cfg.notifications.kitchenSms && "sms", cfg.notifications.kitchenEmail && "email", cfg.notifications.printerWebhook && "printer"].filter(Boolean).join(", ") || "none set"} />
        <Row k="Review URL" v={cfg.contact.reviewUrl || "not set (review SMS disabled)"} />
        <Row k="Domains" v={<ul>{domains.map((x) => <li key={x.d}>{x.d}: {x.r}</li>)}</ul>} />
      </tbody></table>
      <LaunchflowActions />
    </div>
  );
}
