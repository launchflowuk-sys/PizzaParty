import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __lfPrisma?: PrismaClient };

export const prisma: PrismaClient =
  g.__lfPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.__lfPrisma = prisma;

export * from "@prisma/client";
