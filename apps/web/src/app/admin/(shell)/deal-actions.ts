"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientRow, MENU_TAG } from "@/lib/menu";
import { toPence } from "@/lib/money";

/**
 * Building deals.
 *
 * A deal is a fixed price and a list of slots - "2 x Large pizza", "1 x Side" -
 * and each slot says what may fill it: any item from these sections, or one of
 * these exact items, in these sizes. The customer picks; the price does not move.
 *
 * The deals screen used to say adding or deleting one was something only
 * LaunchFlow could do, which was true while the seeder rewrote deals from config
 * on every deploy. It no longer does, so the shop owns these too.
 */

async function guard() {
  const staff = await currentStaff();
  if (!staff) throw new Error("Unauthorised");
  if (!can(staff.role, "deals")) throw new Error("Forbidden");
  return getClientRow();
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, d = 0) => {
  const v = Number(String(fd.get(k) ?? "").replace(/[£,\s]/g, ""));
  return Number.isFinite(v) ? v : d;
};
/** Every ticked box of one name, e.g. all the sections a slot accepts. */
const many = (fd: FormData, k: string) => fd.getAll(k).map((v) => String(v).trim()).filter(Boolean);
const bump = () => { revalidateTag(MENU_TAG); revalidatePath("/admin", "layout"); };

/** As on the menu screen: the answer lands where the change was made. */
function target(fd: FormData, param: "m" | "e", message: string): never {
  const raw = String(fd.get("back") ?? "");
  const back = /^\/admin\/deals(\/[A-Za-z0-9_-]+)?$/.test(raw) ? raw : "/admin/deals";
  redirect(`${back}?${param}=${encodeURIComponent(message)}`);
}
// Declared as functions, not arrow consts: TypeScript only narrows past a
// `never` return for a function declaration, and these are used as guards.
function refuse(fd: FormData, message: string): never { target(fd, "e", message); }
function done(fd: FormData, message: string): never { target(fd, "m", message); }

function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
function uniqueKey(base: string, taken: Set<string>): string {
  const root = base || "deal";
  if (!taken.has(root)) return root;
  for (let i = 2; i < 500; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now()}`;
}

/* ---------- Deals ---------- */

/**
 * A new deal starts switched off.
 *
 * It has no slots yet, so a customer reaching it could pay the deal price for
 * nothing at all. It goes live once the shop has put something in it and ticked
 * Running.
 */
export async function createDeal(fd: FormData) {
  const client = await guard();
  const name = str(fd, "name");
  if (!name) refuse(fd, "Give the deal a name.");

  const taken = await prisma.deal.findMany({ where: { clientId: client.id }, select: { slug: true } });
  const rows = await prisma.deal.findMany({ where: { clientId: client.id }, select: { sortOrder: true } });

  const deal = await prisma.deal.create({
    data: {
      clientId: client.id,
      slug: uniqueKey(slugify(name), new Set(taken.map((d) => d.slug))),
      name,
      description: str(fd, "description"),
      price: toPence(num(fd, "price")),
      active: false,
      sortOrder: rows.reduce((mx, r) => Math.max(mx, r.sortOrder), -1) + 1,
    },
  });
  bump();
  redirect(`/admin/deals/${deal.id}?m=${encodeURIComponent("Deal created. Add what is in it, then switch it on.")}`);
}

export async function updateDeal(fd: FormData) {
  await guard();
  const name = str(fd, "name");
  if (!name) refuse(fd, "A deal needs a name.");

  const slots = await prisma.dealSlot.count({ where: { dealId: str(fd, "id") } });
  const wantsActive = fd.get("active") === "on";
  if (wantsActive && slots === 0) {
    refuse(fd, "This deal has nothing in it yet. Add at least one thing before switching it on.");
  }

  await prisma.deal.update({
    where: { id: str(fd, "id") },
    data: {
      name,
      description: str(fd, "description"),
      price: toPence(num(fd, "price")),
      active: wantsActive,
      featured: fd.get("featured") === "on",
      daysOfWeek: many(fd, "days").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
      fulfilment: many(fd, "fulfilment"),
    },
  });
  bump();
}

export async function deleteDeal(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const d = await prisma.deal.findUniqueOrThrow({ where: { id }, select: { name: true } });
  await prisma.deal.delete({ where: { id } });
  bump();
  // Past orders keep their own copy of what was sold, the same as products.
  redirect(`/admin/deals?m=${encodeURIComponent(`Deleted ${d.name}. Past orders are unaffected.`)}`);
}

/* ---------- What is in a deal ---------- */

/**
 * A slot is one line of the deal: "2 x Large pizza".
 *
 * It has to accept something, or a customer building the deal is shown an empty
 * picker and cannot get past it - so a slot with neither sections nor named
 * items is refused rather than saved broken.
 */
export async function saveSlot(fd: FormData) {
  await guard();
  const dealId = str(fd, "dealId");
  const name = str(fd, "name");
  if (!name) refuse(fd, "Give the line a name, like Large pizza.");

  const categorySlugs = many(fd, "categories");
  const productSlugs = many(fd, "products");
  if (categorySlugs.length === 0 && productSlugs.length === 0) {
    refuse(fd, `"${name}" does not accept anything yet. Tick at least one section, or pick the exact items it allows.`);
  }

  const data = {
    name,
    qty: Math.max(1, Math.round(num(fd, "qty", 1))),
    categorySlugs,
    productSlugs,
    sizeKeys: many(fd, "sizes"),
    extraPerModifier: fd.get("extraPerModifier") === "on",
  };

  const id = str(fd, "id");
  if (id) {
    await prisma.dealSlot.update({ where: { id }, data });
    bump();
    return;
  }

  const rows = await prisma.dealSlot.findMany({ where: { dealId }, select: { sortOrder: true } });
  await prisma.dealSlot.create({
    data: { ...data, dealId, sortOrder: rows.reduce((mx, r) => Math.max(mx, r.sortOrder), -1) + 1 },
  });
  bump();
  // Only for a new line: the blank form it was typed into clears on the way
  // back, so without a word it is not obvious anything happened.
  done(fd, `Added ${data.qty} × ${data.name} to the deal.`);
}

export async function deleteSlot(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const slot = await prisma.dealSlot.findUniqueOrThrow({ where: { id }, select: { dealId: true, name: true } });
  const remaining = await prisma.dealSlot.count({ where: { dealId: slot.dealId } });

  await prisma.dealSlot.delete({ where: { id } });
  // A deal with nothing in it must not stay on sale: it would take the deal
  // price and hand the customer an empty basket.
  if (remaining <= 1) {
    await prisma.deal.update({ where: { id: slot.dealId }, data: { active: false } });
    bump();
    refuse(fd, `Removed ${slot.name}. The deal is now empty, so it has been switched off.`);
  }
  bump();
}
