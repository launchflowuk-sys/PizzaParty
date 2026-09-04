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

/* ---------- Email (Resend) ---------- */
export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!to) return { ok: false, error: "no recipient" };
  if (!env.resendApiKey || !env.resendFrom) {
    console.log(`[email:dry-run] → ${to}: ${subject}`);
    return { ok: true, id: "dry-run" };
  }
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.resendApiKey);
    const r = await resend.emails.send({ from: env.resendFrom, to, subject, html });
    if (r.error) return { ok: false, error: r.error.message };
    return { ok: true, id: r.data?.id };
  } catch (e) {
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
