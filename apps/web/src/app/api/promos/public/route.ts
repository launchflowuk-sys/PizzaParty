import { NextResponse } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";

export const dynamic = "force-dynamic";

/**
 * Codes anybody may use.
 *
 * Two exclusions that matter.
 *
 * A code tied to a specific customer is theirs - the THANKS-XXXXX rewards
 * minted when somebody's friend orders. Listing those publicly would hand one
 * person's referral reward to whoever opened the app first. The website's
 * deals page currently lists them, which is a leak the app must not copy.
 *
 * And a code past its end date is not an offer, it is a disappointment at
 * checkout.
 */
export async function GET() {
  const client = await getClientRow();
  const now = new Date();

  const promos = await prisma.promo.findMany({
    where: {
      clientId: client.id,
      active: true,
      // Empty string, not null: the column is a plain String defaulting to "".
      issuedToCustomerId: "",
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }],
    },
    orderBy: { code: "asc" },
    select: {
      code: true, type: true, value: true,
      minOrder: true, endsAt: true, fulfilment: true,
      maxUses: true, uses: true, firstOrderOnly: true,
    },
  });

  return NextResponse.json({
    promos: promos
      .filter((p) => p.maxUses === null || p.uses < p.maxUses)
      .map((p) => ({
      code: p.code,
      type: p.type,
      value: p.value,
      minOrder: p.minOrder,
      fulfilment: p.fulfilment,
      endsAt: p.endsAt?.toISOString() ?? null,
      firstOrderOnly: p.firstOrderOnly,
      })),
  }, { headers: { "cache-control": "public, max-age=60" } });
}
