import "server-only";
import { prisma } from "@launchflow/db";
import { env } from "./env";

/**
 * The promotional cards a shop puts on its own home screen.
 *
 * Until now the top of the app opened on one image baked into the build, so the
 * most valuable space in the product could only be changed by a developer doing
 * a deploy. A promotion that needs a deploy is a promotion that never happens.
 *
 * A shop owner uploads a graphic, names a price, picks the dates, and can pause
 * or replace it without anybody's help. The same records feed the website, so
 * an offer cannot exist in one place and not the other.
 */

/** The size we ask shops to supply. Told to them in the back office, and enforced loosely - see `IMAGE_MAX_BYTES`. */
export const PROMO_IMAGE = { width: 1080, height: 720, ratio: "3:2" } as const;

/**
 * A cap, not a target.
 *
 * These are read out of Postgres on every home-screen render, so a shop that
 * uploads a 12MB photograph straight off a phone would make its own app slow.
 * 2MB is generous for a 1080x720 promotional graphic.
 */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export type PublicSlot = {
  id: string;
  title: string;
  subtitle: string;
  /** Pence, or null when the offer does not name a figure. */
  price: number | null;
  target: string;
  imageUrl: string;
  placement: string;
};

async function clientId(): Promise<string | null> {
  const c = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { id: true } });
  return c?.id ?? null;
}

/**
 * Everything that should be on screen right now.
 *
 * The window is evaluated in the query rather than in JavaScript so a slot
 * cannot be shown by a server whose clock has drifted from the database's, and
 * so a shop with fifty expired promotions does not send fifty rows over the
 * wire to have forty-nine thrown away.
 *
 * A null start means "already running" and a null end means "until somebody
 * stops it", which is what a shop means when it leaves the boxes empty.
 */
export async function liveSlots(placement?: string): Promise<PublicSlot[]> {
  const id = await clientId();
  if (!id) return [];
  const now = new Date();

  const rows = await prisma.promoSlot.findMany({
    where: {
      clientId: id,
      active: true,
      ...(placement ? { placement } : {}),
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
      // A card with no picture is a blank rectangle, which looks like a fault
      // rather than an offer. Held back until the shop uploads one.
      NOT: { imageMime: "" },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, subtitle: true, price: true, target: true, placement: true },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    price: r.price,
    target: r.target,
    placement: r.placement,
    imageUrl: `/promo/${r.id}.jpg`,
  }));
}

/** Every slot the shop owns, running or not. For the back office only. */
export async function allSlots() {
  const id = await clientId();
  if (!id) return [];
  return prisma.promoSlot.findMany({
    where: { clientId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, title: true, subtitle: true, price: true, target: true, placement: true,
      sortOrder: true, active: true, startsAt: true, endsAt: true, imageMime: true, createdAt: true,
    },
  });
}

/** The bytes for one slot, or null. Used by the image route. */
export async function slotImage(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const cid = await clientId();
  if (!cid) return null;
  // Scoped to this shop as well as to the id: an id guessed from another
  // tenant's site must not serve that tenant's artwork.
  const row = await prisma.promoSlot.findFirst({
    where: { id, clientId: cid },
    select: { image: true, imageMime: true },
  });
  if (!row?.image || !row.imageMime) return null;
  return { bytes: Buffer.from(row.image), mime: row.imageMime };
}

/**
 * Whether a slot is on screen at a given moment, for the back office to show a
 * plain-English status. Deliberately the same three questions the query asks.
 */
export function slotState(s: { active: boolean; startsAt: Date | null; endsAt: Date | null; imageMime: string }, now = new Date()):
  "live" | "paused" | "scheduled" | "finished" | "no image" {
  if (!s.imageMime) return "no image";
  if (!s.active) return "paused";
  if (s.startsAt && s.startsAt > now) return "scheduled";
  if (s.endsAt && s.endsAt < now) return "finished";
  return "live";
}
