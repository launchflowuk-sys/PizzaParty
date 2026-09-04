"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@launchflow/db";
import { requireRole } from "@/lib/session";
import { getClientRow, MENU_TAG, CLIENT_TAG } from "@/lib/menu";
import { toPence } from "@/lib/money";

async function guard() {
  const a = (await requireRole("admin")) ?? (await requireRole("agency"));
  if (!a) throw new Error("Unauthorised");
  return getClientRow();
}
const num = (fd: FormData, k: string, d = 0) => { const v = Number(String(fd.get(k) ?? "").replace(/[£,\s]/g, "")); return Number.isFinite(v) ? v : d; };
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bump = () => { revalidateTag(MENU_TAG); revalidatePath("/admin", "layout"); };

/* ---------- Menu ---------- */
export async function updateSizePrice(fd: FormData) {
  await guard();
  await prisma.productSize.update({ where: { id: str(fd, "id") }, data: { price: toPence(num(fd, "price")) } });
  bump();
}
export async function toggleProduct(fd: FormData) {
  await guard();
  const field = str(fd, "field") as "soldOut" | "active" | "featured";
  const p = await prisma.product.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await prisma.product.update({ where: { id: p.id }, data: { [field]: !p[field] } });
  bump();
}
export async function moveProduct(fd: FormData) {
  await guard();
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
  await guard();
  const m = await prisma.modifier.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await prisma.modifier.update({ where: { id: m.id }, data: { soldOut: !m.soldOut } });
  bump();
}
export async function updateProductText(fd: FormData) {
  await guard();
  await prisma.product.update({ where: { id: str(fd, "id") }, data: { name: str(fd, "name"), description: str(fd, "description") } });
  bump();
}

/* ---------- Deals ---------- */
export async function updateDeal(fd: FormData) {
  await guard();
  await prisma.deal.update({ where: { id: str(fd, "id") }, data: { price: toPence(num(fd, "price")), active: fd.get("active") === "on", featured: fd.get("featured") === "on" } });
  bump();
}

/* ---------- Promos ---------- */
export async function upsertPromo(fd: FormData) {
  const client = await guard();
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
  await guard();
  const p = await prisma.promo.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await prisma.promo.update({ where: { id: p.id }, data: { active: !p.active } });
  revalidatePath("/admin/promos");
}

/* ---------- Hours / pause / zones ---------- */
export async function updateHours(fd: FormData) {
  await guard();
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
  await guard();
  const minutes = num(fd, "minutes");
  await prisma.location.update({ where: { id: str(fd, "locationId") }, data: { pausedUntil: minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null, pauseReason: minutes > 0 ? str(fd, "reason") : "" } });
  revalidatePath("/admin/hours");
}
export async function updateZone(fd: FormData) {
  await guard();
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
  const client = await guard();
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
