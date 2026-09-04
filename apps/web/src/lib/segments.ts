import type { Prisma } from "@launchflow/db";

export const SEGMENTS: { key: string; label: string }[] = [
  { key: "ordered_30d", label: "Ordered in the last 30 days" },
  { key: "lapsed_60d", label: "Not ordered in 60+ days" },
  { key: "all_optin", label: "Everyone opted in" },
];

export function segmentWhere(key: string): Prisma.CustomerWhereInput {
  const d = (n: number) => new Date(Date.now() - n * 86400_000);
  switch (key) {
    case "ordered_30d": return { lastOrderAt: { gte: d(30) } };
    case "lapsed_60d": return { lastOrderAt: { lt: d(60) } };
    default: return {};
  }
}
