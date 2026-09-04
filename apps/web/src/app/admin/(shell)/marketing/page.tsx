import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { requireScreen } from "@/lib/session";
import { TRIGGERS, automationStats, audienceSize, marketingTotals, commissionSaved, promoWarning, audienceKind, SMS_COST_PENCE } from "@/lib/marketing";
import { saveAutomation, toggleAutomation, runAutomationNow } from "../actions";

export const dynamic = "force-dynamic";

/** Lifecycle marketing: automations that run on their own, and what each earned. */
export default async function MarketingPage() {
  await requireScreen("marketing");
  const client = await getClientRow();

  const automations = await prisma.automation.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "asc" },
  });

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [totals, saved, promos] = await Promise.all([
    marketingTotals(client.id),
    commissionSaved(client.id, monthStart),
    prisma.promo.findMany({ where: { clientId: client.id, active: true }, select: { code: true, minOrder: true, firstOrderOnly: true, fulfilment: true } }),
  ]);

  const rows = await Promise.all(automations.map(async (a) => ({
    a,
    stats: await automationStats(a.id),
    waiting: await audienceSize({ clientId: client.id, trigger: a.trigger, days: a.days, cooldownDays: a.cooldownDays }),
    // A code the recipients cannot use is the one failure this screen cannot
    // show you any other way - the sends succeed, they just never convert.
    note: promoWarning(promos.find((p) => p.code === a.promoCode), audienceKind(a.trigger)),
  })));

  const optedIn = await prisma.customer.count({ where: { clientId: client.id, marketingOptIn: true, phone: { not: "" } } });
  const net = totals.revenuePence - totals.spendPence;

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Marketing</h1>
        </div>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          {optedIn} customers opted in
        </span>
      </header>

      <div className="fp-stats4" style={{ marginBottom: 24 }}>
        <div className="fp-statcell">
          <span className="l">Earned from marketing</span>
          <span className="n">{gbp(totals.revenuePence)}</span>
        </div>
        <div className="fp-statcell">
          <span className="l">Spent on messages</span>
          <span className="n" style={{ color: "var(--color-text)" }}>{gbp(totals.spendPence)}</span>
        </div>
        <div className="fp-statcell">
          <span className="l">Net</span>
          <span className="n" style={{ color: net >= 0 ? "var(--color-accent)" : "var(--color-text)" }}>{gbp(net)}</span>
        </div>
        <div className="fp-statcell">
          <span className="l">Commission saved this month</span>
          <span className="n">{gbp(saved.savedPence)}</span>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 24px", maxWidth: "78ch" }}>
        Every message carries its own code, so when an order uses that code the money is credited
        back to the message that caused it. &ldquo;Commission saved&rdquo; is an estimate of what an
        aggregator would have taken on the {saved.orders} order{saved.orders === 1 ? "" : "s"} taken
        directly this month, at 14%.
      </p>

      <span className="fp-kicker" style={{ marginBottom: 12 }}>Automations</span>
      {rows.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>None yet. Add one below.</p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 32 }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Automation</th><th>Trigger</th><th>Code</th>
                <th style={{ textAlign: "right" }}>Waiting</th>
                <th style={{ textAlign: "right" }}>Sent</th>
                <th style={{ textAlign: "right" }}>Orders</th>
                <th style={{ textAlign: "right" }}>Spent</th>
                <th style={{ textAlign: "right" }}>Earned</th>
                <th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, stats, waiting, note }) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td>{TRIGGERS.find((t) => t.key === a.trigger)?.label ?? a.trigger}<br />
                    <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{a.days} days &middot; {a.channel.toUpperCase()}</span>
                  </td>
                  <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>
                    {a.promoCode || "—"}
                    {note ? <><br /><span style={{ fontFamily: "inherit", fontSize: 11, color: "var(--color-accent-700)", fontWeight: 600 }}>{note}</span></> : null}
                  </td>
                  <td style={{ textAlign: "right" }}>{waiting}</td>
                  <td style={{ textAlign: "right" }}>{stats.sent}</td>
                  <td style={{ textAlign: "right" }}>{stats.redeemed}</td>
                  <td style={{ textAlign: "right" }}>{gbp(stats.spendPence)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: stats.revenuePence ? "var(--color-accent-700)" : undefined }}>
                    {gbp(stats.revenuePence)}
                  </td>
                  <td><span className={a.active ? "tag tag-accent" : "tag tag-neutral"}>{a.active ? "On" : "Off"}</span></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <form action={toggleAutomation} style={{ display: "inline-block", marginRight: 6 }}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn btn-secondary">{a.active ? "Pause" : "Turn on"}</button>
                    </form>
                    <form action={runAutomationNow} style={{ display: "inline-block" }}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn btn-primary" disabled={waiting === 0}>
                        Send {waiting > 0 ? `${waiting} · ${gbp(waiting * SMS_COST_PENCE)}` : "now"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ border: "2px solid var(--color-text)", padding: 24, maxWidth: 780 }}>
        <span className="fp-kicker" style={{ marginBottom: 12 }}>New automation</span>
        <form action={saveAutomation} style={{ display: "grid", gap: 12 }}>
          <div className="fp-fields">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" className="input" required maxLength={60} placeholder="Win back after 45 days" />
            </div>
            <div className="field">
              <label htmlFor="trigger">When it fires</label>
              <select id="trigger" name="trigger" className="input" defaultValue="win_back">
                {TRIGGERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="days">Days</label>
              <input id="days" name="days" className="input" type="number" min={0} max={365} defaultValue={45} />
            </div>
            <div className="field">
              <label htmlFor="cooldownDays">Do not contact again within (days)</label>
              <input id="cooldownDays" name="cooldownDays" className="input" type="number" min={1} max={365} defaultValue={30} />
            </div>
            <div className="field">
              <label htmlFor="promoCode">Offer code</label>
              <select id="promoCode" name="promoCode" className="input" defaultValue={promos.find((p) => !p.firstOrderOnly)?.code ?? ""}>
                <option value="">No code (not measurable)</option>
                {promos.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="maxPerRun">Never send more than</label>
              <input id="maxPerRun" name="maxPerRun" className="input" type="number" min={1} max={1000} defaultValue={200} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="body">Message</label>
            <input id="body" name="body" className="input" required maxLength={280}
              defaultValue="{shop}: we miss you, {name}. {code} gets you 20% off tonight." />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-700)", lineHeight: 1.5 }}>
            <strong>{"{name}"}</strong>, <strong>{"{shop}"}</strong> and <strong>{"{code}"}</strong> are filled in per
            person. &ldquo;Reply STOP to opt out&rdquo; is appended to every text automatically, and only
            customers who opted in are ever contacted &mdash; both are legal requirements, not options.
          </p>
          <button className="btn btn-primary" style={{ justifySelf: "start" }}>Save automation</button>
        </form>
      </div>
    </>
  );
}
