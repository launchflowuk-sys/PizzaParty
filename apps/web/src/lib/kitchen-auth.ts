import "server-only";
import type { NextRequest } from "next/server";
import { COOKIE, verifyToken } from "./auth";

/** Kitchen endpoints accept the kitchen cookie or the admin cookie. */
export async function kitchenOrAdmin(req: NextRequest) {
  return (await verifyToken(req.cookies.get(COOKIE.kitchen)?.value, "kitchen")) ?? (await verifyToken(req.cookies.get(COOKIE.admin)?.value, "admin"));
}
export async function adminOnly(req: NextRequest) {
  return (await verifyToken(req.cookies.get(COOKIE.admin)?.value, "admin")) ?? (await verifyToken(req.cookies.get(COOKIE.agency)?.value, "agency"));
}
