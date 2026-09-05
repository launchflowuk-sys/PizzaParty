"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can, type Screen } from "@/lib/permissions";
import { getClientRow, MENU_TAG, CLIENT_TAG } from "@/lib/menu";
import { toPence } from "@/lib/money";
import { TRIGGERS, runAutomation } from "@/lib/marketing";

/**
 * Every mutation goes through here. Hiding a link in the sidebar is cosmetic - without
 * this, a kitchen hand who knew the endpoint could still change prices. `screen` is the
 * permission the action needs, checked against the signed-in person's role.
 */
async function guard(screen: Screen) {
  const staff = await currentStaff();
  if (!staff) throw new Error("Unauthorised");
  if (!can(staff.role, screen)) throw new Error("Forbidden");
  return getClientRow();
}
const num = (fd: FormData, k: string, d = 0) => { const v = Number(String(fd.get(k) ?? "").replace(/[£,\s]/g, "")); return Number.isFinite(v) ? v : d; };
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bump = () => { revalidateTag(MENU_TAG); revalidatePath("/admin", "layout"); };

/* ---------- Menu ---------- */
export async function updateSizePrice(fd: FormData) {
  await guard("menu");
  await prisma.productSize.update({ where: { id: str(fd, "id") }, data: { price: toPence(num(fd, "price")) } });
  bump();
}
export async function toggleProduct(fd: FormData) {
  await guard("menu");
  const field = str(fd, "field") as "soldOut" | "active" | "featured";
  const p = await prisma.product.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await prisma.product.update({ where: { id: p.id }, data: { [field]: !p[field] } });
  bump();
}
export async function moveProduct(fd: FormData) {
  await guard("menu");
  const id = str(fd, "id"); const dir = str(fd, "dir") === "up" ? -1 : 1;
  const p = await prisma.product.findUniqueOrThrow({ where: { id } });
  const siblings = await prisma.product.findMany({ where: { categoryId: p.categoryId }, orderBy: { sortOrder: "asc" } });
  const i = siblings.findIndex((s) => s.id === id); const j = i + dir;
  if (j < 0 || j >= siblings.length) return;
  const order = siblings.map((s) => s.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  await prisma.$transaction(order.map((sid, k) => prisma.product.update({ where: { id: sid }, data: { sortOrder: k } })));
  bump();
}
export async function toggleModifier(fd: FormData) {
  await guard("menu");
  const m = await prisma.modifier.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await prisma.modifier.update({ where: { id: m.id }, data: { soldOut: !m.soldOut } });
  bump();
}
export async function updateProductText(fd: FormData) {
  await guard("menu");
  await prisma.product.update({ where: { id: str(fd, "id") }, data: { name: str(fd, "name"), description: str(fd, "description") } });
  bump();
}

/* Deals moved to deal-actions.ts, which can also add and remove them. */

/* ---------- Promos ---------- */
export async function upsertPromo(fd: FormData) {
  const client = await guard("promos");
  const code = str(fd, "code").toUpperCase();
  if (!code) return;
  const type = str(fd, "type") as "percent" | "fixed" | "free_delivery";
  const data = {
    type, value: type === "fixed" ? toPence(num(fd, "value")) : Math.round(num(fd, "value")), minOrder: toPence(num(fd, "minOrder")),
    firstOrderOnly: fd.get("firstOrderOnly") === "on", maxUses: num(fd, "maxUses") || null, endsAt: str(fd, "endsAt") ? new Date(str(fd, "endsAt")) : null, active: true,
    fulfilment: str(fd, "fulfilment") ? [str(fd, "fulfilment")] : [],
  };
  await prisma.promo.upsert({ where: { clientId_code: { clientId: client.id, code } }, create: { clientId: client.id, code, ...data }, update: data });
  revalidatePath("/admin/promos");
}
export async function togglePromo(fd: FormData) {
  await guard("promos");
  const p = await prisma.promo.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await prisma.promo.update({ where: { id: p.id }, data: { active: !p.active } });
  revalidatePath("/admin/promos");
}

/* ---------- Hours / pause / zones ---------- */
export async function updateHours(fd: FormData) {
  await guard("hours");
  const locationId = str(fd, "locationId");
  const rows: { dayOfWeek: number; opens: string; closes: string }[] = [];
  for (let d = 0; d < 7; d++) {
    const opens = str(fd, `opens${d}`), closes = str(fd, `closes${d}`);
    if (/^\d{2}:\d{2}$/.test(opens) && /^\d{2}:\d{2}$/.test(closes)) rows.push({ dayOfWeek: d, opens, closes });
  }
  await prisma.$transaction([prisma.openingHours.deleteMany({ where: { locationId } }), prisma.openingHours.createMany({ data: rows.map((r) => ({ ...r, locationId })) })]);
  revalidateTag(CLIENT_TAG); revalidatePath("/admin/hours"); revalidatePath("/");
}
export async function pauseLocation(fd: FormData) {
  await guard("hours");
  const minutes = num(fd, "minutes");
  await prisma.location.update({ where: { id: str(fd, "locationId") }, data: { pausedUntil: minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null, pauseReason: minutes > 0 ? str(fd, "reason") : "" } });
  revalidatePath("/admin/hours");
}
export async function updateZone(fd: FormData) {
  await guard("zones");
  await prisma.location.update({
    where: { id: str(fd, "locationId") },
    data: {
      postcodePrefixes: str(fd, "prefixes").split(/[,\s]+/).map((p) => p.toUpperCase()).filter(Boolean),
      deliveryFee: toPence(num(fd, "deliveryFee")), minOrder: toPence(num(fd, "minOrder")),
      prepMinutes: num(fd, "prepMinutes", 15), deliveryMinutes: num(fd, "deliveryMinutes", 35),
      address: str(fd, "address"), phone: str(fd, "phone"),
    },
  });
  revalidateTag(CLIENT_TAG); revalidatePath("/admin/zones");
}

/**
 * Add or update one delivery band.
 *
 * Scoped through the location's clientId so one tenant cannot reprice another
 * shop's deliveries by posting a stray id.
 */
export async function saveBand(fd: FormData) {
  const client = await guard("zones");
  const locationId = str(fd, "locationId");
  const location = await prisma.location.findFirst({ where: { id: locationId, clientId: client.id }, select: { id: true } });
  if (!location) return;

  const prefixes = str(fd, "prefixes")
    .split(/[,\s]+/).map((x) => x.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean);
  if (!prefixes.length) return;

  const data = {
    name: str(fd, "name").slice(0, 60),
    prefixes,
    fee: toPence(num(fd, "fee")),
    minOrder: toPence(num(fd, "minOrder")),
    extraMinutes: Math.max(0, Math.round(num(fd, "extraMinutes"))),
  };

  const id = str(fd, "id");
  if (id) {
    await prisma.deliveryBand.updateMany({ where: { id, locationId: location.id }, data });
  } else {
    const count = await prisma.deliveryBand.count({ where: { locationId: location.id } });
    await prisma.deliveryBand.create({ data: { ...data, locationId: location.id, sortOrder: count } });
  }
  revalidateTag(CLIENT_TAG);
  revalidatePath("/admin/zones");
}

export async function deleteBand(fd: FormData) {
  const client = await guard("zones");
  const id = str(fd, "id");
  const location = await prisma.location.findFirst({ where: { id: str(fd, "locationId"), clientId: client.id }, select: { id: true } });
  if (!location || !id) return;
  await prisma.deliveryBand.deleteMany({ where: { id, locationId: location.id } });
  revalidateTag(CLIENT_TAG);
  revalidatePath("/admin/zones");
}

/* ---------- Reviews ---------- */

/** Pull Google's current five, on demand. */
export async function syncReviewsNow() {
  await guard("reviews");
  const { syncGoogleReviews } = await import("@/lib/google-reviews");
  await syncGoogleReviews();
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

/**
 * Take a review off the storefront, or put it back.
 *
 * Hidden, never deleted. A shop taking a bad review off its own page should be
 * a deliberate and reversible act rather than a hole in the record - and the
 * review is still on Google either way, so pretending otherwise helps nobody.
 */
export async function toggleReviewHidden(fd: FormData) {
  const client = await guard("reviews");
  const id = str(fd, "id");
  const review = await prisma.review.findFirst({ where: { id, clientId: client.id }, select: { hidden: true } });
  if (!review) return;
  await prisma.review.updateMany({ where: { id, clientId: client.id }, data: { hidden: !review.hidden } });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

/** Pin a review to the front of the storefront strip. */
export async function toggleReviewFeatured(fd: FormData) {
  const client = await guard("reviews");
  const id = str(fd, "id");
  const review = await prisma.review.findFirst({ where: { id, clientId: client.id }, select: { featured: true } });
  if (!review) return;
  await prisma.review.updateMany({ where: { id, clientId: client.id }, data: { featured: !review.featured } });
  revalidatePath("/admin/reviews");
  revalidatePath("/");
}

/* ---------- Campaigns ---------- */

/**
 * Send a one-off campaign to a segment.
 *
 * Unlike an automation this fires once, when the owner says so - "we've got a
 * new garlic bread", "the shop is shut Tuesday". It is measured the same way:
 * every recipient gets a MarketingSend row carrying the offer code, so when one
 * of them orders with that code the money lands against this campaign rather
 * than disappearing into general takings.
 */
export async function sendCampaign(fd: FormData) {
  const client = await guard("campaigns");
  const channel = str(fd, "channel") === "email" ? "email" : "sms";
  const segment = str(fd, "segment");
  const body = str(fd, "body");
  const subject = str(fd, "subject");
  const promoCode = str(fd, "promoCode").toUpperCase();
  if (!body) return;

  const { segmentWhere } = await import("@/lib/segments");
  const { SMS_COST_PENCE, EMAIL_COST_PENCE, render } = await import("@/lib/marketing");
  const { sendSms, sendEmail, escapeHtml } = await import("@/lib/notify");

  const customers = await prisma.customer.findMany({
    where: {
      clientId: client.id,
      marketingOptIn: true,
      ...segmentWhere(segment),
      ...(channel === "email" ? { email: { not: "" } } : { phone: { not: "" } }),
    },
    take: 2000,
    select: { id: true, name: true, phone: true, email: true },
  });

  const campaign = await prisma.campaign.create({
    data: { clientId: client.id, channel, segment, promoCode, subject, body, sent: 0, failed: 0 },
  });

  const unit = channel === "sms" ? SMS_COST_PENCE : EMAIL_COST_PENCE;
  let sent = 0, failed = 0;
  for (const c of customers) {
    const text = render(body, { name: c.name, phone: c.phone }, promoCode, client.name);
    let ok = false, error = "";
    try {
      const r = channel === "sms"
        ? await sendSms(c.phone, `${text}\n\nReply STOP to opt out`)
        : await sendEmail(c.email, subject || client.name, `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`);
      ok = r.ok; error = r.error ?? "";
    } catch (e) {
      error = (e as Error).message;
    }

    await prisma.marketingSend.create({
      data: {
        clientId: client.id, campaignId: campaign.id, customerId: c.id, channel,
        kind: "campaign", promoCode, costPence: ok ? unit : 0,
        status: ok ? "sent" : "failed", error: error.slice(0, 300),
      },
    });
    if (ok) sent++; else failed++;
  }

  await prisma.campaign.update({ where: { id: campaign.id }, data: { sent, failed } });
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/marketing");
}

/* ─── Inventory ─────────────────────────────────────────────────────────── */

/* Stock moved to stock-actions.ts, which can also add, edit and remove lines,
   book in a delivery by quantity, and reorder one supplier at a time. */

/* ─── Dispatch ──────────────────────────────────────────────────────────── */

export async function assignDriver(fd: FormData) {
  const client = await guard("dispatch");
  const driverId = String(fd.get("driverId") ?? "");
  const orderId = String(fd.get("orderId") ?? "");
  if (!driverId || !orderId) return;
  const order = await prisma.order.findFirst({ where: { id: orderId, clientId: client.id }, select: { id: true } });
  if (!order) return;
  await prisma.driver.updateMany({
    where: { id: driverId, clientId: client.id },
    data: { status: "on_delivery", activeOrderId: orderId, backAt: new Date(Date.now() + 30 * 60_000) },
  });
  revalidatePath("/admin/dispatch");
}

export async function setDriverStatus(fd: FormData) {
  const client = await guard("dispatch");
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "available");
  if (!["available", "on_delivery", "off"].includes(status)) return;
  await prisma.driver.updateMany({
    where: { id, clientId: client.id },
    data: { status, ...(status === "available" ? { activeOrderId: "", backAt: null } : {}) },
  });
  revalidatePath("/admin/dispatch");
}

/* ─── Staff ─────────────────────────────────────────────────────────────── */

const ROLES = ["manager", "shift_lead", "kitchen", "driver", "front_of_house"];

export async function setStaffRole(fd: FormData) {
  const client = await guard("staff");
  const id = String(fd.get("id") ?? "");
  const role = String(fd.get("role") ?? "");
  if (!ROLES.includes(role)) return;
  await prisma.staff.updateMany({ where: { id, clientId: client.id }, data: { role } });
  revalidatePath("/admin/staff");
}

export async function toggleShift(fd: FormData) {
  const client = await guard("staff");
  const id = String(fd.get("id") ?? "");
  const member = await prisma.staff.findFirst({ where: { id, clientId: client.id } });
  if (member) await prisma.staff.updateMany({ where: { id, clientId: client.id }, data: { onShift: !member.onShift } });
  revalidatePath("/admin/staff");
}

/* ─── Reviews ───────────────────────────────────────────────────────────── */

export async function replyToReview(fd: FormData) {
  const client = await guard("reviews");
  const id = String(fd.get("id") ?? "");
  const reply = String(fd.get("reply") ?? "").trim().slice(0, 1000);
  if (!reply) return;
  await prisma.review.updateMany({ where: { id, clientId: client.id }, data: { reply, repliedAt: new Date() } });
  revalidatePath("/admin/reviews");
}

/* ─── Marketing ─────────────────────────────────────────────────────────── */

export async function saveAutomation(fd: FormData) {
  const client = await guard("marketing");
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const trigger = String(fd.get("trigger") ?? "win_back");
  const body = String(fd.get("body") ?? "").trim().slice(0, 280);
  if (!name || !body) return;
  if (!TRIGGERS.some((t) => t.key === trigger)) return;

  const num = (k: string, d: number, min: number, max: number) => {
    const v = Number(fd.get(k)); return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d;
  };

  const data = {
    trigger, body,
    channel: "sms",
    days: num("days", 45, 0, 365),
    cooldownDays: num("cooldownDays", 30, 1, 365),
    maxPerRun: num("maxPerRun", 200, 1, 1000),
    promoCode: String(fd.get("promoCode") ?? "").trim().toUpperCase().slice(0, 30),
    // New automations start paused. Nobody should be able to create a rule that
    // texts the whole customer list the moment it is saved.
    active: false,
  };
  await prisma.automation.upsert({
    where: { clientId_name: { clientId: client.id, name } },
    create: { clientId: client.id, name, ...data },
    update: data,
  });
  revalidatePath("/admin/marketing");
}

export async function toggleAutomation(fd: FormData) {
  const client = await guard("marketing");
  const id = String(fd.get("id") ?? "");
  const a = await prisma.automation.findFirst({ where: { id, clientId: client.id } });
  if (a) await prisma.automation.updateMany({ where: { id, clientId: client.id }, data: { active: !a.active } });
  revalidatePath("/admin/marketing");
}

export async function runAutomationNow(fd: FormData) {
  const client = await guard("marketing");
  const id = String(fd.get("id") ?? "");
  const a = await prisma.automation.findFirst({ where: { id, clientId: client.id }, select: { id: true } });
  if (!a) return;
  await runAutomation(a.id);
  revalidatePath("/admin/marketing");
}
