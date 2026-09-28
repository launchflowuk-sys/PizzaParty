import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@launchflow/db";
import { env } from "./env";
import { getConfig } from "./config";
import { getClientRow, getLocations, getMenu } from "./menu";
import { gbp } from "./money";
import { addEvent, createOrder, isUniqueViolation, markPlaced, transitionOrder } from "./orders";
import { DeliverectOrder, deliverectStatusFor, mapDeliverectOrder, parseChannels, type MenuIndex } from "./deliverect-map";
import { MARKETPLACE_NAME, MARKETPLACE_SOURCES, isMarketplaceSource, type MarketplaceSource, type PosMarketplaceStatus } from "./pos-phase4-types";

/**
 * Deliverect: Just Eat, Deliveroo and Uber Eats orders into the same queue,
 * and our status changes back out to them. Parsing lives in deliverect-map.ts;
 * this file is the I/O. Switched on by DELIVERECT_SECRET alone (orders in);
 * status push-back also needs DELIVERECT_API_BASE + client id/secret.
 */

export const deliverectOn = () => !!env.deliverectSecret;
const pushOn = () => !!(env.deliverectApiBase && env.deliverectClientId && env.deliverectClientSecret);

/**
 * Deliverect signs the raw body: HMAC-SHA256 keyed by the partner secret (on
 * staging, the channel link id), sent as `x-server-authorization-hmac-sha256`.
 * Hex is what we expect; base64 is accepted too in case their encoding differs.
 */
export function hmacValid(raw: string, header: string, secret = env.deliverectSecret): boolean {
  if (!secret || !header) return false;
  const mac = createHmac("sha256", secret).update(raw, "utf8").digest();
  const got = header.trim();
  return [mac.toString("hex"), mac.toString("base64")].some((want) => {
    const a = Buffer.from(want);
    const b = Buffer.from(got);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

async function menuIndex(): Promise<MenuIndex> {
  const menu = await getMenu();
  return {
    products: menu.categories.flatMap((c) => c.products).map((p) => ({
      id: p.id, slug: p.slug, name: p.name,
      sizes: p.sizes.map((s) => ({ key: s.key, name: s.name })),
      groups: p.modifierGroups.map((pg) => ({ key: pg.group.key, name: pg.group.name, modifiers: pg.group.modifiers.map((m) => ({ key: m.key, name: m.name })) })),
    })),
    deals: menu.deals.map((d) => ({ id: d.id, slug: d.slug, name: d.name })),
  };
}

/** "<deliverect location id>=<our location key>,..."; empty = the first location. */
async function locationFor(deliverectLocation: string) {
  const locations = await getLocations();
  const key = env.deliverectLocations.split(",").map((p) => p.split("=").map((s) => s.trim())).find(([k]) => k && k === deliverectLocation)?.[1];
  return (key && locations.find((l) => l.key === key)) || locations[0] || null;
}

/** One shared customer row per marketplace: the platform owns the relationship, and the phone is not E.164 so nothing we send can reach it. */
function marketplaceCustomer(clientId: string, source: MarketplaceSource) {
  const phone = `marketplace:${source}`;
  return prisma.customer.upsert({ where: { clientId_phone: { clientId, phone } }, create: { clientId, phone, name: `${MARKETPLACE_NAME[source]} customer`, guest: true }, update: {} });
}

export type IngestResult = { status: number; body: Record<string, unknown> };

/** A verified webhook body → an order in the queue (or the one it already made). */
export async function ingestOrder(json: unknown): Promise<IngestResult> {
  const parsed = DeliverectOrder.safeParse(json);
  if (!parsed.success) return { status: 400, body: { error: "Not a Deliverect order.", issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`) } };
  const client = await getClientRow();
  const fallback = isMarketplaceSource(env.deliverectDefaultSource) ? env.deliverectDefaultSource : "deliveroo";
  const m = mapDeliverectOrder(parsed.data, await menuIndex(), parseChannels(env.deliverectChannels), fallback);

  const known = await prisma.order.findUnique({ where: { clientId_externalRef: { clientId: client.id, externalRef: m.externalRef } }, select: { id: true, status: true } });
  if (m.cancelled) {
    if (!known) return { status: 200, body: { ok: true, ignored: "cancel for an order we never had" } };
    // The platform cancelled it (and refunds its customer). A manager does not need to sign that off.
    try { await transitionOrder(known.id, "cancelled", MARKETPLACE_NAME[m.source], { reason: `Cancelled by ${MARKETPLACE_NAME[m.source]}`, approvedBy: MARKETPLACE_NAME[m.source], fromMarketplace: true }); } catch (e) {
      await addEvent(known.id, "note", "deliverect", `Cancel from ${MARKETPLACE_NAME[m.source]} not applied: ${(e as Error).message}`);
    }
    return { status: 200, body: { ok: true, orderId: known.id, cancelled: true } };
  }
  if (known) return { status: 200, body: { ok: true, orderId: known.id, duplicate: true } };

  const location = await locationFor(parsed.data.location);
  if (!location) return { status: 503, body: { error: "The shop has no active location." } };
  const customer = await marketplaceCustomer(client.id, m.source);
  const name = MARKETPLACE_NAME[m.source];
  let order;
  try {
    order = await createOrder({
      clientId: client.id, locationId: location.id, customerId: customer.id,
      fulfilment: m.fulfilment, paymentMethod: m.paid ? "card" : "cash",
      customerName: m.customer.name, customerPhone: m.customer.phone, customerEmail: "",
      address: m.address ?? undefined, postcode: m.address?.postcode ?? "", notes: m.notes, scheduledFor: m.scheduledFor,
      priced: { lines: m.lines, subtotal: m.subtotal, deliveryFee: m.deliveryFee, discount: m.discount, total: m.total, promoCode: "", promoMessage: "", errors: [], removedKeys: [] },
      lines: m.basket, source: m.source, takenBy: null,
      // Their money, already taken - or cash our driver collects on the door.
      payment: m.paid ? { provider: "marketplace", status: "succeeded", amount: m.total } : { provider: "cash", status: "cash_pending", amount: m.total },
      extra: { externalRef: m.externalRef, externalDisplayId: m.displayId, courier: m.courier, tableNumber: m.tableNumber, needsAttention: m.needsAttention },
      actor: name, eventMessage: `${name} #${m.displayId} · ${m.courier ? "rider collects" : m.fulfilment} · ${gbp(m.total)} ${m.paid ? "paid" : "cash due"}${m.test ? " · TEST" : ""}`,
    });
  } catch (e) {
    // The same order delivered twice at once: the unique key let one through.
    if (isUniqueViolation(e)) {
      const first = await prisma.order.findUnique({ where: { clientId_externalRef: { clientId: client.id, externalRef: m.externalRef } }, select: { id: true } });
      if (first) return { status: 200, body: { ok: true, orderId: first.id, duplicate: true } };
    }
    throw e;
  }
  if (m.problems.length) await addEvent(order.id, "needs_attention", "deliverect", m.problems.join(" · "), { problems: m.problems });
  await markPlaced(order.id, name);
  return { status: 200, body: { ok: true, orderId: order.id } };
}

/* ---------- Status push-back ---------- */

const RETRY_MS = [0, 2_000, 10_000, 60_000];
// On globalThis: the dev server loads this module once per route, and each copy would fetch its own token.
const g = globalThis as unknown as { __lfDeliverectToken?: { value: string; until: number } | null };

/** OAuth client-credentials token (Deliverect's /oauth/token, grant_type "token"). Cached until a minute before expiry. */
async function accessToken(): Promise<string> {
  const token = g.__lfDeliverectToken;
  if (token && token.until > Date.now()) return token.value;
  const res = await fetch(`${env.deliverectApiBase}/oauth/token`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.deliverectClientId, client_secret: env.deliverectClientSecret, audience: env.deliverectAudience || env.deliverectApiBase, grant_type: "token" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const j = (await res.json()) as { access_token?: string; expires_at?: number; expires_in?: number };
  if (!j.access_token) throw new Error("token: no access_token");
  const until = j.expires_at ? j.expires_at * 1000 : Date.now() + (j.expires_in ?? 3600) * 1000;
  g.__lfDeliverectToken = { value: j.access_token, until: until - 60_000 };
  return j.access_token;
}

/**
 * Tell Deliverect (and so the marketplace, its customer and its rider) that
 * the order moved. Fire and forget from transitionOrder; retries a few times,
 * and every attempt's outcome lands in the order's audit log.
 */
export async function pushStatus(orderId: string, to: string): Promise<void> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { externalRef: true, courier: true, rejectReason: true, number: true } });
  const status = o?.externalRef ? deliverectStatusFor(to, o.courier) : null;
  if (!o?.externalRef || status === null) return;
  if (!pushOn()) {
    await addEvent(orderId, "marketplace_status", "deliverect", `Not sent (${to}): DELIVERECT_API_BASE / client id / secret are not set`);
    return;
  }
  const body = { orderId: o.externalRef, status, reason: to === "rejected" || to === "cancelled" ? o.rejectReason || to : "", timeStamp: new Date().toISOString(), receiptId: String(o.number) };
  for (const [n, wait] of RETRY_MS.entries()) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const res = await fetch(`${env.deliverectApiBase}/orderStatus/${encodeURIComponent(o.externalRef)}`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await accessToken()}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 401) g.__lfDeliverectToken = null;
      if (res.ok) {
        await addEvent(orderId, "marketplace_status", "deliverect", `Sent ${to} (${status})${n ? ` on try ${n + 1}` : ""}`);
        return;
      }
      // A 4xx other than auth will not get better by asking again.
      if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
        await addEvent(orderId, "marketplace_status_failed", "deliverect", `${to} (${status}) refused: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
        return;
      }
      if (n === RETRY_MS.length - 1) await addEvent(orderId, "marketplace_status_failed", "deliverect", `${to} (${status}) failed after ${n + 1} tries: HTTP ${res.status}`);
    } catch (e) {
      if (n === RETRY_MS.length - 1) await addEvent(orderId, "marketplace_status_failed", "deliverect", `${to} (${status}) failed after ${n + 1} tries: ${(e as Error).message}`);
    }
  }
  // ponytail: retries live in this process only; a restart mid-retry drops them (the audit log shows it). Queue in the DB if that ever matters.
}

/* ---------- Menu export ---------- */

/**
 * Our live menu as Deliverect products, keyed by the PLU scheme in
 * deliverect-map.ts. productType 1 = product, 2 = modifier, 3 = modifier group
 * (Deliverect's catalogue model). Prices in pence. A deal is exported as one
 * product at its bundle price; its choices are not modelled (the kitchen sees
 * what the marketplace sent as options).
 * TODO confirm with Deliverect: tax field names/units (we send 20% VAT as
 * 20000, their milli-percent) and whether the menu is pushed to their API or
 * imported from this URL.
 */
export async function menuExport() {
  const menu = await getMenu();
  const cfg = getConfig();
  const VAT = 20_000;
  const tax = { deliveryTax: VAT, takeawayTax: VAT, eatInTax: VAT };
  const products: Record<string, unknown>[] = [];
  const seenGroups = new Set<string>();
  for (const c of menu.categories) {
    for (const p of c.products) {
      const groups = p.modifierGroups.map((pg) => pg.group);
      for (const g of groups) {
        if (seenGroups.has(g.key)) continue;
        seenGroups.add(g.key);
        products.push({ productType: 3, plu: `group:${g.key}`, name: g.name, min: g.minSelect, max: g.maxSelect, subProducts: g.modifiers.map((m) => `mod:${g.key}:${m.key}`) });
        for (const m of g.modifiers) products.push({ productType: 2, plu: `mod:${g.key}:${m.key}`, name: m.name, price: m.price, snoozed: m.soldOut, ...tax });
      }
      const sizes = p.sizes.length > 1 ? p.sizes : [];
      const base = { name: p.name, description: p.description, imageUrl: p.image && /^https?:/.test(p.image) ? p.image : p.image ? `${env.siteUrl}${p.image.startsWith("/") ? "" : "/"}${p.image}` : "", categories: [c.slug], subProducts: groups.map((g) => `group:${g.key}`), ...tax };
      if (sizes.length) {
        for (const s of sizes) products.push({ productType: 1, plu: `${p.slug}@${s.key}`, ...base, name: `${p.name} (${s.name})`, price: s.price, snoozed: p.soldOut || s.soldOut });
      } else {
        products.push({ productType: 1, plu: p.slug, ...base, price: p.sizes[0]?.price ?? 0, snoozed: p.soldOut || !!p.sizes[0]?.soldOut });
      }
    }
  }
  for (const d of menu.deals) products.push({ productType: 1, plu: `deal:${d.slug}`, name: d.name, description: d.description, price: d.price, categories: ["deals"], ...tax });
  return {
    accountId: env.deliverectAccountId, locationId: env.deliverectLocationId, shop: cfg.name, currency: "GBP", priceUnit: "pence",
    categories: [...menu.categories.map((c) => ({ posCategoryId: c.slug, name: c.name })), ...(menu.deals.length ? [{ posCategoryId: "deals", name: "Deals" }] : [])],
    products,
  };
}

/* ---------- Settings card ---------- */

export async function marketplaceStatus(clientId: string): Promise<PosMarketplaceStatus> {
  const on = deliverectOn();
  const mapped = new Set(Object.values(parseChannels(env.deliverectChannels)));
  const last = await prisma.order.groupBy({ by: ["source"], where: { clientId, source: { in: [...MARKETPLACE_SOURCES] } }, _max: { createdAt: true } });
  return {
    provider: on ? "deliverect" : "none",
    configured: on && pushOn(),
    channels: MARKETPLACE_SOURCES.map((source) => ({
      source, name: MARKETPLACE_NAME[source], enabled: on && mapped.has(source),
      lastOrderAt: last.find((l) => l.source === source)?._max.createdAt?.toISOString() ?? null,
    })),
    webhookUrl: `${env.siteUrl}/api/integrations/deliverect/orders`,
  };
}
