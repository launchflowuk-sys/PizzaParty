import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@launchflow/db";
import { COOKIE, verifyToken, type Role } from "./auth";
import { can, landingFor, STAFF_ROLES, type Screen, type StaffRole } from "./permissions";

export async function requireRole(role: Exclude<Role, "customer">) {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE[role])?.value, role);
}

/**
 * The signed-in customer, from a cookie or a bearer token.
 *
 * A native app cannot use the cookie - it is httpOnly and tied to a browser
 * jar - so the same signed credential is also accepted in an Authorization
 * header. It is deliberately the *same* credential rather than a second auth
 * system: already signed, already carrying an expiry, already pointing at a
 * revocable Session row.
 *
 * The header is checked first so that a shared device, or the app's own
 * WebView, cannot have a stale cookie silently override the token the app is
 * actually authenticated with.
 */
export async function currentCustomer() {
  const bearer = (await headers()).get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const jar = await cookies();
  const p = await verifyToken(bearer || jar.get(COOKIE.customer)?.value, "customer");
  if (!p) return null;
  const session = await prisma.session.findUnique({ where: { token: p.sub }, include: { customer: { include: { addresses: { orderBy: { createdAt: "desc" } } } } } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.customer;
}

/** The signed-in back-office person, with the role their permissions come from. */
/**
 * Whether this session holds the agency key.
 *
 * Separate from the role matrix on purpose: /admin/launchflow needs its own
 * key, so a manager who can open every other screen still cannot open that one.
 * Help articles gated on `agency` follow the same rule.
 */
export async function currentAgency(): Promise<boolean> {
  const jar = await cookies();
  return !!(await verifyToken(jar.get(COOKIE.agency)?.value, "agency"));
}

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
