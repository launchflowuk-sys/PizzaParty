import type { Prisma } from "@launchflow/db";

/**
 * Who to send to.
 *
 * These are the cuts a takeaway owner actually thinks in - the regulars, the
 * ones who tried it once and never came back, the ones who have gone quiet -
 * rather than anything that needs explaining. Every segment is intersected with
 * "opted in" before a message goes anywhere near it.
 */
export const SEGMENTS: { key: string; label: string; help: string }[] = [
  { key: "all_optin", label: "Everyone opted in", help: "The whole list. Use sparingly - it is the fastest way to get people opting out." },
  { key: "ordered_30d", label: "Ordered in the last 30 days", help: "Your active customers. Best audience for a quiet night or a new item." },
  { key: "lapsed_60d", label: "Not ordered in 60+ days", help: "Drifting away. A code here usually pays for itself several times over." },
  { key: "lapsed_120d", label: "Not ordered in 120+ days", help: "Close to lost. Worth a stronger offer than you would normally give." },
  { key: "one_timers", label: "Ordered once only", help: "The single biggest pot of untapped money in most shops." },
  { key: "regulars", label: "Regulars (5+ orders)", help: "They already like you. Tell them things first rather than discounting." },
  { key: "big_spenders", label: "Big spenders (£250+ lifetime)", help: "Worth protecting. A thank-you lands better here than an offer." },
  { key: "grays", label: "Grays & Little Thurrock (RM17)", help: "The doorstep trade, closest to the shop." },
  { key: "thurrock", label: "Chafford & West Thurrock (RM16/RM20)", help: "The further patch, where delivery costs more." },
];

export function segmentWhere(key: string): Prisma.CustomerWhereInput {
  const d = (n: number) => new Date(Date.now() - n * 86400_000);
  switch (key) {
    case "ordered_30d": return { lastOrderAt: { gte: d(30) } };
    case "lapsed_60d": return { lastOrderAt: { lt: d(60) } };
    case "lapsed_120d": return { lastOrderAt: { lt: d(120) } };
    case "one_timers": return { ordersCount: 1 };
    case "regulars": return { ordersCount: { gte: 5 } };
    case "big_spenders": return { totalSpent: { gte: 25000 } };
    case "grays": return { lastPostcode: { startsWith: "RM17" } };
    case "thurrock": return { OR: [{ lastPostcode: { startsWith: "RM16" } }, { lastPostcode: { startsWith: "RM20" } }] };
    default: return {};
  }
}

export const segmentLabel = (key: string) => SEGMENTS.find((s) => s.key === key)?.label ?? key;
