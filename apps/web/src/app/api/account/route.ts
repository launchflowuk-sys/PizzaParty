import { NextResponse } from "next/server";
import { prisma } from "@launchflow/db";
import { currentCustomer } from "@/lib/session";
import { COOKIE } from "@/lib/auth";
import { ensureReferralCode } from "@/lib/referral";
import { getConfig } from "@/lib/config";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Who is signed in.
 *
 * The referral code is minted here if the customer has not got one. It used to
 * be minted as a side effect of rendering the account *page*, which meant an
 * app user could have a referral link that existed only if they had previously
 * opened the website - so the minting moved to the place both ends call.
 */
export async function GET() {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const cfg = getConfig();
  const referralCode = cfg.referral.enabled ? await ensureReferralCode(customer.id) : "";

  const [orderCount, referred] = await Promise.all([
    prisma.order.count({ where: { customerId: customer.id, status: { not: "pending_payment" } } }),
    cfg.referral.enabled
      ? prisma.customer.count({ where: { referredById: customer.id } })
      : Promise.resolve(0),
  ]);

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name ?? "",
      phone: customer.phone,
      email: customer.email ?? "",
      marketingOptIn: customer.marketingOptIn,
      // Somebody who texted STOP must see that reflected, not a switch that
      // silently disagrees with what the shop will actually do.
      optedOut: !!customer.optOutAt,
      loyaltyPoints: customer.loyaltyPoints,
      orderCount,
      addresses: customer.addresses.map((a) => ({
        id: a.id, line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode,
        notes: a.notes ?? "", isDefault: a.isDefault,
      })),
    },
    loyalty: { enabled: cfg.loyalty.enabled, pointsPerPound: cfg.loyalty.pointsPerPound },
    referral: cfg.referral.enabled
      ? {
          enabled: true,
          code: referralCode,
          link: `${env.siteUrl}/r/${referralCode}`,
          refereeDiscount: cfg.referral.refereeDiscount,
          minOrder: cfg.referral.minOrder,
          rewardExpiryDays: cfg.referral.rewardExpiryDays,
          referrerReward: cfg.referral.referrerReward,
          referredCount: referred,
        }
      : { enabled: false },
  }, { headers: { "cache-control": "no-store" } });
}

/**
 * Delete the account.
 *
 * **Required by Apple** (Guideline 5.1.1(v)): any app offering account
 * creation must let somebody delete that account from inside the app. An app
 * without this is rejected, so it is not optional however unlikely it is to be
 * used.
 *
 * Anonymised, not erased. The orders themselves have to survive: the privacy
 * page commits to a six-year retention for tax and accounting, and deleting a
 * customer row would either take real sales figures with it or leave orphaned
 * orders the shop cannot reconcile. So everything that identifies a person is
 * cleared and the transactions stay.
 *
 * The phone number is replaced with a tombstone rather than blanked, because
 * it is half of a unique key - two blank numbers would collide and the second
 * person to delete their account would get an error instead.
 */
export async function DELETE() {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const tombstone = `deleted:${customer.id}`;

  await prisma.$transaction([
    // Every session, so the device that asked is signed out along with any
    // other. Deleting the account must not leave a live credential anywhere.
    prisma.session.deleteMany({ where: { customerId: customer.id } }),
    prisma.pushDevice.deleteMany({ where: { customerId: customer.id } }),
    prisma.address.deleteMany({ where: { customerId: customer.id } }),
    prisma.otpCode.deleteMany({ where: { customerId: customer.id } }),
    prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: "",
        email: "",
        phone: tombstone,
        marketingOptIn: false,
        optOutAt: new Date(),
        optOutSource: "deleted",
        // Freed so the code can be reissued, and so any link they shared stops
        // pointing at a person who has left.
        referralCode: null,
        deletedAt: new Date(),
      },
    }),
  ]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE.customer, "", { path: "/", maxAge: 0 });
  return res;
}
