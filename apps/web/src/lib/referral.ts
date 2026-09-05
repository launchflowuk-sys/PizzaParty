import "server-only";
import { prisma } from "@launchflow/db";
import { getConfig } from "./config";

/**
 * Refer a friend.
 *
 * The shape matters more than the mechanics. Word of mouth is how a takeaway
 * actually grows, and it costs nothing until it works: the referrer's reward is
 * only minted once their friend's first order is paid for, so the shop never
 * pays for an introduction that did not buy anything.
 *
 * The friend's discount rides on the existing promo machinery rather than a
 * parallel one, so it is subject to the same minimum-order and expiry rules as
 * every other code, and shows up in the same takings.
 */

/** Unambiguous alphabet: no O/0, no I/1, nothing that dies over the phone. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** A code someone can read out: "DAVE-7K2QP" - their name, then randomness. */
function candidateFor(name: string): string {
  const first = (name || "").trim().split(/\s+/)[0] ?? "";
  const stem = first.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  return stem.length >= 3 ? `${stem}-${randomCode(4)}` : `FARM-${randomCode(5)}`;
}

/**
 * Give this customer a code, or return the one they already have.
 *
 * Collisions are vanishingly unlikely but not impossible, so this retries
 * rather than handing two people the same code and crediting the wrong one.
 */
export async function ensureReferralCode(customerId: string): Promise<string> {
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, clientId: true, name: true, referralCode: true },
  });
  if (!c) throw new Error("Customer not found");
  if (c.referralCode) return c.referralCode;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = candidateFor(c.name);
    const taken = await prisma.customer.findFirst({
      where: { clientId: c.clientId, referralCode: code },
      select: { id: true },
    });
    if (taken) continue;
    try {
      const updated = await prisma.customer.update({ where: { id: c.id }, data: { referralCode: code } });
      return updated.referralCode!;
    } catch {
      // Lost the race to another request; try a different code.
    }
  }
  throw new Error("Could not allocate a referral code");
}

/** The customer behind a code, if it is one. Case-insensitive, punctuation-tolerant. */
export async function referrerFor(clientId: string, raw: string) {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  return prisma.customer.findFirst({
    where: { clientId, referralCode: code },
    select: { id: true, name: true, phone: true, marketingOptIn: true },
  });
}

/**
 * A referral code used at the checkout, priced as if it were a promo.
 *
 * Returned in the shape `priceBasket` already understands, so the discount, the
 * minimum-order rule and the error messages all behave like any other code and
 * nothing downstream needs to know referrals exist.
 */
export function refereePromo(code: string) {
  const cfg = getConfig();
  return {
    code: code.toUpperCase(),
    type: "fixed" as const,
    value: Math.round(cfg.referral.refereeDiscount * 100),
    minOrder: Math.round(cfg.referral.minOrder * 100),
    fulfilment: [] as string[],
    startsAt: null,
    endsAt: null,
    maxUses: null,
    uses: 0,
    firstOrderOnly: true,
    active: true,
  };
}

/**
 * Mint the referrer's thank-you once their friend's first order is paid.
 *
 * Returns the code so the caller can text it. Does nothing - and says so - when
 * the order is not a first order, was not referred, or has already paid out.
 */
export async function rewardReferrer(orderId: string): Promise<{ code: string; referrerId: string } | null> {
  const cfg = getConfig();
  if (!cfg.referral.enabled) return null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clientId: true, customerId: true, total: true },
  });
  if (!order) return null;

  const referee = await prisma.customer.findUnique({
    where: { id: order.customerId },
    select: { id: true, name: true, referredById: true, referralRewardedAt: true, ordersCount: true },
  });
  // Paid once, on the first order only. `ordersCount` is incremented as the
  // order is placed, so the first one reads as 1 here.
  if (!referee?.referredById || referee.referralRewardedAt || referee.ordersCount > 1) return null;

  const referrer = await prisma.customer.findUnique({
    where: { id: referee.referredById },
    select: { id: true, name: true },
  });
  if (!referrer) return null;

  const code = `THANKS-${randomCode(5)}`;
  await prisma.promo.create({
    data: {
      clientId: order.clientId,
      code,
      type: "fixed",
      value: Math.round(cfg.referral.referrerReward * 100),
      minOrder: Math.round(cfg.referral.minOrder * 100),
      maxUses: 1,
      issuedToCustomerId: referrer.id,
      endsAt: new Date(Date.now() + cfg.referral.rewardExpiryDays * 86400_000),
      active: true,
    },
  });
  // Stamped on the referee, because that is what "this introduction has been
  // paid for" belongs to - one payout per person introduced.
  await prisma.customer.update({ where: { id: referee.id }, data: { referralRewardedAt: new Date() } });

  return { code, referrerId: referrer.id };
}

/**
 * Whether this customer may spend this code.
 *
 * A reward is minted for one person; anyone else who hears the code is not
 * entitled to it. Ordinary promos carry no owner and are open to everyone.
 */
export function promoBelongsTo(promo: { issuedToCustomerId: string }, customerId: string | null): boolean {
  if (!promo.issuedToCustomerId) return true;
  return promo.issuedToCustomerId === customerId;
}
