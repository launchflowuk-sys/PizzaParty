import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@launchflow/db";
import { COOKIE, verifyToken, type Role } from "./auth";

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
