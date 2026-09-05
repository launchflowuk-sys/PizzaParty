import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { COOKIE, cookieOptions, safeEqual, sha256, signToken } from "@/lib/auth";
import { getClientRow } from "@/lib/menu";
import { STAFF_ROLES, can, type StaffRole } from "@/lib/permissions";
import { env } from "@/lib/env";

/**
 * Three ways in, in order of privilege:
 *   1. LAUNCHFLOW_KEY  - agency access.
 *   2. ADMIN_PASSWORD  - the shop's shared password. Treated as a manager, because it
 *                        is the owner's own key and predates per-person sign-in.
 *   3. A staff PIN     - signs that person in with their own role, so the back office
 *                        can actually enforce permissions rather than display them.
 */
export async function POST(req: NextRequest) {
  const { password, key, pin } = (await req.json().catch(() => ({}))) as { password?: string; key?: string; pin?: string };
  // Constant delay on every path so a wrong PIN cannot be told from an unknown one.
  await new Promise((r) => setTimeout(r, 300));
  const res = NextResponse.json({ ok: true });

  // Both of these are manager-level, and a manager can reach the kitchen. They
  // used to be handed the admin cookie only, so signing in with the shop
  // password and then pressing "Kitchen queue" asked for a second, unrelated
  // PIN that only the owner had ever been told. The staff-PIN branch below
  // already knew to hand out both; these two did not.
  if (key && env.launchflowKey && safeEqual(key, env.launchflowKey)) {
    res.cookies.set(COOKIE.agency, await signToken({ role: "agency", sub: "launchflow" }), cookieOptions("agency"));
    res.cookies.set(COOKIE.admin, await signToken({ role: "admin", sub: "launchflow", sr: "manager", nm: "LaunchFlow" }), cookieOptions("admin"));
    res.cookies.set(COOKIE.kitchen, await signToken({ role: "kitchen", sub: "launchflow" }), cookieOptions("kitchen"));
    return res;
  }

  if (password && env.adminPassword && safeEqual(password, env.adminPassword)) {
    res.cookies.set(COOKIE.admin, await signToken({ role: "admin", sub: "owner", sr: "manager", nm: "Owner" }), cookieOptions("admin"));
    res.cookies.set(COOKIE.kitchen, await signToken({ role: "kitchen", sub: "owner" }), cookieOptions("kitchen"));
    return res;
  }

  if (pin && /^\d{4,8}$/.test(pin)) {
    const client = await getClientRow();
    const hash = await sha256(`${client.id}:${pin}`);
    const member = await prisma.staff.findFirst({ where: { clientId: client.id, active: true, pinHash: hash } });
    if (member) {
      const role: StaffRole = (STAFF_ROLES as readonly string[]).includes(member.role) ? (member.role as StaffRole) : "kitchen";
      res.cookies.set(COOKIE.admin, await signToken({ role: "admin", sub: member.id, sr: role, nm: member.name }), cookieOptions("admin"));
      // The kitchen screen sits behind its own cookie so a shared tablet can be
      // signed in once and left alone. Someone whose role includes the kitchen
      // has already proved who they are, so give them that cookie too rather
      // than bouncing them to a second login.
      if (can(role, "kitchen")) {
        res.cookies.set(COOKIE.kitchen, await signToken({ role: "kitchen", sub: member.id }), cookieOptions("kitchen"));
      }
      return res;
    }
  }

  return NextResponse.json({ error: "Wrong password or PIN" }, { status: 401 });
}
