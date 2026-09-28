/**
 * Self-service kiosk rules (POS-PLAN item 35). Pure: shared by the kiosk screen,
 * its API routes and scripts/tests/kiosk.test.ts. No server imports. Money in pence.
 */
import type { BasketLine } from "./basket-types";

/** Nobody has touched the screen for this long: ask "Are you still there?". */
export const KIOSK_IDLE_MS = 60_000;
/** How long that question waits before the order is cleared. */
export const KIOSK_STILL_THERE_S = 15;
/** The confirmation screen goes back to the offers after this long. */
export const KIOSK_DONE_MS = 20_000;
/** The hidden staff corner opens after being held this long. */
export const KIOSK_EXIT_HOLD_MS = 5_000;
/** Same cap the website's basket schema enforces per line. */
export const KIOSK_MAX_QTY = 20;
export const KIOSK_NAME_MAX = 20;

export type KioskFulfilment = "eat_in" | "collection";
export type KioskPayment = "card" | "counter";

/** Eat in only when the shop has it switched on for the counter; takeaway is collection. Never delivery. */
export function kioskFulfilments(cfg: { eatIn: boolean; fulfilment: readonly string[] }): KioskFulfilment[] {
  return [...(cfg.eatIn ? (["eat_in"] as const) : []), ...(cfg.fulfilment.includes("collection") ? (["collection"] as const) : [])];
}

/** Card needs the shop to allow it, Stripe, and a reader chosen on this kiosk. */
export function kioskPayments(o: { card: boolean; payAtCounter: boolean; stripe: boolean; readerChosen: boolean }): KioskPayment[] {
  return [...(o.card && o.stripe && o.readerChosen ? (["card"] as const) : []), ...(o.payAtCounter ? (["counter"] as const) : [])];
}

/**
 * How a kiosk order is written. Pay at the counter is the till's "pay later": in the
 * kitchen at once with the money owed as a cash placeholder, settled by staff with
 * Take payment. Card waits in pending_payment until the reader is paid, like the till.
 */
export function kioskOrderPayment(payment: KioskPayment, total: number) {
  return payment === "counter"
    ? { paymentMethod: "cash" as const, payment: { provider: "cash", status: "cash_pending" as const, amount: total }, placeNow: true }
    : { paymentMethod: "card" as const, payment: undefined, placeNow: total === 0 };
}

/** "  sam   o'neil!! " → "Sam O'neil". Letters, spaces, apostrophes, hyphens and dots only; the kitchen reads it aloud. */
export function kioskName(raw: string): string {
  const clean = raw.replace(/[^\p{L}' .-]/gu, "").replace(/\s+/g, " ").trim().slice(0, KIOSK_NAME_MAX).trim();
  return clean.replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Two lines are the same item when everything that changes the price or the kitchen ticket matches. */
function sameItem(a: BasketLine, b: BasketLine): boolean {
  const mods = (l: BasketLine) => (l.modifiers ?? []).map((m) => `${m.group}:${m.modifier}`).sort().join("|");
  const comps = (l: BasketLine) => JSON.stringify(l.components ?? []);
  return a.kind === b.kind && a.product === b.product && a.size === b.size && a.deal === b.deal && mods(a) === mods(b) && comps(a) === comps(b) && (a.notes ?? "") === (b.notes ?? "");
}

/** Adds a line, or tops up the qty of an identical one (so two taps on Coke make "2 × Coke"). */
export function addKioskLine<T extends BasketLine>(lines: T[], line: T): T[] {
  const i = lines.findIndex((l) => sameItem(l, line));
  if (i < 0) return [...lines, { ...line, qty: Math.min(KIOSK_MAX_QTY, line.qty) }];
  return lines.map((l, n) => (n === i ? withQty(l, l.qty + line.qty) : l));
}

/** New qty for one line; 0 removes it. Display totals follow the unit price. */
export function setKioskQty<T extends BasketLine>(lines: T[], key: string, qty: number): T[] {
  if (qty <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? withQty(l, qty) : l));
}

function withQty<T extends BasketLine>(l: T, qty: number): T {
  const q = Math.min(KIOSK_MAX_QTY, Math.max(1, qty));
  return { ...l, qty: q, lineTotal: (l.unitPrice ?? 0) * q };
}

export const kioskCount = (lines: BasketLine[]) => lines.reduce((a, l) => a + l.qty, 0);
/** What the bottom bar shows before the server has priced the basket. The server price is what is charged. */
export const kioskTotal = (lines: BasketLine[]) => lines.reduce((a, l) => a + (l.unitPrice ?? 0) * l.qty, 0);

/**
 * "Make it a meal?": up to `n` suggestions from other categories than the item just
 * added, not already in the basket, one per category first so it is not three sides.
 */
export function pickUpsell<T extends { slug: string; category: string }>(pool: T[], addedCategory: string, inBasket: Set<string>, n = 3): T[] {
  const open = pool.filter((p) => p.category !== addedCategory && !inBasket.has(p.slug));
  const seen = new Set<string>();
  const first = open.filter((p) => !seen.has(p.category) && seen.add(p.category));
  return [...first, ...open.filter((p) => !first.includes(p))].slice(0, n);
}

/**
 * Sliding-window limiter over an in-memory map. Records the hit and returns false,
 * or returns true (limited) without recording once `max` hits sit inside the window.
 * ponytail: per process, so a restart or a second instance resets it; fine for a
 * handful of kiosks, move to the DB if the kiosk endpoints ever scale out.
 */
export function rateLimited(hits: Map<string, number[]>, key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  hits.set(key, [...recent, now]);
  return false;
}

/** POST /api/kiosk/price → the server's own figures. The kiosk shows these; the order is charged the same. */
export type KioskPriced = {
  lines: { key: string; name: string; detail: string; qty: number; unitPrice: number; lineTotal: number }[];
  subtotal: number; discount: number; total: number; errors: string[]; removedKeys: string[];
};
/** POST /api/kiosk/orders → the order the kitchen will call out. */
export type KioskOrderRef = { id: string; number: number; total: number; status: string; payment: KioskPayment };

/** Only the fields pricing reads are stored with the order, whatever else a request carries. */
export function storedKioskLine(l: BasketLine): BasketLine {
  return {
    key: l.key, kind: l.kind, qty: l.qty,
    ...(l.product ? { product: l.product } : {}), ...(l.size ? { size: l.size } : {}),
    ...(l.modifiers ? { modifiers: l.modifiers.map((m) => ({ group: m.group, modifier: m.modifier })) } : {}),
    ...(l.deal ? { deal: l.deal } : {}),
    ...(l.components ? { components: l.components.map((c) => ({ slot: c.slot, product: c.product, size: c.size, modifiers: c.modifiers.map((m) => ({ group: m.group, modifier: m.modifier })) })) } : {}),
  };
}
