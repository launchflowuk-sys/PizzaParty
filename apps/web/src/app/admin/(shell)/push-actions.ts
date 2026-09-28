"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientRow } from "@/lib/menu";
import { env } from "@/lib/env";
import { sendPush, type PushMessage } from "@/lib/notify";
import { segmentWhere, AVG_BASKET_SEGMENTS } from "@/lib/segments";
import {
  parseOffer, parseAudience, audienceSegment, pushCustomerWhere, groupEligible, chunk, mintCodes,
  validateCustomOffer, offerUrl, fillPush, APP_MENU, DUPLICATE_WINDOW_MS, PUSH_TITLE_MAX, PUSH_BODY_MAX,
  type CustomOffer,
} from "@/lib/push-offers";

/**
 * An offer, pushed to the app.
 *
 * The same shape as an SMS campaign - one Campaign row, one MarketingSend per
 * customer carrying the code - so redemptions flow back through
 * `attributeOrder` and the Sent table and Marketing screen measure it with no
 * special case. The differences are the ones push forces: the audience is
 * people with a live device who opted in, a hand-picked send gets one code per
 * person, and a tap on the notification opens the offer in the app.
 */

export type PushSendState = { ok: boolean; message: string } | null;

type Resolved = { promoCode: string; url: string; custom: CustomOffer | null; perCustomer: boolean };

async function resolveOffer(clientId: string, fd: FormData, picked: boolean): Promise<Resolved | { error: string }> {
  const offer = parseOffer(String(fd.get("offer") ?? ""));
  const now = new Date();

  if (offer.kind === "deal") {
    const deal = await prisma.deal.findFirst({ where: { id: offer.id, clientId, active: true }, select: { slug: true } });
    if (!deal) return { error: "That deal is no longer live." };
    return { promoCode: "", url: offerUrl({ dealSlug: deal.slug }), custom: null, perCustomer: false };
  }

  if (offer.kind === "slot") {
    const slot = await prisma.promoSlot.findFirst({
      where: {
        id: offer.id, clientId, active: true,
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      select: { target: true },
    });
    if (!slot) return { error: "That home-screen card is not live any more." };
    return { promoCode: "", url: offerUrl({ slotTarget: slot.target }), custom: null, perCustomer: false };
  }

  if (offer.kind === "promo") {
    const p = await prisma.promo.findFirst({
      where: {
        clientId, code: offer.code, active: true, issuedToCustomerId: "",
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, { OR: [{ startsAt: null }, { startsAt: { lte: now } }] }],
      },
      select: { code: true, maxUses: true, uses: true },
    });
    if (!p || (p.maxUses !== null && p.uses >= p.maxUses)) return { error: "That code is not live any more." };
    return { promoCode: p.code, url: APP_MENU, custom: null, perCustomer: false };
  }

  if (offer.kind === "custom") {
    const v = validateCustomOffer({
      code: String(fd.get("customCode") ?? ""),
      type: String(fd.get("customType") ?? ""),
      value: Number(fd.get("customValue") ?? 0),
      minOrderPounds: Number(fd.get("customMin") ?? 0),
      days: Number(fd.get("customDays") ?? 0),
    });
    if ("error" in v) return v;
    // Only the shared code can collide with one the shop already has. The
    // per-person ones carry a random tail.
    if (!picked && await prisma.promo.findFirst({ where: { clientId, code: v.offer.code }, select: { id: true } })) {
      return { error: `There is already a code called ${v.offer.code}. Pick another name.` };
    }
    return { promoCode: v.offer.code, url: APP_MENU, custom: v.offer, perCustomer: picked };
  }

  return { promoCode: "", url: APP_MENU, custom: null, perCustomer: false };
}

export async function sendPushOffer(_prev: PushSendState, fd: FormData): Promise<PushSendState> {
  const staff = await currentStaff();
  if (!staff) throw new Error("Unauthorised");
  if (!can(staff.role, "campaigns")) throw new Error("Forbidden");
  const client = await getClientRow();

  const title = String(fd.get("title") ?? "").trim().slice(0, PUSH_TITLE_MAX);
  const body = String(fd.get("body") ?? "").trim().slice(0, PUSH_BODY_MAX);
  if (!title || !body) return { ok: false, message: "A notification needs a title and a message." };

  // Read fresh: the cached client row can be minutes behind the switch.
  const live = await prisma.client.findUnique({ where: { id: client.id }, select: { notificationsOn: true } });
  if (!live?.notificationsOn) return { ok: false, message: "Notifications are switched off for the shop. Turn them on under Notifications first." };

  const audience = parseAudience(String(fd.get("audience") ?? ""), String(fd.get("ids") ?? ""));
  if (audience.kind === "picked" && audience.ids.length === 0) return { ok: false, message: "Pick at least one customer." };

  const offer = await resolveOffer(client.id, fd, audience.kind === "picked");
  if ("error" in offer) return { ok: false, message: offer.error };

  // Consent is in the query, not only on the screen: a hand-picked id that has
  // since opted out, or whose phone has dropped the app, is simply not found.
  const where: Prisma.CustomerWhereInput = {
    ...pushCustomerWhere(client.id),
    ...(audience.kind === "segment" ? segmentWhere(audience.key) : audience.kind === "picked" ? { id: { in: audience.ids } } : {}),
  };
  // ponytail: one unbounded read; page it if a shop ever has tens of thousands of app users.
  let customers = await prisma.customer.findMany({
    where,
    select: {
      id: true, name: true, ordersCount: true, totalSpent: true, marketingOptIn: true, deletedAt: true,
      pushDevices: { where: { disabledAt: null }, select: { token: true, disabledAt: true } },
    },
  });
  const minAvg = audience.kind === "segment" ? AVG_BASKET_SEGMENTS[audience.key] : undefined;
  if (minAvg) customers = customers.filter((c) => c.ordersCount > 0 && c.totalSpent / c.ordersCount >= minAvg);

  const devices = groupEligible(customers.flatMap((c) =>
    c.pushDevices.map((d) => ({ token: d.token, customerId: c.id, disabledAt: d.disabledAt, customer: c }))));
  const people = customers.filter((c) => devices.has(c.id));
  if (people.length === 0) return { ok: false, message: "Nobody in that audience has the app and has opted in." };

  const channel = env.pushDryRun ? "push-dry-run" : "push";
  // Two different hand-picked lists with the same wording are two sends, so a
  // picked audience carries a fingerprint of who is on it.
  const segment = audience.kind === "picked"
    ? `custom#${createHash("sha1").update(people.map((p) => p.id).sort().join(",")).digest("hex").slice(0, 12)}`
    : audienceSegment(audience);
  const codes = offer.perCustomer && offer.custom ? mintCodes(offer.custom.code, people.map((p) => p.id)) : null;

  // The double-click guard. Two submits of the same send queue on one advisory
  // lock per shop; the second then finds the first's row and stops. Codes are
  // minted in the same transaction so a refused duplicate mints nothing.
  const started = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${`push-campaign:${client.id}`}))) AS l`;
    const dup = await tx.campaign.findFirst({
      where: {
        clientId: client.id, channel, segment, subject: title, body,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (dup) return null;

    const c = offer.custom;
    if (c) {
      const base = { clientId: client.id, type: c.type, value: c.value, minOrder: c.minOrder, endsAt: c.endsAt, active: true };
      if (codes) {
        await tx.promo.createMany({
          data: people.map((p) => ({ ...base, code: codes.get(p.id)!, maxUses: 1, issuedToCustomerId: p.id })),
        });
      } else {
        await tx.promo.create({ data: { ...base, code: c.code } });
      }
    }
    return tx.campaign.create({
      data: { clientId: client.id, channel, segment, promoCode: offer.promoCode, subject: title, body, sent: 0, failed: 0 },
    });
  });
  if (!started) return { ok: false, message: "That exact notification went to that audience a few minutes ago, so it was not sent again." };

  const codeFor = (id: string) => codes?.get(id) ?? offer.promoCode;
  const messages: PushMessage[] = people.flatMap((p) => devices.get(p.id)!.map((to) => ({
    to,
    title: fillPush(title, p.name, codeFor(p.id), client.name),
    body: fillPush(body, p.name, codeFor(p.id), client.name),
    // `url` is an expo-router path; the app opens it when the notification is tapped.
    data: { url: offer.url, promoCode: codeFor(p.id), campaignId: started.id, kind: "offer" },
  })));

  // One Expo request per hundred, each on its own so a failed batch does not
  // take the rest of the list down with it.
  const accepted = new Set<string>();
  const dead: string[] = [];
  let lastError = "";
  for (const batch of chunk(messages)) {
    const r = await sendPush(batch);
    r.accepted.forEach((t) => accepted.add(t));
    dead.push(...r.dead);
    if (r.error) lastError = r.error;
  }

  const results = people.map((p) => ({ p, ok: devices.get(p.id)!.some((t) => accepted.has(t)) }));
  await prisma.marketingSend.createMany({
    data: results.map(({ p, ok }) => ({
      clientId: client.id, campaignId: started.id, customerId: p.id, channel,
      kind: "campaign", promoCode: codeFor(p.id), costPence: 0,
      status: ok ? "sent" : "failed", error: ok ? "" : lastError.slice(0, 300),
    })),
  });
  const sent = results.filter((r) => r.ok).length;
  await prisma.campaign.update({ where: { id: started.id }, data: { sent, failed: results.length - sent } });

  // Same retirement the order notifications do.
  if (dead.length) await prisma.pushDevice.updateMany({ where: { token: { in: dead } }, data: { disabledAt: new Date() } });

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/marketing");
  const dry = env.pushDryRun ? " (dry run: nothing left this machine)" : "";
  return { ok: sent > 0, message: `Sent to ${sent} of ${results.length} customer${results.length === 1 ? "" : "s"}${dry}.${lastError ? ` Expo said: ${lastError}` : ""}` };
}
