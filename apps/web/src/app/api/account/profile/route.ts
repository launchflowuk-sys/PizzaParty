import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { currentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(120).or(z.literal("")).optional(),
});

/**
 * Change your own name or email.
 *
 * The website cannot do this at all - the only way a name gets updated today
 * is by placing another order - so an app account screen without it would look
 * broken. Deliberately not the phone number: that is the shop's key for a
 * person and their whole order history hangs off it, so changing it is a merge
 * problem rather than an edit.
 */
export async function POST(req: NextRequest) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "That email address does not look right." }, { status: 400 });
  }

  const { name, email } = parsed.data;
  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
    },
    select: { name: true, email: true },
  });

  return NextResponse.json({ ok: true, customer: { name: updated.name ?? "", email: updated.email ?? "" } });
}
