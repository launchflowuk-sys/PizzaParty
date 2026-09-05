import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __lfPrisma?: PrismaClient };

export const prisma: PrismaClient =
  g.__lfPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.__lfPrisma = prisma;

export * from "@prisma/client";

// The notification taxonomy. Shared so the seeder and the back office agree
// on what events exist without either owning the list.
export * from "./notifications";
