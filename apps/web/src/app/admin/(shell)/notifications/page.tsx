import {
  prisma, APPLICABLE, AUDIENCE_LABEL, EVENT_HINT, EVENT_LABEL,
  NOTIFY_AUDIENCES, NOTIFY_EVENTS, CHANNELS_FOR, type NotifyAudience, type NotifyEvent,
} from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { requireScreen } from "@/lib/session";
import { env } from "@/lib/env";
import { HelpSpot } from "@/components/admin/HelpSpot";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { saveRecipients, saveRules, toggleAll } from "./actions";

export const dynamic = "force-dynamic";

/** Roughly what a UK SMS costs to send. Used only to show a weekly estimate. */
const SMS_PENCE = 4;

type Params = { searchParams: Promise<{ m?: string; e?: string }> };

export default async function AdminNotifications({ searchParams }: Params) {
  await requireScreen("notifications");
  const { m, e } = await searchParams;
  const client = await getClientRow();

  const [rules, ordersLastWeek, row] = await Promise.all([
    prisma.notificationRule.findMany({ where: { clientId: client.id } }),
    prisma.order.count({
      where: { clientId: client.id, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) }, status: { notIn: ["pending_payment"] } },
    }),
    prisma.client.findUnique({
      where: { id: client.id },
      select: { notificationsOn: true, ownerEmail: true, ownerSms: true, kitchenEmail: true, kitchenSms: true },
    }),
  ]);

  const on = new Set(rules.filter((r) => r.enabled).map((r) => `${r.event}|${r.audience}|${r.channel}`));
  const isOn = (ev: string, a: string, c: string) => on.has(`${ev}|${a}|${c}`);

  // What the texts are costing. The whole point of the screen is that this
  // number is a choice rather than a surprise on the bill.
  // Only SMS is counted. Push and email are free, which is the entire argument
  // this screen exists to make.
  const smsPerOrder = NOTIFY_EVENTS.reduce(
    (n, ev) => n + (APPLICABLE[ev].filter((a) => isOn(ev, a, "sms")).length),
    0,
  );
  const weeklySms = smsPerOrder * ordersLastWeek;
  const weeklyCost = (weeklySms * SMS_PENCE) / 100;

  const smtpReady = !!env.smtpHost && !!env.mailFrom;
  const smsReady = !!env.twilioSid;

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>
            Notifications
            <HelpSpot title="Why not just text everything?" article="notifications" anchor="email-is-free-texts-are-not">
              A text costs around 4p and an email costs nothing. At two hundred orders a week, texting
              every status change runs to real money for messages most people would happily read in an
              inbox. Leave email on everywhere, and keep texts for the moments somebody genuinely has to
              look at their phone.
            </HelpSpot>
          </h1>
        </div>
        <form action={toggleAll}>
          <input type="hidden" name="to" value={row?.notificationsOn ? "off" : "on"} />
          <button className={row?.notificationsOn ? "btn btn-secondary" : "btn btn-primary"}>
            {row?.notificationsOn ? "Pause everything" : "Switch everything back on"}
          </button>
        </form>
      </header>

      <AdminNotice message={m} error={e} back="/admin/notifications" />

      {!row?.notificationsOn ? (
        <p className="fp-notbanner danger">
          <strong>Everything is paused.</strong> No emails and no texts are going out to anybody, including
          the kitchen. Your settings below are untouched and come straight back when you switch it on.
        </p>
      ) : null}

      {!smtpReady || !smsReady ? (
        <p className="fp-notbanner warn">
          {!smtpReady && !smsReady ? "Neither email nor texts are connected yet" : !smtpReady ? "Email is not connected yet" : "Texts are not connected yet"}
          {" — "}anything switched on below is written to the order timeline and thrown away rather than sent.
          That looks like it worked, which is why it is worth saying plainly.
        </p>
      ) : null}

      {/* ── what it costs ─────────────────────────────────────────────── */}
      <section className="fp-panel" style={{ marginBottom: 28 }}>
        <header><h2>Running cost</h2></header>
        <div className="fp-stats4" style={{ border: 0 }}>
          <div className="fp-statcell">
            <strong>{smsPerOrder}</strong>
            <span className="l">Texts per order</span>
          </div>
          <div className="fp-statcell">
            <strong>{ordersLastWeek}</strong>
            <span className="l">Orders last 7 days</span>
          </div>
          <div className="fp-statcell">
            <strong>{weeklySms}</strong>
            <span className="l">Texts a week at that rate</span>
          </div>
          <div className="fp-statcell">
            <strong>£{weeklyCost.toFixed(2)}</strong>
            <span className="l">A week, roughly, at {SMS_PENCE}p a text</span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "14px 0 0", maxWidth: "78ch" }}>
          An estimate from your own order count, not a bill. Email is not counted because it costs nothing
          to send &mdash; which is the argument for leaving it on everywhere and being choosy about the texts.
        </p>
      </section>

      {/* ── who hears about it ───────────────────────────────────────── */}
      <form action={saveRecipients}>
        <section className="fp-panel" style={{ marginBottom: 28 }}>
          <header><h2>Where messages go</h2></header>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            <label>
              <span className="l">Owner email</span>
              <input className="input" name="ownerEmail" type="email" defaultValue={row?.ownerEmail ?? ""} placeholder="you@example.com" />
            </label>
            <label>
              <span className="l">Owner mobile</span>
              <input className="input" name="ownerSms" type="tel" defaultValue={row?.ownerSms ?? ""} placeholder="07700 900123" />
            </label>
            <label>
              <span className="l">Kitchen email</span>
              <input className="input" name="kitchenEmail" type="email" defaultValue={row?.kitchenEmail ?? ""} placeholder="kitchen@example.com" />
            </label>
            <label>
              <span className="l">Kitchen mobile</span>
              <input className="input" name="kitchenSms" type="tel" defaultValue={row?.kitchenSms ?? ""} placeholder="07700 900456" />
            </label>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "14px 0 16px", maxWidth: "78ch" }}>
            Deliberately separate from the phone number and address on the website. Those are where customers
            write to you; these are where the shop shouts at you. A blank box means that route is off no matter
            what is ticked below. Drivers are reached on the number and address held against them in
            <strong> Dispatch</strong>.
          </p>
          <button className="btn btn-primary">Save contact details</button>
        </section>
      </form>

      {/* ── the switchboard ──────────────────────────────────────────── */}
      <form action={saveRules}>
        <section className="fp-panel">
          <header>
            <h2>What gets sent, and to whom</h2>
          </header>

          <div style={{ overflowX: "auto" }}>
            <table className="fp-nottable">
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }}>When this happens</th>
                  {NOTIFY_AUDIENCES.map((a) => <th key={a} style={{ textAlign: "center" }}>{AUDIENCE_LABEL[a]}</th>)}
                </tr>
              </thead>
              <tbody>
                {NOTIFY_EVENTS.map((ev: NotifyEvent) => (
                  <tr key={ev}>
                    <th scope="row">
                      <strong>{EVENT_LABEL[ev]}</strong>
                      <span>{EVENT_HINT[ev]}</span>
                    </th>
                    {NOTIFY_AUDIENCES.map((a: NotifyAudience) => {
                      // Only draw a cell where the combination means something.
                      // A driver has no view on a review request.
                      if (!APPLICABLE[ev].includes(a)) {
                        return <td key={a} className="na" aria-hidden="true">&middot;</td>;
                      }
                      return (
                        <td key={a}>
                          <div className="fp-notcell">
                            {CHANNELS_FOR[a].map((c) => {
                              const key = `${ev}|${a}|${c}`;
                              return (
                                <label key={c} className={`fp-notsw ${c}`}>
                                  {/* The hidden twin records that this switch was on the
                                      page: an unticked box posts nothing, so without it
                                      "off" and "absent" are the same thing on save. */}
                                  <input type="hidden" name="rule" value={key} />
                                  <input type="checkbox" name="on" value={key} defaultChecked={isOn(ev, a, c)} />
                                  <span>{c === "email" ? "Email" : c === "sms" ? "Text" : "Push"}</span>
                                  <a
                                    className="fp-notpeek"
                                    href={`/admin/notifications/preview?event=${ev}&audience=${a}&channel=${c}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={`Preview this ${c === "email" ? "email" : c === "sms" ? "text" : "notification"}`}
                                    aria-label={`Preview the ${EVENT_LABEL[ev]} ${c === "email" ? "email" : c === "sms" ? "text" : "notification"} to the ${AUDIENCE_LABEL[a].toLowerCase()}`}
                                  >&#8599;</a>
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 20, flexWrap: "wrap" }}>
            <button className="btn btn-primary">Save all changes</button>
            <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
              Nothing is saved until you press this. The <strong>&#8599;</strong> on any switch opens
              that exact message, rendered against your most recent real order.
            </span>
          </div>
        </section>
      </form>
    </>
  );
}
