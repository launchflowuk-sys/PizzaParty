import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@launchflow/db";
import { COOKIE, verifyToken, type Role } from "./auth";
import { can, landingFor, STAFF_ROLES, type Screen, type StaffRole } from "./permissions";

export async function requireRole(role: Exclude<Role, "customer">) {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE[role])?.value, role);
}

export async function currentCustomer() {
  const jar = await cookies();
  const p = await verifyToken(jar.get(COOKIE.customer)?.value, "customer");
  if (!p) return null;
  const session = await prisma.session.findUnique({ where: { token: p.sub }, include: { customer: { include: { addresses: { orderBy: { createdAt: "desc" } } } } } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.customer;
}

/** The signed-in back-office person, with the role their permissions come from. */
export type CurrentStaff = { id: string; name: string; role: StaffRole };

/**
 * Resolves the admin cookie to a person and a role. A session minted from the shared
 * ADMIN_PASSWORD (or the agency key) carries no staff id and is treated as a manager -
 * it is the owner's own credential. Tokens issued before per-person sign-in have no
 * role either, so they fall back the same way rather than locking the owner out.
 */
export async function currentStaff(): Promise<CurrentStaff | null> {
  const p = await requireRole("admin");
  if (!p) return null;
  const role: StaffRole = (STAFF_ROLES as readonly string[]).includes(p.sr ?? "") ? (p.sr as StaffRole) : "manager";
  return { id: p.sub, name: p.nm ?? "Owner", role };
}

/**
 * Page guard. Sends anyone signed out to the login screen, and anyone signed in
 * without the permission to the dashboard rather than showing them a wall.
 */
export async function requireScreen(screen: Screen): Promise<CurrentStaff> {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  // Send them to somewhere they can actually be. Redirecting every denial to
  // /admin loops for any role without dashboard access.
  if (!can(staff.role, screen)) {
    const home = landingFor(staff.role);
    redirect(home === "/admin" ? `/admin?denied=${screen}` : `${home}?denied=${screen}`);
  }
  return staff;
}
