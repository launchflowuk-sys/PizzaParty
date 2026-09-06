import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { currentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Turn marketing on or off.
 *
 * The privacy page has always claimed you can "opt out from your account
 * page". Until now you could not - there was no such control anywhere, which
 * made the claim untrue rather than merely unimplemented.
 *
 * Turning it off writes exactly what an SMS STOP writes, so the two routes
 * cannot disagree about whether somebody has withdrawn consent - and under
 * PECR the shop has to be able to show it honoured the request whichever way
 * it arrived.
 */
export async function POST(req: NextRequest) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { optIn?: unknown };
  if (typeof body.optIn !== "boolean") {
    return NextResponse.json({ error: "Say whether you want these messages." }, { status: 400 });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: body.optIn
      ? { marketingOptIn: true, optOutAt: null, optOutSource: "" }
      : { marketingOptIn: false, optOutAt: new Date(), optOutSource: "app" },
  });

  return NextResponse.json({ ok: true, marketingOptIn: body.optIn });
}
