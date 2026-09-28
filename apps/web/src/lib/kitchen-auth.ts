import "server-only";
import type { NextRequest } from "next/server";
import { COOKIE, verifyToken } from "./auth";

/**
 * A self-service kiosk signs in with the admin cookie too (a Kiosk-role PIN), but it
 * faces the public: it must never reach the kitchen feed, pause ordering or export
 * orders. Every admin-cookie check outside the kiosk's own routes goes through here.
 */
const notKiosk = <T extends { sr?: string }>(p: T | null) => (p && p.sr !== "kiosk" ? p : null);

/** Kitchen endpoints accept the kitchen cookie or the admin cookie. */
export async function kitchenOrAdmin(req: NextRequest) {
  return (await verifyToken(req.cookies.get(COOKIE.kitchen)?.value, "kitchen")) ?? notKiosk(await verifyToken(req.cookies.get(COOKIE.admin)?.value, "admin"));
}
export async function adminOnly(req: NextRequest) {
  return notKiosk(await verifyToken(req.cookies.get(COOKIE.admin)?.value, "admin")) ?? (await verifyToken(req.cookies.get(COOKIE.agency)?.value, "agency"));
}
