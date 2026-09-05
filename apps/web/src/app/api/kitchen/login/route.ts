import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { COOKIE, cookieOptions, safeEqual, sha256, signToken } from "@/lib/auth";
import { getClientRow } from "@/lib/menu";
import { can, STAFF_ROLES, type StaffRole } from "@/lib/permissions";
import { env } from "@/lib/env";

/**
 * Opening the kitchen screen.
 *
 * Two kinds of PIN are accepted, because two different people press this.
 *
 * The shared KITCHEN_PIN is for the tablet on the wall: signed in once and left
 * alone for weeks, with nobody's name attached to it.
 *
 * A staff PIN is for the person who walks up to a screen that has been logged
 * out. Their own PIN already decides what they can reach everywhere else in the
 * system, and it was odd that the one screen a kitchen hand actually needs was
 * the single place it did not work - they had to be told a second, unrelated
 * number that only the owner knew.
 *
 * A staff PIN only opens this if their role can reach the kitchen, so a driver's
 * PIN is not a way in.
 */
export async function POST(req: NextRequest) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };

  const open = async (sub: string) => {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE.kitchen, await signToken({ role: "kitchen", sub }), cookieOptions("kitchen"));
    return res;
  };

  if (pin && env.kitchenPin && safeEqual(pin, env.kitchenPin)) return open("kitchen");

  if (pin && /^\d{4,8}$/.test(pin)) {
    const client = await getClientRow();
    const member = await prisma.staff.findFirst({
      where: { clientId: client.id, active: true, pinHash: await sha256(`${client.id}:${pin}`) },
    });
    if (member) {
      const role: StaffRole = (STAFF_ROLES as readonly string[]).includes(member.role)
        ? (member.role as StaffRole)
        : "kitchen";
      if (can(role, "kitchen")) return open(member.id);
    }
  }

  // The same pause whichever way it failed, so how long the answer takes cannot
  // be used to work out whether a PIN belongs to somebody.
  await new Promise((r) => setTimeout(r, 400));
  return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
}
