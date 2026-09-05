"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can, STAFF_ROLES } from "@/lib/permissions";
import { getClientRow } from "@/lib/menu";
import { sha256 } from "@/lib/auth";

/**
 * Staff, and the PINs they sign in with.
 *
 * The shop was seeded with 1111 through 8888 from a config file that lives in a
 * public repository, and there was no way to change them from the back office -
 * so on the day a real shop starts using this, anybody who found the repo could
 * sign in as a manager and change prices.
 *
 * The seeder only ever sets a PIN when a person is first created, so a PIN
 * changed here is safe from a re-seed. What was missing was any way to change
 * one at all.
 *
 * A PIN is stored only as a salted hash, so nobody - not the shop, not
 * LaunchFlow, not whoever reads the database - can look up what somebody's PIN
 * is. It can be replaced, never recovered.
 */

async function guard() {
  const staff = await currentStaff();
  if (!staff) throw new Error("Unauthorised");
  if (!can(staff.role, "staff")) throw new Error("Forbidden");
  return getClientRow();
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bump = () => revalidatePath("/admin/staff");

function refuse(message: string): never {
  redirect(`/admin/staff?e=${encodeURIComponent(message)}`);
}
function done(message: string): never {
  redirect(`/admin/staff?m=${encodeURIComponent(message)}`);
}

/** The obvious ones, and the ones every shop tries first. */
const WEAK = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "0123", "1212", "2020", "1010", "123456", "654321", "111111", "000000",
]);

export async function setStaffPin(fd: FormData) {
  const client = await guard();
  const id = str(fd, "id");
  const pin = str(fd, "pin");

  const member = await prisma.staff.findFirst({ where: { id, clientId: client.id }, select: { id: true, name: true } });
  if (!member) refuse("That person is no longer on the list.");

  if (!/^\d{4,8}$/.test(pin)) refuse("A PIN is 4 to 8 numbers, nothing else.");
  if (WEAK.has(pin)) refuse("That PIN is too easy to guess. Pick something that is not a run or a repeat.");

  const pinHash = await sha256(`${client.id}:${pin}`);

  // Two people sharing a PIN would sign in as whichever the database found
  // first, and the audit trail would name the wrong person.
  const clash = await prisma.staff.findFirst({
    where: { clientId: client.id, pinHash, id: { not: member.id } },
    select: { name: true },
  });
  if (clash) refuse(`${clash.name} already uses that PIN. Everybody needs their own.`);

  await prisma.staff.update({ where: { id: member.id }, data: { pinHash } });
  bump();
  done(`${member.name}'s PIN is changed. It cannot be looked up afterwards, so make sure they know it.`);
}

export async function addStaff(fd: FormData) {
  const client = await guard();
  const name = str(fd, "name");
  const role = str(fd, "role");
  const pin = str(fd, "pin");

  if (!name) refuse("Give the person a name.");
  if (!(STAFF_ROLES as readonly string[]).includes(role)) refuse("Pick a role.");
  if (!/^\d{4,8}$/.test(pin)) refuse("A PIN is 4 to 8 numbers, nothing else.");
  if (WEAK.has(pin)) refuse("That PIN is too easy to guess. Pick something that is not a run or a repeat.");

  const exists = await prisma.staff.findFirst({ where: { clientId: client.id, name }, select: { id: true } });
  if (exists) refuse(`${name} is already on the list.`);

  const pinHash = await sha256(`${client.id}:${pin}`);
  const clash = await prisma.staff.findFirst({ where: { clientId: client.id, pinHash }, select: { name: true } });
  if (clash) refuse(`${clash.name} already uses that PIN. Everybody needs their own.`);

  const rows = await prisma.staff.findMany({ where: { clientId: client.id }, select: { sortOrder: true } });
  await prisma.staff.create({
    data: {
      clientId: client.id, name, role, pinHash,
      phone: str(fd, "phone"), email: str(fd, "email"),
      active: true,
      sortOrder: rows.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1,
    },
  });
  bump();
  done(`Added ${name}.`);
}

/**
 * Somebody leaves.
 *
 * Deactivated rather than deleted: their PIN stops working immediately, which is
 * the thing that matters on the day, but the orders they took and the shifts
 * they worked keep the name attached to them.
 */
export async function setStaffActive(fd: FormData) {
  const client = await guard();
  const id = str(fd, "id");
  const member = await prisma.staff.findFirst({ where: { id, clientId: client.id }, select: { id: true, name: true, active: true } });
  if (!member) return;
  await prisma.staff.update({ where: { id: member.id }, data: { active: !member.active, onShift: false } });
  bump();
  done(member.active
    ? `${member.name} can no longer sign in. Their history is kept.`
    : `${member.name} can sign in again.`);
}
