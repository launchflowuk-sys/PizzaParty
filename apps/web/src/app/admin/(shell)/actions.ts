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

/* ---------- Deals ---------- */
export async function updateDeal(fd: FormData) {
  await guard("deals");
  await prisma.deal.update({ where: { id: str(fd, "id") }, data: { price: toPence(num(fd, "price")), active: fd.get("active") === "on", featured: fd.get("featured") === "on" } });
  bump();
}

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

/* ---------- Campaigns ---------- */
export async function sendCampaign(fd: FormData) {
  const client = await guard("campaigns");
  const channel = str(fd, "channel") as "sms" | "email";
  const segment = str(fd, "segment");
  const body = str(fd, "body"); const subject = str(fd, "subject");
  if (!body) return;
  const { segmentWhere } = await import("@/lib/segments");
  const customers = await prisma.customer.findMany({ where: { clientId: client.id, marketingOptIn: true, ...segmentWhere(segment), ...(channel === "email" ? { email: { not: "" } } : {}) }, take: 2000 });
  const { sendSms, sendEmail, escapeHtml } = await import("@/lib/notify");
  let sent = 0, failed = 0;
  for (const c of customers) {
    const text = body.replace(/\{name\}/g, c.name.split(" ")[0] || "there");
    const r = channel === "sms" ? await sendSms(c.phone, `${text} Reply STOP to opt out.`) : await sendEmail(c.email, subject || "News from us", `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`);
    if (r.ok) sent++; else failed++;
  }
  await prisma.campaign.create({ data: { clientId: client.id, channel, segment, subject, body, sent, failed } });
  revalidatePath("/admin/campaigns");
}

/* ─── Inventory ─────────────────────────────────────────────────────────── */

export async function reorderStock(fd: FormData) {
  const client = await guard("inventory");
  const id = String(fd.get("id") ?? "");
  // Scoped by clientId so one tenant cannot touch another's stock line.
  await prisma.stockItem.updateMany({ where: { id, clientId: client.id }, data: { onOrder: true } });
  revalidatePath("/admin/inventory");
}

export async function reorderAllBelowPar() {
  const client = await guard("inventory");
  const items = await prisma.stockItem.findMany({ where: { clientId: client.id }, select: { id: true, onHand: true, par: true } });
  const ids = items.filter((i) => i.onHand < i.par).map((i) => i.id);
  if (ids.length) await prisma.stockItem.updateMany({ where: { id: { in: ids }, clientId: client.id }, data: { onOrder: true } });
  revalidatePath("/admin/inventory");
}

export async function receiveStock(fd: FormData) {
  const client = await guard("inventory");
  const id = String(fd.get("id") ?? "");
  const item = await prisma.stockItem.findFirst({ where: { id, clientId: client.id } });
  if (item) await prisma.stockItem.updateMany({ where: { id, clientId: client.id }, data: { onHand: item.par, onOrder: false } });
  revalidatePath("/admin/inventory");
}

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
