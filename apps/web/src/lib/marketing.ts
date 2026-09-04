import "server-only";
import { prisma, type Prisma } from "@launchflow/db";
import { sendSms, sendEmail, escapeHtml } from "./notify";
import { env } from "./env";

/**
 * Lifecycle marketing.
 *
 * The point of this is that the shop owns its customers. An aggregator rents
 * them back and keeps the relationship; here the shop can reach a lapsed
 * customer directly, and - crucially - see what that message earned.
 *
 * Every send carries a promo code. When an order later redeems that code, the
 * order's value is written back onto the send, so a campaign's revenue is
 * measured rather than guessed.
 */

/** Roughly what one SMS segment costs, in pence. Used for the cost estimate. */
export const SMS_COST_PENCE = 4;
export const EMAIL_COST_PENCE = 0;

export type TriggerKey = "win_back" | "second_order" | "first_order_thanks" | "birthday" | "quiet_night";

export const TRIGGERS: { key: TriggerKey; label: string; help: string; defaultDays: number }[] = [
  { key: "win_back", label: "Win back a lapsed customer", defaultDays: 45,
    help: "Someone who has not ordered for N days. Usually the single biggest earner." },
  { key: "second_order", label: "Nudge a one-time customer", defaultDays: 14,
    help: "Ordered exactly once, N days ago. Turning one order into two is where lifetime value is made." },
  { key: "first_order_thanks", label: "Thank a new customer", defaultDays: 1,
    help: "Ordered for the first time N days ago. Cheap goodwill, and it sets up the second order." },
  { key: "birthday", label: "Birthday treat", defaultDays: 0,
    help: "Needs a birthday on the customer record. Not collected yet, so this stays idle." },
  { key: "quiet_night", label: "Fill a quiet night", defaultDays: 30,
    help: "Ordered within N days and opted in. Send by hand when the kitchen is quiet." },
];

/** Merge fields a shop can use in the message body. */
export function render(template: string, c: { name: string; phone: string }, code: string, shop: string) {
  const first = (c.name || "").trim().split(/\s+/)[0] || "there";
  return template
    .replace(/\{name\}/gi, first)
    .replace(/\{shop\}/gi, shop)
    .replace(/\{code\}/gi, code)
    .trim();
}

type AudienceArgs = { clientId: string; trigger: string; days: number; cooldownDays: number; limit: number };

/**
 * Who should receive this automation right now.
 *
 * Three rules apply to every trigger, and they are the difference between
 * marketing and spam:
 *   - the customer must have opted in;
 *   - they must not have been contacted inside the cooldown window;
 *   - the audience is capped, so a misconfigured rule cannot text everybody.
 */
export async function audienceFor({ clientId, trigger, days, cooldownDays, limit }: AudienceArgs) {
  const now = Date.now();
  const cutoff = new Date(now - days * 86400_000);
  const cooldownSince = new Date(now - cooldownDays * 86400_000);

  const base: Prisma.CustomerWhereInput = {
    clientId,
    marketingOptIn: true,
    phone: { not: "" },
    // Not contacted recently by any automation.
    marketingSends: { none: { sentAt: { gte: cooldownSince } } },
  };

  const where: Prisma.CustomerWhereInput =
    trigger === "win_back"
      ? { ...base, ordersCount: { gt: 0 }, lastOrderAt: { lt: cutoff } }
      : trigger === "second_order"
        ? { ...base, ordersCount: 1, lastOrderAt: { lt: cutoff } }
        : trigger === "first_order_thanks"
          ? { ...base, ordersCount: 1, lastOrderAt: { gte: cutoff } }
          : trigger === "quiet_night"
            ? { ...base, ordersCount: { gt: 0 }, lastOrderAt: { gte: cutoff } }
            : // birthday has no data behind it yet, so it never matches
              { ...base, id: "__none__" };

  return prisma.customer.findMany({
    where,
    orderBy: { lastOrderAt: "desc" },
    take: Math.max(0, Math.min(limit, 1000)),
    select: { id: true, name: true, phone: true, email: true },
  });
}

/** Count only - used to show the owner the size and cost before he sends. */
export async function audienceSize(a: Omit<AudienceArgs, "limit">) {
  const rows = await audienceFor({ ...a, limit: 1000 });
  return rows.length;
}

export type RunResult = { sent: number; failed: number; skipped: number; costPence: number };

/**
 * Send one automation. `dryRun` counts the audience without contacting anyone,
 * which is what the admin screen uses for its estimate.
 */
export async function runAutomation(automationId: string, opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const a = await prisma.automation.findUnique({ where: { id: automationId } });
  if (!a) throw new Error("Automation not found");

  const client = await prisma.client.findUnique({ where: { id: a.clientId }, select: { name: true } });
  const shop = client?.name ?? "";

  const people = await audienceFor({
    clientId: a.clientId, trigger: a.trigger, days: a.days,
    cooldownDays: a.cooldownDays, limit: a.maxPerRun,
  });

  const unit = a.channel === "sms" ? SMS_COST_PENCE : EMAIL_COST_PENCE;
  if (opts.dryRun) return { sent: 0, failed: 0, skipped: people.length, costPence: people.length * unit };

  let sent = 0, failed = 0;
  for (const c of people) {
    const body = render(a.body, { name: c.name, phone: c.phone }, a.promoCode, shop);
    // UK marketing rules require an opt-out on every message.
    const text = a.channel === "sms" ? `${body}\n\nReply STOP to opt out` : body;

    let ok = false, error = "";
    try {
      if (a.channel === "sms") {
        const r = await sendSms(c.phone, text);
        ok = r.ok; error = r.error ?? "";
      } else if (c.email) {
        const r = await sendEmail(c.email, a.subject || shop, `<p>${escapeHtml(body)}</p>`);
        ok = r.ok; error = r.error ?? "";
      } else {
        error = "no email address";
      }
    } catch (e) {
      error = (e as Error).message;
    }

    await prisma.marketingSend.create({
      data: {
        clientId: a.clientId, automationId: a.id, customerId: c.id, channel: a.channel,
        promoCode: a.promoCode, costPence: ok ? unit : 0,
        status: ok ? "sent" : "failed", error: error.slice(0, 300),
      },
    });
    if (ok) sent++; else failed++;
  }

  await prisma.automation.update({ where: { id: a.id }, data: { lastRunAt: new Date() } });
  return { sent, failed, skipped: 0, costPence: sent * unit };
}

/**
 * Attribute an order back to the message that caused it.
 *
 * Called once an order is placed. If the order used a promo code, the most
 * recent unredeemed send of that code to that customer takes the credit, so a
 * campaign's revenue is real rather than modelled.
 */
export async function attributeOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clientId: true, customerId: true, promoCode: true, total: true },
  });
  if (!order?.promoCode || !order.customerId) return null;

  const send = await prisma.marketingSend.findFirst({
    where: {
      clientId: order.clientId, customerId: order.customerId,
      promoCode: { equals: order.promoCode, mode: "insensitive" },
      redeemedOrderId: "",
    },
    orderBy: { sentAt: "desc" },
  });
  if (!send) return null;

  await prisma.marketingSend.update({
    where: { id: send.id },
    data: { redeemedOrderId: order.id, redeemedAt: new Date(), revenuePence: order.total },
  });
  return send.id;
}

/** Spend, redemptions and revenue for one automation - the number that matters. */
export async function automationStats(automationId: string) {
  const [agg, redeemed] = await Promise.all([
    prisma.marketingSend.aggregate({
      where: { automationId, status: "sent" },
      _count: true, _sum: { costPence: true, revenuePence: true },
    }),
    prisma.marketingSend.count({ where: { automationId, redeemedOrderId: { not: "" } } }),
  ]);
  const spend = agg._sum.costPence ?? 0;
  const revenue = agg._sum.revenuePence ?? 0;
  return {
    sent: agg._count,
    redeemed,
    spendPence: spend,
    revenuePence: revenue,
    /** Net of the message cost. Not profit - the food still has to be made. */
    netPence: revenue - spend,
    conversion: agg._count ? redeemed / agg._count : 0,
  };
}

/** Whole-account totals for the dashboard. */
export async function marketingTotals(clientId: string) {
  const agg = await prisma.marketingSend.aggregate({
    where: { clientId, status: "sent" },
    _count: true, _sum: { costPence: true, revenuePence: true },
  });
  const redeemed = await prisma.marketingSend.count({ where: { clientId, redeemedOrderId: { not: "" } } });
  return {
    sent: agg._count, redeemed,
    spendPence: agg._sum.costPence ?? 0,
    revenuePence: agg._sum.revenuePence ?? 0,
  };
}

/**
 * What an aggregator would have charged on the orders this shop took directly.
 * Just Eat's commission sits around 14% + VAT for delivery; this is deliberately
 * conservative and labelled as an estimate wherever it is shown.
 */
export const AGGREGATOR_RATE = 0.14;

export async function commissionSaved(clientId: string, since: Date) {
  const agg = await prisma.order.aggregate({
    where: { clientId, placedAt: { gte: since }, status: { notIn: ["pending_payment", "cancelled", "rejected"] } },
    _sum: { total: true }, _count: true,
  });
  const revenue = agg._sum.total ?? 0;
  return { orders: agg._count, revenuePence: revenue, savedPence: Math.round(revenue * AGGREGATOR_RATE) };
}

export const CRON_SECRET_OK = (h: string | null) => !!env.cronSecret && h === `Bearer ${env.cronSecret}`;
