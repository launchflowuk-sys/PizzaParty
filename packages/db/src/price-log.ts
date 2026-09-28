import type { Prisma, PrismaClient } from "@prisma/client";

export type PriceChangeRow = { kind: string; refId: string; label: string; oldPrice: number | null; newPrice: number };

/**
 * Append the price changes that actually changed something. Shared by the
 * back office and the seeder, so a price can never move without a row saying
 * who moved it ("prices changed without telling us" is the complaint this answers).
 */
export async function logPriceChanges(db: PrismaClient | Prisma.TransactionClient, clientId: string, actor: string, rows: PriceChangeRow[]): Promise<number> {
  const changed = rows.filter((r) => r.oldPrice !== r.newPrice);
  if (changed.length) await db.priceChange.createMany({ data: changed.map((r) => ({ ...r, clientId, actor })) });
  return changed.length;
}
