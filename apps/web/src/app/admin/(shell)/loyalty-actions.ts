"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientRow, MENU_TAG } from "@/lib/menu";
import { toPence } from "@/lib/money";

/**
 * What points can be bought with.
 *
 * The rewards themselves are the shop's, not config's - "100 points is a free
 * garlic bread" is a pricing decision that moves with the seasons and with what
 * is costing them money that month.
 */

async function guard() {
  const staff = await currentStaff();
  if (!staff) throw new Error("Unauthorised");
  if (!can(staff.role, "loyalty")) throw new Error("Forbidden");
  return getClientRow();
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, d = 0) => {
  const v = Number(String(fd.get(k) ?? "").replace(/[£,\s%]/g, ""));
  return Number.isFinite(v) ? v : d;
};
const bump = () => { revalidateTag(MENU_TAG); revalidatePath("/admin", "layout"); revalidatePath("/rewards"); };

/**
 * The answer lands on the screen the change was made from. Rewards are edited on
 * the loyalty screen, but points are given by hand from the customer list, and
 * bouncing somebody to a different screen to read "done" is disorienting. The
 * value is matched against a fixed set rather than trusted, so a tampered field
 * cannot turn a form post into a redirect off the site.
 */
function target(fd: FormData, param: "m" | "e", message: string): never {
  const raw = String(fd.get("back") ?? "");
  const back = raw === "/admin/customers" ? raw : "/admin/loyalty";
  redirect(`${back}?${param}=${encodeURIComponent(message)}`);
}
// Declared as functions, not arrow consts: TypeScript only narrows past a
// `never` return for a function declaration, and these are used as guards.
function refuseAt(fd: FormData, message: string): never { target(fd, "e", message); }
function doneAt(fd: FormData, message: string): never { target(fd, "m", message); }

type RewardType = "fixed" | "percent" | "free_delivery";

/**
 * `value` means different things per type, so it is read per type rather than
 * blindly converted: pounds become pence, a percentage stays a whole number,
 * and free delivery carries no value at all.
 */
function valueFor(type: RewardType, fd: FormData): number {
  if (type === "percent") return Math.min(100, Math.max(0, Math.round(num(fd, "value"))));
  if (type === "free_delivery") return 0;
  return toPence(num(fd, "value"));
}

function readType(fd: FormData): RewardType {
  const t = str(fd, "type");
  return t === "percent" || t === "free_delivery" ? t : "fixed";
}

export async function saveReward(fd: FormData) {
  const client = await guard();
  const name = str(fd, "name");
  if (!name) refuseAt(fd, "Give the reward a name — it is what the customer sees.");

  const points = Math.round(num(fd, "points"));
  if (points <= 0) refuseAt(fd, "A reward has to cost some points, or everyone can claim it endlessly.");

  const type = readType(fd);
  const data = {
    name,
    points,
    type,
    value: valueFor(type, fd),
    minOrder: toPence(num(fd, "minOrder")),
    expiryDays: Math.max(1, Math.round(num(fd, "expiryDays", 60))),
    active: fd.get("active") === "on",
  };

  const id = str(fd, "id");
  if (id) {
    await prisma.loyaltyReward.update({ where: { id }, data });
    bump();
    return;
  }

  const rows = await prisma.loyaltyReward.findMany({ where: { clientId: client.id }, select: { sortOrder: true } });
  // The name is unique per shop, so a second "£5 off" is a mistake worth naming
  // rather than a crash.
  const clash = await prisma.loyaltyReward.findFirst({ where: { clientId: client.id, name } });
  if (clash) refuseAt(fd, `There is already a reward called ${name}.`);

  await prisma.loyaltyReward.create({
    data: { ...data, clientId: client.id, sortOrder: rows.reduce((mx, r) => Math.max(mx, r.sortOrder), -1) + 1 },
  });
  bump();
  doneAt(fd, `Added ${name}.`);
}

/**
 * Deleting a reward does not touch codes already claimed for it.
 *
 * Someone spent their points on that code; it stays valid until it expires. All
 * this does is take it off the list of things that can be claimed next.
 */
export async function deleteReward(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const r = await prisma.loyaltyReward.findUniqueOrThrow({ where: { id }, select: { name: true } });
  await prisma.loyaltyReward.delete({ where: { id } });
  bump();
  doneAt(fd, `Removed ${r.name}. Codes already claimed for it still work.`);
}

/**
 * Points given by hand.
 *
 * For the apology at the counter - a late order, a wrong topping. It writes to
 * the same ledger as an earned point so the customer sees why their balance
 * moved, and the reason is required for exactly that reason.
 */
export async function adjustPoints(fd: FormData) {
  await guard();
  const customerId = str(fd, "customerId");
  const delta = Math.round(num(fd, "delta"));
  const reason = str(fd, "reason");
  if (!delta) refuseAt(fd, "Say how many points to add or take away.");
  if (!reason) refuseAt(fd, "Put a reason on it — the customer sees this on their rewards page.");

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true, name: true } });
  if (!customer) refuseAt(fd, "That customer no longer exists.");
  // A balance below zero would quietly owe the shop points, which is not a thing
  // anyone would expect to happen.
  if (delta < 0 && customer.loyaltyPoints + delta < 0) {
    refuseAt(fd, `${customer.name} only has ${customer.loyaltyPoints} points, so ${Math.abs(delta)} cannot come off.`);
  }

  await prisma.$transaction([
    prisma.loyaltyLedger.create({ data: { customerId, delta, reason } }),
    prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { increment: delta } } }),
  ]);
  bump();
  doneAt(fd, `${delta > 0 ? "Added" : "Took"} ${Math.abs(delta)} points ${delta > 0 ? "to" : "from"} ${customer.name}.`);
}
