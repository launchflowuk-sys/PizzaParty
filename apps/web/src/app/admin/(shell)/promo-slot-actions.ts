"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientRow } from "@/lib/menu";
import { toPence } from "@/lib/money";
import { ALLOWED_MIME, IMAGE_MAX_BYTES } from "@/lib/promo-slots";

/**
 * The home-screen cards, edited by the shop.
 *
 * Filed under the existing "promos" permission rather than a new one: anybody
 * trusted to create a discount code is trusted to put a picture on the home
 * screen, and inventing a permission would mean editing every tenant's roles.
 */

async function guard() {
  const staff = await currentStaff();
  if (!staff) throw new Error("Unauthorised");
  if (!can(staff.role, "promos")) throw new Error("Forbidden");
  return getClientRow();
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/**
 * A date box the shop left empty means "no limit", not "1970".
 *
 * An invalid date is also treated as empty. The alternative - throwing - would
 * lose everything else they typed over a typo in a field that is optional.
 */
function when(fd: FormData, k: string): Date | null {
  const v = str(fd, k);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const bump = () => {
  revalidatePath("/admin/promos");
  revalidatePath("/");
  revalidatePath("/deals");
};

/**
 * Read the uploaded graphic, if there is one.
 *
 * Returns `undefined` when no new file was chosen, which is different from
 * `null`: editing a card's price must not wipe its picture, so `undefined`
 * means "leave whatever is there alone".
 */
async function imageFrom(fd: FormData): Promise<{ image: Uint8Array<ArrayBuffer>; imageMime: string } | undefined> {
  const file = fd.get("image");
  if (!(file instanceof File) || file.size === 0) return undefined;

  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    throw new Error(`That file is a ${file.type || "unknown type"}. Use a JPEG, PNG or WebP.`);
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 2MB.`);
  }
  // Uint8Array rather than Buffer: Prisma types a Bytes column as Uint8Array,
  // and a Buffer widened to ArrayBufferLike does not satisfy it.
  const buf: ArrayBuffer = await file.arrayBuffer();
  return { image: new Uint8Array(buf), imageMime: file.type };
}

export async function createPromoSlot(fd: FormData) {
  const client = await guard();
  const img = await imageFrom(fd);

  const priceRaw = str(fd, "price");
  await prisma.promoSlot.create({
    data: {
      clientId: client.id,
      title: str(fd, "title") || "Offer",
      subtitle: str(fd, "subtitle"),
      // No price is a legitimate promotion - "2 for 1 on Tuesdays" names no
      // figure - so an empty box stays null rather than becoming zero.
      price: priceRaw ? toPence(Number(priceRaw.replace(/[£,\s]/g, ""))) : null,
      target: str(fd, "target"),
      placement: str(fd, "placement") === "hero" ? "hero" : "featured",
      sortOrder: Number(str(fd, "sortOrder")) || 0,
      startsAt: when(fd, "startsAt"),
      endsAt: when(fd, "endsAt"),
      active: true,
      ...(img ?? {}),
    },
  });
  bump();
}

export async function updatePromoSlot(fd: FormData) {
  const client = await guard();
  const id = str(fd, "id");
  const img = await imageFrom(fd);
  const priceRaw = str(fd, "price");

  // Scoped by clientId as well as id, so a posted id from another tenant
  // updates nothing rather than somebody else's promotion.
  await prisma.promoSlot.updateMany({
    where: { id, clientId: client.id },
    data: {
      title: str(fd, "title") || "Offer",
      subtitle: str(fd, "subtitle"),
      price: priceRaw ? toPence(Number(priceRaw.replace(/[£,\s]/g, ""))) : null,
      target: str(fd, "target"),
      placement: str(fd, "placement") === "hero" ? "hero" : "featured",
      sortOrder: Number(str(fd, "sortOrder")) || 0,
      startsAt: when(fd, "startsAt"),
      endsAt: when(fd, "endsAt"),
      ...(img ?? {}),
    },
  });
  bump();
}

/** Pause or resume. Kept separate from the dates so pausing does not lose them. */
export async function togglePromoSlot(fd: FormData) {
  const client = await guard();
  const id = str(fd, "id");
  const row = await prisma.promoSlot.findFirst({ where: { id, clientId: client.id }, select: { active: true } });
  if (!row) return;
  await prisma.promoSlot.updateMany({ where: { id, clientId: client.id }, data: { active: !row.active } });
  bump();
}

export async function deletePromoSlot(fd: FormData) {
  const client = await guard();
  await prisma.promoSlot.deleteMany({ where: { id: str(fd, "id"), clientId: client.id } });
  bump();
}
