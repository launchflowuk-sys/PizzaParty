/**
 * Offers sent to the app as a push notification - the parts that are pure.
 *
 * No prisma and no "server-only" here on purpose: the composer's live preview
 * runs the same template the send does, and scripts/tests can exercise the
 * audience, batching and code-minting rules without a database.
 */
import type { Prisma } from "@launchflow/db";

/** Expo accepts at most 100 messages per request. */
export const EXPO_BATCH = 100;

/** iOS truncates the banner well before this; anything longer is a mistake. */
export const PUSH_TITLE_MAX = 60;
export const PUSH_BODY_MAX = 180;

/** Where an app notification opens. Paths are the app's expo-router routes. */
export const APP_MENU = "/(tabs)/menu";

export type OfferSource =
  | { kind: "none" }
  | { kind: "deal"; id: string }
  | { kind: "promo"; code: string }
  | { kind: "slot"; id: string }
  | { kind: "custom" };

/** "deal:abc", "promo:FRIDAY20", "slot:xyz", "custom" or "" from the form's one select. */
export function parseOffer(raw: string): OfferSource {
  const [kind, ...rest] = raw.split(":");
  const val = rest.join(":").trim();
  if (kind === "deal" && val) return { kind: "deal", id: val };
  if (kind === "promo" && val) return { kind: "promo", code: val.toUpperCase() };
  if (kind === "slot" && val) return { kind: "slot", id: val };
  if (kind === "custom") return { kind: "custom" };
  return { kind: "none" };
}

/**
 * The app screen a tap should land on.
 *
 * A promo slot's target is a deal slug or empty, and the app's own carousel
 * already treats it exactly this way (deal wins, empty is the menu), so a push
 * for a slot lands where tapping the card would.
 */
export function offerUrl(o: { dealSlug?: string; slotTarget?: string }): string {
  const slug = (o.dealSlug ?? o.slotTarget ?? "").trim();
  return slug ? `/deal/${encodeURIComponent(slug)}` : APP_MENU;
}

export type Audience =
  | { kind: "all" }
  | { kind: "segment"; key: string }
  | { kind: "picked"; ids: string[] };

/** Hand-picked sends stop here, as the SMS composer does. */
export const MAX_PICKED = 2000;

export function parseAudience(raw: string, ids: string): Audience {
  if (raw === "picked") {
    const list = [...new Set(ids.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, MAX_PICKED);
    return { kind: "picked", ids: list };
  }
  if (raw.startsWith("segment:") && raw.length > 8) return { kind: "segment", key: raw.slice(8) };
  return { kind: "all" };
}

/** What Campaign.segment records, so the Sent table can label it. */
export function audienceSegment(a: Audience): string {
  if (a.kind === "picked") return "custom";
  if (a.kind === "segment") return a.key;
  return "all_optin";
}

/**
 * Everyone a marketing push may reach: opted in to marketing, account not
 * deleted, and at least one live device. A guest device has no customer and so
 * no consent, and the app's "notifications off" deletes the device row, so
 * both are out by construction.
 */
export function pushCustomerWhere(clientId: string): Prisma.CustomerWhereInput {
  return { clientId, marketingOptIn: true, deletedAt: null, pushDevices: { some: { disabledAt: null } } };
}

export type DeviceRow = {
  token: string;
  customerId: string | null;
  disabledAt: Date | null;
  customer: { marketingOptIn: boolean; deletedAt: Date | null } | null;
};

/**
 * Who can actually receive a marketing push, grouped by customer.
 *
 * The database query already asks for this, and this is the belt to its
 * braces: a guest device has nobody who consented, a retired token is dead, and
 * a deleted account asked to be forgotten. One entry per customer, because the
 * campaign counts people - somebody with a phone and a tablet is one customer
 * who gets it on both.
 */
export function groupEligible(rows: DeviceRow[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.customerId || r.disabledAt || !r.customer?.marketingOptIn || r.customer.deletedAt) continue;
    const list = out.get(r.customerId) ?? [];
    if (!list.includes(r.token)) list.push(r.token);
    out.set(r.customerId, list);
  }
  return out;
}

export function chunk<T>(items: T[], size = EXPO_BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 - same as loyalty codes

/** Upper-case letters, digits and dashes; what a customer can type at checkout. */
export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

/**
 * One code per person, for a hand-picked send.
 *
 * Minted with `issuedToCustomerId` and a single use, which checkout already
 * enforces ("That code was issued to someone else"), so a code forwarded to a
 * friend is refused rather than silently honoured. The shop's own code name
 * stays at the front so the orders screen still reads as this campaign.
 */
export function mintCodes(base: string, customerIds: string[], rand: () => number = Math.random): Map<string, string> {
  const stem = cleanCode(base) || "OFFER";
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const id of customerIds) {
    let code = "";
    do {
      let tail = "";
      for (let i = 0; i < 5; i++) tail += ALPHABET[Math.floor(rand() * ALPHABET.length)];
      code = `${stem}-${tail}`;
    } while (used.has(code));
    used.add(code);
    out.set(id, code);
  }
  return out;
}

export type CustomOffer = {
  code: string;
  type: "percent" | "fixed" | "free_delivery";
  /** percent (1-100) or pence */
  value: number;
  minOrder: number;
  endsAt: Date;
};

/** Checks a custom offer the way checkout will read it. Returns an error or the offer. */
export function validateCustomOffer(f: {
  code: string; type: string; value: number; minOrderPounds: number; days: number;
}, now = new Date()): { error: string } | { offer: CustomOffer } {
  const code = cleanCode(f.code);
  if (code.length < 3) return { error: "Give the offer a code of at least 3 letters or numbers." };
  const type = f.type === "fixed" || f.type === "free_delivery" ? f.type : "percent";
  let value = 0;
  if (type === "percent") {
    value = Math.round(f.value);
    if (!(value >= 1 && value <= 100)) return { error: "A percentage off has to be between 1 and 100." };
  } else if (type === "fixed") {
    value = Math.round(f.value * 100);
    if (!(value >= 50)) return { error: "An amount off has to be at least 50p." };
  }
  const minOrder = Math.max(0, Math.round((Number.isFinite(f.minOrderPounds) ? f.minOrderPounds : 0) * 100));
  if (type === "fixed" && minOrder > 0 && value >= minOrder) {
    return { error: "The amount off is as big as the minimum order, so the food would be free." };
  }
  const days = Math.round(f.days);
  if (!(days >= 1 && days <= 90)) return { error: "An offer has to run for between 1 and 90 days." };
  return { offer: { code, type, value, minOrder, endsAt: new Date(now.getTime() + days * 86400_000) } };
}

/**
 * Merge fields, the same three the SMS composer offers. Kept here rather than
 * reusing lib/marketing's `render` because that module is server-only and the
 * preview renders in the browser.
 */
export function fillPush(template: string, name: string, code: string, shop: string): string {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  return template
    .replace(/\{name\}/gi, first)
    .replace(/\{shop\}/gi, shop)
    .replace(/\{code\}/gi, code)
    .trim();
}

/** A double-click and a second identical send within this window are the same send. */
export const DUPLICATE_WINDOW_MS = 10 * 60_000;
