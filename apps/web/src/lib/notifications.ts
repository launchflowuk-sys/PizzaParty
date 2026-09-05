import "server-only";
import { prisma, type NotifyAudience, type NotifyChannel, type NotifyEvent } from "@launchflow/db";
import type { FullOrder } from "@/lib/orders";
import { sendEmail, sendSms } from "@/lib/notify";
import { emailFor, smsFor, type MailContext } from "@/lib/email/templates";

/**
 * One way in for every notification.
 *
 * Before this, each place in the order lifecycle decided for itself who to tell
 * and how - so "does the owner hear about refunds" was answered by reading
 * code, and turning something off meant a deploy. Now every send goes through
 * `notify()`, which asks the database what the shop has switched on.
 *
 * The costs are the reason it works this way. A text is roughly four pence and
 * an email is free, so a shop doing two hundred orders a week that texts every
 * status change is spending real money telling people things they would happily
 * read in an inbox. Every event therefore exists on both channels, and the shop
 * chooses per event, per audience, which of them actually fire.
 *
 * Nothing here throws. A notification failing must never roll back an order
 * that has already been paid for - the failure is written to the order timeline
 * and the kitchen still gets its food to cook.
 */

type Recipient = { email: string; sms: string };

/** Who each audience actually is, for this order. */
async function recipients(order: FullOrder): Promise<Record<NotifyAudience, Recipient>> {
  const client = await prisma.client.findUnique({
    where: { id: order.clientId },
    select: { kitchenEmail: true, kitchenSms: true, ownerEmail: true, ownerSms: true },
  });

  // The driver holding this job. Dispatch tracks it on the driver rather than
  // the order, so this is the way round it has to be asked.
  const driver = await prisma.driver.findFirst({
    where: { clientId: order.clientId, activeOrderId: order.id },
    select: { email: true, phone: true },
  });

  return {
    customer: { email: order.customerEmail, sms: order.customerPhone },
    kitchen: { email: client?.kitchenEmail ?? "", sms: client?.kitchenSms ?? "" },
    admin: { email: client?.ownerEmail ?? "", sms: client?.ownerSms ?? "" },
    driver: { email: driver?.email ?? "", sms: driver?.phone ?? "" },
  };
}

async function record(orderId: string, type: string, message: string) {
  try {
    await prisma.orderEvent.create({ data: { orderId, type, actor: "system", message } });
  } catch {
    // The timeline is a record, not a dependency. If it cannot be written the
    // message has still been sent, and losing the note is better than throwing.
  }
}

export type NotifyExtras = { reason?: string; refund?: number };

/**
 * Tell everybody who has asked to be told about this.
 *
 * Returns what was attempted, so the caller can log it - but never rejects.
 */
export async function notify(
  event: NotifyEvent,
  order: FullOrder,
  extras: NotifyExtras = {},
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  try {
    const client = await prisma.client.findUnique({
      where: { id: order.clientId },
      select: { notificationsOn: true },
    });
    // The master switch. A shop having a bad night can silence the lot from one
    // place rather than hunting through thirty toggles.
    if (client && !client.notificationsOn) return { sent: 0, skipped: 0 };

    const rules = await prisma.notificationRule.findMany({
      where: { clientId: order.clientId, event, enabled: true },
      select: { audience: true, channel: true },
    });
    if (rules.length === 0) return { sent: 0, skipped: 0 };

    const to = await recipients(order);
    const ctx: MailContext = { order, ...extras };

    // Sequential rather than Promise.all: a burst of parallel SMTP and Twilio
    // calls on a small box is how a busy Friday turns into timeouts.
    for (const rule of rules) {
      const audience = rule.audience as NotifyAudience;
      const channel = rule.channel as NotifyChannel;
      const who = to[audience];
      if (!who) { skipped++; continue; }

      if (channel === "email") {
        const mail = emailFor(event, audience, ctx);
        // No address, or nothing worth saying to this audience at this point.
        if (!mail || !who.email) { skipped++; continue; }
        const r = await sendEmail(who.email, mail.subject, mail.html);
        sent += r.ok ? 1 : 0;
        await record(order.id, r.ok ? "email_sent" : "email_failed", `${event} → ${audience}${r.ok ? "" : `: ${r.error}`}`);
      } else {
        const body = smsFor(event, audience, ctx);
        if (!body || !who.sms) { skipped++; continue; }
        const r = await sendSms(who.sms, body);
        sent += r.ok ? 1 : 0;
        await record(order.id, r.ok ? "sms_sent" : "sms_failed", `${event} → ${audience}${r.ok ? "" : `: ${r.error}`}`);
      }
    }
  } catch (e) {
    // Never let telling somebody about an order break the order.
    console.error("[notify] failed", event, (e as Error).message);
    await record(order.id, "notify_failed", `${event}: ${(e as Error).message}`);
  }

  return { sent, skipped };
}

/** Which status change maps to which notification. Not every status sends one. */
export const STATUS_EVENT: Record<string, NotifyEvent | undefined> = {
  placed: "order_placed",
  accepted: "order_accepted",
  preparing: "order_preparing",
  ready: "order_ready",
  out_for_delivery: "order_out_for_delivery",
  completed: "order_completed",
  rejected: "order_rejected",
};
