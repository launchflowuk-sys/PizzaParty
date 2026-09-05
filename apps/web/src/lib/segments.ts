import type { Prisma } from "@launchflow/db";

/**
 * Who to send to.
 *
 * These are the cuts a takeaway owner actually thinks in - the regulars, the
 * ones who tried it once and never came back, the ones who have gone quiet -
 * rather than anything that needs explaining. Every segment is intersected with
 * "opted in" before a message goes anywhere near it.
 */
export const SEGMENTS: { key: string; label: string; help: string; group: string }[] = [
  { key: "all_optin", label: "Everyone opted in", help: "The whole list. Use sparingly - it is the fastest way to get people opting out.", group: "Everyone" },
  { key: "custom", label: "People I pick myself", help: "Tick the ones you want on the Customers screen and press Message these. Nothing is sent to anybody you did not tick.", group: "Everyone" },

  { key: "never_ordered", label: "Signed up, never ordered", help: "They gave you their number and then did not buy. A first-order code is the whole reason this group exists.", group: "How often" },
  { key: "one_timers", label: "Ordered once only", help: "The single biggest pot of untapped money in most shops.", group: "How often" },
  { key: "occasional", label: "Ordered 2 to 4 times", help: "Nearly regulars. One more good night and they stop shopping around.", group: "How often" },
  { key: "regulars", label: "Regulars (5+ orders)", help: "They already like you. Tell them things first rather than discounting.", group: "How often" },
  { key: "vip", label: "Your best (10+ orders)", help: "A small group who keep the lights on. Worth knowing by name.", group: "How often" },

  { key: "ordered_7d", label: "Ordered this week", help: "Still warm. Good for a Friday reminder, wrong for a win-back.", group: "How recently" },
  { key: "ordered_30d", label: "Ordered in the last 30 days", help: "Your active customers. Best audience for a quiet night or a new item.", group: "How recently" },
  { key: "lapsed_60d", label: "Not ordered in 60+ days", help: "Drifting away. A code here usually pays for itself several times over.", group: "How recently" },
  { key: "lapsed_120d", label: "Not ordered in 120+ days", help: "Close to lost. Worth a stronger offer than you would normally give.", group: "How recently" },
  { key: "at_risk", label: "Regulars who have gone quiet", help: "Five or more orders and nothing for two months. The most expensive group to lose and the easiest to win back.", group: "How recently" },

  { key: "spent_100", label: "Spent £100+ lifetime", help: "Solid customers. Worth a thank-you before an offer.", group: "How much" },
  { key: "big_spenders", label: "Big spenders (£250+ lifetime)", help: "Worth protecting. A thank-you lands better here than an offer.", group: "How much" },
  { key: "big_baskets", label: "Big baskets (£30+ a time)", help: "Families and offices rather than one person on a Tuesday. Deals land better here than money off.", group: "How much" },

  { key: "new_30d", label: "Joined in the last 30 days", help: "Still deciding whether you are their takeaway. Worth getting the second order.", group: "How new" },

  { key: "grays", label: "Grays & Little Thurrock (RM17)", help: "The doorstep trade, closest to the shop.", group: "Where" },
  { key: "thurrock", label: "Chafford & West Thurrock (RM16/RM20)", help: "The further patch, where delivery costs more.", group: "Where" },
  { key: "basildon", label: "Basildon shop (SS)", help: "Everyone the Basildon branch delivers to.", group: "Where" },
];

/** The order the groups appear in, so the picker reads top to bottom. */
export const SEGMENT_GROUPS = ["Everyone", "How often", "How recently", "How much", "How new", "Where"] as const;

/**
 * Average basket is not a column, so it cannot be filtered in the database -
 * `totalSpent / ordersCount` would need raw SQL and would divide by zero on
 * anybody who has not ordered. It is applied after the query instead, which is
 * honest about the cost: this one segment reads the list and then narrows it.
 */
export const AVG_BASKET_SEGMENTS: Record<string, number> = { big_baskets: 3000 };

export function segmentWhere(key: string): Prisma.CustomerWhereInput {
  const d = (n: number) => new Date(Date.now() - n * 86400_000);
  switch (key) {
    case "never_ordered": return { ordersCount: 0 };
    case "occasional": return { ordersCount: { gte: 2, lte: 4 } };
    case "vip": return { ordersCount: { gte: 10 } };
    case "ordered_7d": return { lastOrderAt: { gte: d(7) } };
    case "at_risk": return { ordersCount: { gte: 5 }, lastOrderAt: { lt: d(60) } };
    case "spent_100": return { totalSpent: { gte: 10000 } };
    // Narrowed to people who have actually ordered; the average is applied after
    // the query, because it is not a column.
    case "big_baskets": return { ordersCount: { gt: 0 } };
    case "new_30d": return { createdAt: { gte: d(30) } };
    case "ordered_30d": return { lastOrderAt: { gte: d(30) } };
    case "lapsed_60d": return { lastOrderAt: { lt: d(60) } };
    case "lapsed_120d": return { lastOrderAt: { lt: d(120) } };
    case "one_timers": return { ordersCount: 1 };
    case "regulars": return { ordersCount: { gte: 5 } };
    case "big_spenders": return { totalSpent: { gte: 25000 } };
    case "grays": return { lastPostcode: { startsWith: "RM17" } };
    case "thurrock": return { OR: [{ lastPostcode: { startsWith: "RM16" } }, { lastPostcode: { startsWith: "RM20" } }] };
    case "basildon": return { OR: [{ lastPostcode: { startsWith: "SS" } }, { lastPostcode: { startsWith: "CM11" } }] };
    default: return {};
  }
}

export const segmentLabel = (key: string) => SEGMENTS.find((s) => s.key === key)?.label ?? key;
