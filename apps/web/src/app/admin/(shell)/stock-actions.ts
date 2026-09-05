"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientRow } from "@/lib/menu";

/**
 * The stock cupboard.
 *
 * This is a written sheet the manager keeps, not a stock-control system. Nothing
 * here is deducted when an order is sold - a pizza does not know it contains
 * mozzarella, and building that would need a recipe per item, a quantity per
 * ingredient and somebody disciplined enough to record waste. Shops abandon
 * those within a fortnight, and a stock figure everybody knows is wrong is worse
 * than no figure at all.
 *
 * So the numbers move when a person says they moved: counted tonight, this much
 * arrived, order this from the supplier. That is honest, and it is what the
 * screen is actually used for.
 */

async function guard() {
  const staff = await currentStaff();
  if (!staff) throw new Error("Unauthorised");
  if (!can(staff.role, "inventory")) throw new Error("Forbidden");
  return getClientRow();
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, d = 0) => {
  const v = Number(String(fd.get(k) ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(v) ? v : d;
};
const bump = () => revalidatePath("/admin/inventory");

function refuse(message: string): never {
  redirect(`/admin/inventory?e=${encodeURIComponent(message)}`);
}
function done(message: string): never {
  redirect(`/admin/inventory?m=${encodeURIComponent(message)}`);
}

/** Never below zero: a negative amount of cheese is not a thing. */
const atLeastZero = (n: number) => (n < 0 ? 0 : Math.round(n * 100) / 100);

export async function createStockItem(fd: FormData) {
  const client = await guard();
  const name = str(fd, "name");
  if (!name) refuse("Give the item a name.");

  const clash = await prisma.stockItem.findFirst({ where: { clientId: client.id, name } });
  if (clash) refuse(`${name} is already on the list.`);

  const rows = await prisma.stockItem.findMany({ where: { clientId: client.id }, select: { sortOrder: true } });
  await prisma.stockItem.create({
    data: {
      clientId: client.id,
      locationId: str(fd, "locationId"),
      name,
      unit: str(fd, "unit") || "kg",
      onHand: atLeastZero(num(fd, "onHand")),
      par: atLeastZero(num(fd, "par")),
      supplier: str(fd, "supplier"),
      sortOrder: rows.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1,
    },
  });
  bump();
  done(`Added ${name}.`);
}

export async function updateStockItem(fd: FormData) {
  const client = await guard();
  const name = str(fd, "name");
  if (!name) refuse("An item needs a name.");
  await prisma.stockItem.updateMany({
    where: { id: str(fd, "id"), clientId: client.id },
    data: {
      name,
      unit: str(fd, "unit") || "kg",
      par: atLeastZero(num(fd, "par")),
      supplier: str(fd, "supplier"),
      locationId: str(fd, "locationId"),
    },
  });
  bump();
}

export async function deleteStockItem(fd: FormData) {
  const client = await guard();
  const item = await prisma.stockItem.findFirst({ where: { id: str(fd, "id"), clientId: client.id }, select: { id: true, name: true } });
  if (!item) refuse("That item is no longer on the list.");
  await prisma.stockItem.delete({ where: { id: item.id } });
  bump();
  done(`Removed ${item.name}.`);
}

/**
 * What is actually on the shelf, after a count.
 *
 * Set rather than adjusted, because this is filled in while standing in the
 * cupboard looking at the tins - "there are four" is what somebody knows, not
 * "there are two more than the screen thinks".
 */
export async function countStock(fd: FormData) {
  const client = await guard();
  await prisma.stockItem.updateMany({
    where: { id: str(fd, "id"), clientId: client.id },
    data: { onHand: atLeastZero(num(fd, "onHand")) },
  });
  bump();
}

/**
 * A delivery arrived.
 *
 * Takes the quantity that turned up and adds it, which is the part the old
 * version got wrong: it snapped the figure to par on the assumption that every
 * order is filled exactly. Deliveries are short, come in case sizes, or arrive
 * in two halves - so the number that arrived is the number that gets typed.
 *
 * Leaving it blank still means "the full order came", because that is the
 * common case and nobody wants to do arithmetic at the back door.
 */
export async function receiveDelivery(fd: FormData) {
  const client = await guard();
  const id = str(fd, "id");
  const item = await prisma.stockItem.findFirst({ where: { id, clientId: client.id } });
  if (!item) refuse("That item is no longer on the list.");

  const typed = str(fd, "qty");
  const arrived = typed ? atLeastZero(num(fd, "qty")) : Math.max(0, item.par - item.onHand);

  await prisma.stockItem.update({
    where: { id: item.id },
    data: { onHand: atLeastZero(item.onHand + arrived), onOrder: false },
  });
  bump();
  done(`Booked in ${arrived}${item.unit} of ${item.name}.`);
}

/** Ordered, or a mistaken flag cleared - the same button both ways. */
export async function toggleOnOrder(fd: FormData) {
  const client = await guard();
  const item = await prisma.stockItem.findFirst({ where: { id: str(fd, "id"), clientId: client.id }, select: { id: true, onOrder: true } });
  if (!item) return;
  await prisma.stockItem.update({ where: { id: item.id }, data: { onOrder: !item.onOrder } });
  bump();
}

/**
 * Flag everything below par with one press.
 *
 * Scoped to a supplier when one is given, because ordering happens one supplier
 * at a time - you ring the butcher about the meat, not about the cola.
 */
export async function reorderBelowPar(fd: FormData) {
  const client = await guard();
  const supplier = str(fd, "supplier");
  const items = await prisma.stockItem.findMany({
    where: { clientId: client.id, ...(supplier ? { supplier } : {}) },
    select: { id: true, onHand: true, par: true },
  });
  const ids = items.filter((i) => i.onHand < i.par).map((i) => i.id);
  if (ids.length) await prisma.stockItem.updateMany({ where: { id: { in: ids }, clientId: client.id }, data: { onOrder: true } });
  bump();
  done(ids.length
    ? `Flagged ${ids.length} item${ids.length === 1 ? "" : "s"}${supplier ? ` for ${supplier}` : ""} as on order.`
    : "Nothing is below par.");
}
