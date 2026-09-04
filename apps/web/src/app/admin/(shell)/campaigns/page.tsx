import Link from "next/link";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { SEGMENTS, segmentWhere, segmentLabel } from "@/lib/segments";
import { campaignStats, promoWarning, audienceKind, SMS_COST_PENCE } from "@/lib/marketing";
import { sendCampaign } from "../actions";

export const dynamic = "force-dynamic";

/** One-off sends: a new item, a closure, a quiet Tuesday. Measured like everything else. */
export default async function AdminCampaigns() {
  await requireScreen("campaigns");
  const client = await getClientRow();

  const [past, counts, promos] = await Promise.all([
    prisma.campaign.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    Promise.all(SEGMENTS.map(async (s) => ({
      ...s,
      n: await prisma.customer.count({ where: { clientId: client.id, marketingOptIn: true, phone: { not: "" }, ...segmentWhere(s.key) } }),
    }))),
    prisma.promo.findMany({ where: { clientId: client.id, active: true }, select: { code: true, minOrder: true, firstOrderOnly: true, fulfilment: true } }),
  ]);

  const rows = await Promise.all(past.map(async (c) => ({ c, stats: await campaignStats(c.id) })));

  // Every campaign here goes to people who have ordered before, so a
  // first-order-only code would be dead on arrival. Default to one that works
  // and say plainly which of the others do not.
  const notes = promos
    .map((p) => ({ code: p.code, note: promoWarning(p, audienceKind("lapsed_60d")) }))
    .filter((n) => n.note);
  const usable = promos.filter((p) => !notes.some((n) => n.code === p.code));

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Campaigns</h1>
        </div>
      </header>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 24px", maxWidth: "78ch" }}>
        A campaign goes out once, to the group you pick. Only customers who opted in are
        ever contacted, and every text carries &ldquo;Reply STOP to opt out&rdquo; &mdash; both
        are the law, not settings. Attach an offer code and you will see on the{" "}
        <Link href="/admin/marketing">Marketing</Link> screen exactly what the send earned back.
      </p>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1fr)", alignItems: "start" }} className="fp-campaign-grid">
        <div style={{ border: "2px solid var(--color-text)", padding: 24 }}>
          <span className="fp-kicker" style={{ marginBottom: 12 }}>New campaign</span>
          <form action={sendCampaign} style={{ display: "grid", gap: 12 }}>
            <div className="fp-fields">
              <div className="field">
                <label htmlFor="channel">Channel</label>
                <select id="channel" name="channel" className="input" defaultValue="sms">
                  <option value="sms">SMS &mdash; {gbp(SMS_COST_PENCE)} each</option>
                  <option value="email">Email &mdash; free</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="segment">Send to</label>
                <select id="segment" name="segment" className="input" defaultValue="lapsed_60d">
                  {counts.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.n})</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="promoCode">Offer code</label>
                <select id="promoCode" name="promoCode" className="input" defaultValue={usable[0]?.code ?? ""}>
                  <option value="">No code (not measurable)</option>
                  {promos.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="subject">Subject (email only)</label>
                <input id="subject" name="subject" className="input" maxLength={80} placeholder={`News from ${client.name}`} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="body">Message</label>
              <textarea id="body" name="body" className="input" required rows={4} style={{ padding: 10, resize: "vertical" }}
                defaultValue={`{name}, it's {shop}. Tonight only: {code} for 20% off. Order direct and we keep the lot.`} />
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-700)", lineHeight: 1.5 }}>
              <strong>{"{name}"}</strong> becomes their first name, <strong>{"{shop}"}</strong> the shop
              name, <strong>{"{code}"}</strong> the offer code above.
            </p>
            {notes.length ? (
              <div style={{ border: "2px solid var(--color-accent-700)", padding: 12 }}>
                <strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Check the code</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: "var(--color-neutral-700)" }}>
                  {notes.map((n) => <li key={n.code}>{n.note}</li>)}
                </ul>
              </div>
            ) : null}
            <button className="btn btn-primary" style={{ justifySelf: "start" }}>Send now</button>
          </form>
        </div>

        <div style={{ border: "2px solid var(--color-neutral-300)", padding: 24 }}>
          <span className="fp-kicker" style={{ marginBottom: 12 }}>Your list</span>
          <table className="table" style={{ width: "100%" }}>
            <tbody>
              {counts.map((s) => (
                <tr key={s.key}>
                  <td>
                    <Link href={`/admin/customers?segment=${s.key}`} style={{ fontWeight: 600 }}>{s.label}</Link>
                    <br />
                    <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{s.help}</span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top" }}>
                    <strong>{s.n}</strong>
                    <br />
                    <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{gbp(s.n * SMS_COST_PENCE)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <span className="fp-kicker" style={{ margin: "32px 0 12px", display: "block" }}>Sent</span>
      {rows.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>Nothing sent yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>When</th><th>Sent to</th><th>Message</th><th>Code</th>
                <th style={{ textAlign: "right" }}>Sent</th>
                <th style={{ textAlign: "right" }}>Orders</th>
                <th style={{ textAlign: "right" }}>Cost</th>
                <th style={{ textAlign: "right" }}>Earned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, stats }) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{c.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{segmentLabel(c.segment)}<br /><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{c.channel.toUpperCase()}</span></td>
                  <td style={{ maxWidth: 320, fontSize: 13, color: "var(--color-neutral-700)" }}>{c.body}</td>
                  <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>{c.promoCode || "—"}</td>
                  <td style={{ textAlign: "right" }}>{stats.sent}{c.failed ? <><br /><span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{c.failed} failed</span></> : null}</td>
                  <td style={{ textAlign: "right" }}>{stats.redeemed}</td>
                  <td style={{ textAlign: "right" }}>{gbp(stats.spendPence)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: stats.revenuePence ? "var(--color-accent-700)" : undefined }}>
                    {gbp(stats.revenuePence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
