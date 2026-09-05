import "server-only";
import { prisma } from "@launchflow/db";
import { getConfig } from "./config";
import { env } from "./env";

/**
 * Spending points.
 *
 * Earning has worked since the beginning - points land when an order completes -
 * but there was nothing to spend them on, which is why the scheme stayed switched
 * off. Advertising a club that only ever accrues is worse than not having one.
 *
 * Redemption mints a single-use promo code owned by the person who claimed it,
 * the same machinery the referral thank-you already uses. That means checkout,
 * pricing, the minimum-order rule and the "this code is not yours" check all
 * work on day one rather than being rebuilt for loyalty.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 - these get read down a phone

function randomCode(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export type RedeemResult =
  | { ok: true; code: string; name: string; expiresAt: Date }
  | { ok: false; error: string };

/** The rewards on offer, best value first. */
export async function rewardCatalogue() {
  const client = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { id: true } });
  if (!client) return [];
  return prisma.loyaltyReward.findMany({
    where: { clientId: client.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { points: "asc" }],
  });
}

/** Codes this person has claimed and not yet spent. */
export async function unspentRewards(customerId: string) {
  return prisma.promo.findMany({
    where: {
      issuedToCustomerId: customerId,
      active: true,
      uses: 0,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    orderBy: { endsAt: "asc" },
    select: { code: true, type: true, value: true, minOrder: true, endsAt: true },
  });
}

/**
 * Turn points into a code.
 *
 * The points are taken in the same statement that checks there are enough of
 * them: `updateMany` with a `gte` guard either matches one row or none, so two
 * taps on a slow phone cannot both pass the check and mint two codes off one
 * balance. If the mint afterwards fails, the points go back.
 */
export async function redeemReward(customerId: string, rewardId: string): Promise<RedeemResult> {
  const cfg = getConfig();
  if (!cfg.loyalty.enabled) return { ok: false, error: "The rewards club is not running at the moment." };

  const client = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { id: true } });
  if (!client) return { ok: false, error: "Something went wrong. Try again in a moment." };

  const reward = await prisma.loyaltyReward.findFirst({ where: { id: rewardId, clientId: client.id, active: true } });
  if (!reward) return { ok: false, error: "That reward is no longer available." };

  const taken = await prisma.customer.updateMany({
    where: { id: customerId, loyaltyPoints: { gte: reward.points } },
    data: { loyaltyPoints: { decrement: reward.points } },
  });
  if (taken.count === 0) {
    const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true } });
    const short = reward.points - (c?.loyaltyPoints ?? 0);
    return { ok: false, error: `You need ${short} more point${short === 1 ? "" : "s"} for ${reward.name}.` };
  }

  const expiresAt = new Date(Date.now() + reward.expiryDays * 86400_000);

  try {
    const code = `FARM-${randomCode(5)}`;
    await prisma.promo.create({
      data: {
        clientId: client.id,
        code,
        type: reward.type,
        value: reward.value,
        minOrder: reward.minOrder,
        maxUses: 1,
        issuedToCustomerId: customerId,
        endsAt: expiresAt,
        active: true,
      },
    });
    await prisma.loyaltyLedger.create({
      data: { customerId, delta: -reward.points, reason: `${reward.name} — ${code}` },
    });
    return { ok: true, code, name: reward.name, expiresAt };
  } catch {
    // Never leave someone out of pocket because the mint failed.
    await prisma.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { increment: reward.points } } });
    return { ok: false, error: "Could not issue the code. Your points have not been taken — please try again." };
  }
}

/** What a reward is worth, in words, for the storefront and the back office. */
export function rewardValue(r: { type: string; value: number; minOrder: number }): string {
  const money = (p: number) => `£${(p / 100).toFixed(2)}`;
  const base =
    r.type === "percent" ? `${r.value}% off` :
    r.type === "free_delivery" ? "Free delivery" :
    `${money(r.value)} off`;
  return r.minOrder > 0 ? `${base}, ${money(r.minOrder)} minimum` : base;
}
