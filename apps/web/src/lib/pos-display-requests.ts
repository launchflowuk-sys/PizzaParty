/**
 * Interactive customer display (POS-PLAN item 29): the customer confirms, adds
 * extras and picks how to pay on the display; the till stays the authority.
 * Wire shapes, the till's accept rules, the add-on ranking and a rate limiter.
 * No server imports - shared by the relay route, the till, the display and the tests.
 *
 * Flow: till taps Charge → basket message carries `handoff {id, methods}` →
 * display POSTs /api/pos/display/request → server validates + NOTIFYs →
 * `event: display-request` on the till's /api/pos/stream only → the till applies
 * it (checkDisplayRequest) and the display sees the result in the next basket.
 */

export type DisplayPayMethod = "card" | "cash";
/** On a basket message while it is handed to the customer. `id` is echoed back on every request. */
export type DisplayHandoff = { id: string; methods: DisplayPayMethod[] };

type Base = { tillId: string; id: string };
type InHandoff = Base & { handoff: string };
export type DisplayRequest =
  | (Base & { type: "hello" }) // "a display follows this till" - lets the till offer the hand-over at all
  | (InHandoff & { type: "add"; slug: string })
  | (InHandoff & { type: "remove"; ref: string }) // ref = the id of the display's own "add"
  | (InHandoff & { type: "pay"; method: DisplayPayMethod; total: number })
  | (InHandoff & { type: "ready" | "more" });

export const DISPLAY_REQ_PER_MIN = 20;
/** Lines one hand-over may add from the display - a bored child cannot fill the basket. */
export const DISPLAY_MAX_ADDS = 8;
/** A till offers the hand-over only while a display has said hello this recently (it says so every minute). */
export const DISPLAY_SEEN_MS = 150_000;
export const DISPLAY_HELLO_MS = 60_000;
export const UPSELL_MAX = 6;
export const REQUEST_ID = /^[\w-]{8,64}$/;

/** What the till keeps per hand-over. `added`: request id → the basket line key it created. */
export type TillHandoff = { id: string; added: Record<string, string>; adds: number };

/**
 * Why the till must ignore this request, or null to apply it. The till applies
 * nothing outside a live hand-over, removes only lines the display itself added,
 * and takes a payment only for the total the customer was shown.
 */
export function checkDisplayRequest(
  h: TillHandoff | null,
  req: DisplayRequest,
  ctx: { tillId: string; methods: DisplayPayMethod[]; total: number; pending: boolean },
): string | null {
  if (req.tillId !== ctx.tillId) return "another till";
  if (req.type === "hello") return null;
  if (!h || req.handoff !== h.id) return "not handed over";
  if (req.type === "add") {
    if (h.added[req.id]) return "duplicate";
    return h.adds >= DISPLAY_MAX_ADDS ? "too many adds" : null;
  }
  if (req.type === "remove") return h.added[req.ref] ? null : "not added by the display";
  if (req.type === "pay") {
    if (!ctx.methods.includes(req.method)) return "method not offered";
    return ctx.pending || req.total !== ctx.total ? "total changed" : null;
  }
  return null;
}

/** The till's basket is not yet priced as it stands (a line added or changed since the last server price). */
export function basketPending(
  lines: { key: string; qty: number }[],
  priced: { lines: { key: string; qty: number }[] } | null | undefined,
  loading: boolean,
): boolean {
  if (loading || !priced || priced.lines.length !== lines.length) return true;
  return lines.some((l) => priced.lines.find((p) => p.key === l.key)?.qty !== l.qty);
}

/** Sliding window over an in-memory map: records the hit and returns false, or true (limited) without recording. */
export function rateLimited(hits: Map<string, number[]>, key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  hits.set(key, [...recent, now]);
  return false;
}

// ---------- Add-on ranking ----------

export type UpsellRole = "main" | "side" | "dip" | "drink" | "dessert" | "other";
export type UpsellCandidate = { slug: string; name: string; category: string; categoryName: string; price: number; featured: boolean; ordersCount: number };
export type UpsellBasketItem = { slug: string; category: string; categoryName: string; name: string };

// Order matters: "grilled-chicken" is a main, "Box Mix" a side, "Kids Meals" a main.
const ROLE_WORDS: [UpsellRole, RegExp][] = [
  ["drink", /drink|soft|beverage|juice|shake|water/],
  ["dessert", /dessert|sweet|ice.?cream|cake|pudding|waffle|cookie/],
  ["dip", /dip|sauce/],
  ["main", /pizza|burger|chicken|wing|wrap|kebab|pasta|meal|calzone|sub\b|grill|platter/],
  ["side", /side|starter|chip|fries|snack|box|bread|salad/],
];

/** A category's role, from its slug and name (tenants name categories their own way). */
export function categoryRole(slug: string, name = ""): UpsellRole {
  const s = `${slug} ${name}`.toLowerCase();
  return ROLE_WORDS.find(([, rx]) => rx.test(s))?.[0] ?? "other";
}

const BASE: Record<UpsellRole, number> = { main: 0, side: 3, dip: 2, drink: 3, dessert: 2, other: 0 };
const PER_CATEGORY = 2;

/**
 * Up to `n` one-tap add-ons for this basket: never a main or something already in
 * it; complementary first (pizza → dips and sides, burger/chicken → chips and a
 * drink, no drink yet → drinks first, no dessert → desserts), then popularity,
 * at most two from one category so the rail is not six cans.
 */
export function rankUpsell<T extends UpsellCandidate>(candidates: T[], basket: UpsellBasketItem[], n = UPSELL_MAX): T[] {
  const inBasket = new Set(basket.map((b) => b.slug));
  const roles = new Set(basket.map((b) => categoryRole(b.category, b.categoryName)));
  const text = basket.map((b) => `${b.category} ${b.categoryName} ${b.name}`).join(" ").toLowerCase();
  const pizza = /pizza/.test(text);
  const grill = /burger|chicken|wing|wrap|kebab|grill/.test(text);
  const hasMain = roles.has("main");

  const score = (role: UpsellRole) => {
    let s = BASE[role];
    if (pizza && role === "dip") s += 3;
    if (pizza && role === "side") s += 2;
    if (grill && role === "side") s += 3;
    if (grill && role === "drink") s += 2;
    if (hasMain && role === "drink" && !roles.has("drink")) s += 4;
    if (hasMain && role === "dessert" && !roles.has("dessert")) s += 2;
    if (roles.has(role)) s -= 3;
    return s;
  };

  const ranked = candidates
    .filter((c) => !inBasket.has(c.slug))
    .map((c) => ({ c, role: categoryRole(c.category, c.categoryName) }))
    .filter((x) => x.role !== "main")
    .map((x) => ({ ...x, s: score(x.role) }))
    .sort((a, b) => b.s - a.s || Number(b.c.featured) - Number(a.c.featured) || b.c.ordersCount - a.c.ordersCount);

  const perCat = new Map<string, number>();
  const out: T[] = [];
  for (const { c } of ranked) {
    const k = perCat.get(c.category) ?? 0;
    if (k >= PER_CATEGORY) continue;
    perCat.set(c.category, k + 1);
    out.push(c);
    if (out.length >= n) break;
  }
  return out;
}
