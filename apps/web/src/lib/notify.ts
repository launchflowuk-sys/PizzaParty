import "server-only";
import { env } from "./env";

/* ---------- SMS (Twilio) ---------- */
export async function sendSms(to: string, body: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!to) return { ok: false, error: "no recipient" };
  if (!env.twilioSid || !env.twilioToken || !env.twilioFrom) {
    console.log(`[sms:dry-run] → ${to}: ${body}`);
    return { ok: true, id: "dry-run" };
  }
  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(env.twilioSid, env.twilioToken);
    const msg = await client.messages.create({ to, from: env.twilioFrom, body });
    return { ok: true, id: msg.sid };
  } catch (e) {
    console.error("[sms] failed", e);
    return { ok: false, error: (e as Error).message };
  }
}

/* ---------- Email (SMTP, via Nodemailer) ---------- */

/**
 * Mail goes out over plain SMTP.
 *
 * This used to be Resend's SDK. Nothing was wrong with Resend, but it was a
 * second vendor, a second bill and a second account to keep alive for a job the
 * shop's existing mailbox already does - and because an unset key silently
 * degrades to a dry run, it would have failed quietly rather than loudly.
 *
 * SMTP is the superset. Every provider worth using speaks it, the shop's own
 * mail host included, so changing where mail goes is an environment variable
 * rather than a code change and a redeploy.
 */
type Transport = { sendMail: (o: Record<string, unknown>) => Promise<{ messageId?: string }> };
let transport: Transport | null = null;

async function mailer(): Promise<Transport> {
  if (transport) return transport;
  const nodemailer = (await import("nodemailer")).default;
  transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    // Pooled and rate-limited because marketing sends to the whole customer
    // list in a loop. A connection per message is how a shop's mailbox gets
    // throttled, and then blocked, halfway through a campaign.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10,
  }) as unknown as Transport;
  return transport;
}

/**
 * A plain-text version of the HTML.
 *
 * Not decoration: a message with no text alternative scores worse with spam
 * filters, and a shop sending on its own name has less reputation to spare than
 * a large managed pool does. Cheap insurance for the one thing people worry
 * about when they stop using a sending service.
 */
function toText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!to) return { ok: false, error: "no recipient" };
  if (!env.smtpHost || !env.mailFrom) {
    console.log(`[email:dry-run] → ${to}: ${subject}`);
    return { ok: true, id: "dry-run" };
  }
  try {
    const t = await mailer();
    const info = await t.sendMail({ from: env.mailFrom, to, subject, html, text: toText(html) });
    return { ok: true, id: info.messageId };
  } catch (e) {
    // A dead connection stays cached otherwise, and every later send fails on
    // the same stale socket until somebody restarts the container.
    transport = null;
    console.error("[email] failed", e);
    return { ok: false, error: (e as Error).message };
  }
}

/* ---------- Printer webhook (Star CloudPRNT / ESC-POS bridge) ---------- */
export async function postPrinter(url: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!url) return { ok: false, error: "no printer webhook" };
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
    return { ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
