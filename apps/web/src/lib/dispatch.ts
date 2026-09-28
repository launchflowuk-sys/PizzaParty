import "server-only";
import { prisma, type OrderStatus } from "@launchflow/db";
import { addEvent } from "./orders";

const BACK_IN_MS = 30 * 60_000;
const DONE: OrderStatus[] = ["completed", "rejected", "cancelled"];

/**
 * Put a driver on an order, or take the order off whoever had it (driverId
 * null). One driver per order: anyone else holding it is freed. Scoped to the
 * shop on both ids. Used by the dispatch board and the till queue.
 * Returns false when either id is not this shop's.
 */
export async function assignDriver(clientId: string, orderId: string, driverId: string | null, actor: string): Promise<boolean> {
  const order = await prisma.order.findFirst({ where: { id: orderId, clientId }, select: { status: true } });
  if (!order) return false;
  // A finished order frees its driver (releaseDriver); putting one back on it would strand them.
  if (driverId && DONE.includes(order.status)) return false;
  const driver = driverId ? await prisma.driver.findFirst({ where: { id: driverId, clientId, active: true }, select: { id: true, name: true } }) : null;
  if (driverId && !driver) return false;
  await prisma.$transaction([
    prisma.driver.updateMany({
      where: { clientId, activeOrderId: orderId, ...(driver ? { id: { not: driver.id } } : {}) },
      data: { status: "available", activeOrderId: "", backAt: null },
    }),
    ...(driver ? [prisma.driver.update({ where: { id: driver.id }, data: { status: "on_delivery", activeOrderId: orderId, backAt: new Date(Date.now() + BACK_IN_MS) } })] : []),
  ]);
  await addEvent(orderId, "driver", actor, driver ? `Driver ${driver.name}` : "Driver taken off");
  return true;
}

/**
 * The order is finished: whoever was on it is free again. A driver carries one
 * order at a time (activeOrderId), so holding this one means they hold no other.
 */
export async function releaseDriver(clientId: string, orderId: string): Promise<void> {
  await prisma.driver.updateMany({ where: { clientId, activeOrderId: orderId }, data: { status: "available", activeOrderId: "", backAt: null } });
}
