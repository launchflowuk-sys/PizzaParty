import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { toE164 } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * Joining the marketing list from the footer.
 *
 * Two things this deliberately does not do.
 *
 * It does not create a customer record for a number that has never ordered
 * beyond the opt-in itself - the row exists so the shop can text them, not so
 * anybody can be profiled for typing a number into a footer.
 *
 * And it never reports whether the number was already known. "You are already
 * on the list" turns this box into a way of testing whether somebody is a
 * customer of this shop, which is not information a stranger is owed. The
 * answer is the same either way.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const phone = toE164(body.phone ?? "");
  if (!phone) return NextResponse.json({ error: "That does not look like a UK mobile number." }, { status: 400 });

  try {
    const client = await getClientRow();
    const existing = await prisma.customer.findUnique({
      where: { clientId_phone: { clientId: client.id, phone } },
      select: { id: true, optOutAt: true },
    });

    if (existing) {
      // Somebody who once texted STOP has actively said no. Typing their number
      // into a footer is not them changing their mind, and under PECR the shop
      // has to be able to show it honoured the request - so the opt-out stands
      // and they are told plainly rather than quietly re-subscribed.
      if (existing.optOutAt) {
        return NextResponse.json({
          error: "This number asked to stop hearing from us. Reply START to our last message to change that.",
        }, { status: 400 });
      }
      await prisma.customer.update({ where: { id: existing.id }, data: { marketingOptIn: true } });
    } else {
      await prisma.customer.create({
        data: { clientId: client.id, phone, marketingOptIn: true, guest: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "That did not go through. Try again in a moment." }, { status: 500 });
  }
}
