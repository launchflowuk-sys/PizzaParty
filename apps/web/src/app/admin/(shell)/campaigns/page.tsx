import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { SEGMENTS, segmentWhere } from "@/lib/segments";
import { sendCampaign } from "../actions";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminCampaigns() {
  await requireScreen("campaigns");
  const client = await getClientRow();
  const [past, counts] = await Promise.all([
    prisma.campaign.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    Promise.all(SEGMENTS.map(async (s) => ({ ...s, n: await prisma.customer.count({ where: { clientId: client.id, marketingOptIn: true, ...segmentWhere(s.key) } }) }))),
  ]);
  return (
    <div>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Campaigns</h1>
        </div>
      </header>
      <p className="text-sm text-muted mt-1">Sends only to customers who opted in. Use <code>{"{name}"}</code> for first name. SMS auto-appends “Reply STOP to opt out”.</p>
      <form action={sendCampaign} className="lf-card p-4 mt-4 grid gap-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">Channel<select name="channel" className="lf-input mt-1"><option value="sms">SMS</option><option value="email">Email</option></select></label>
          <label className="text-sm">Segment<select name="segment" className="lf-input mt-1">{counts.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.n})</option>)}</select></label>
        </div>
        <label className="text-sm">Subject (email only)<input name="subject" className="lf-input mt-1" /></label>
        <label className="text-sm">Message<textarea name="body" required rows={4} className="lf-input mt-1 py-2" defaultValue={`Hi {name}, it's ${client.name}. Tonight only: 20% off with code TONIGHT20 at ${client.domain}`} /></label>
        <button className="lf-btn lf-btn-primary w-fit">Send now</button>
      </form>
      <h2 className="font-bold mt-8">Sent</h2>
      <table className="table" style={{ width: "100%" }}><tbody>{past.map((c) => (
        <tr key={c.id} className="border-b border-line"><td className="p-2 whitespace-nowrap">{c.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td><td className="p-2">{c.channel} · {c.segment}</td><td className="p-2 text-muted truncate max-w-md">{c.body}</td><td className="p-2 whitespace-nowrap">{c.sent} sent{c.failed ? `, ${c.failed} failed` : ""}</td></tr>
      ))}</tbody></table>
    </div>
  );
}
