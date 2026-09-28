/** Phase 4 contract (POS-PLAN items 28-33). Additive to pos-types.ts and pos-queue-types.ts. No server imports. Money in pence. */
import type { Fulfilment } from "./basket-types";
import type { DisplayHandoff } from "./pos-display-requests";

/** Eat-in is priced like collection; the table number rides on the order. */
export type PosFulfilment = Fulfilment | "eat_in";

/** Marketplace orders arrive through the aggregator webhook with one of these sources. */
export type MarketplaceSource = "justeat" | "deliveroo" | "ubereats";
/** "kiosk" is the self-service ordering screen (POS-PLAN item 35). */
export type AnyOrderSource = "web" | "app" | "pos" | "phone" | "kiosk" | MarketplaceSource;

/**
 * Additions to POST /api/pos/orders (PosCreateOrder):
 * - fulfilment may be "eat_in" (with tableNumber).
 * - clientRequestId makes the call idempotent: a repeat with the same id returns the
 *   first PosOrderRef (200) instead of creating a second order. The offline queue relies on it.
 */
export type PosCreateOrderExtras = {
  clientRequestId?: string;
  tableNumber?: string;
  /**
   * ISO. When the offline till actually rang it up, if it is syncing later (at most
   * 24 hours old). Stored beside the real placement time; the queue shows it.
   */
  createdOfflineAt?: string;
};

/** The marketplace sources, for loops and guards. */
export const MARKETPLACE_SOURCES: readonly MarketplaceSource[] = ["justeat", "deliveroo", "ubereats"];
export const MARKETPLACE_NAME: Record<MarketplaceSource, string> = { justeat: "Just Eat", deliveroo: "Deliveroo", ubereats: "Uber Eats" };
export const isMarketplaceSource =(s: string): s is MarketplaceSource => (MARKETPLACE_SOURCES as readonly string[]).includes(s);

/** Addition to POST /api/pos/orders/:id/pay (PosPay, cash only): a repeat with the same id returns the first PosPayment. */
export type PosPayExtras = { clientRequestId?: string };

/**
 * Caller ID. A call reaches the till as an `event: call` on /api/pos/stream:
 *   data: PosCall
 * Sources: POST /api/pos/callerid?token=<CALLERID_TOKEN> from a VoIP/SIP provider
 * (Twilio form field `From`, or JSON { phone }), or a USB caller-ID box read in the
 * browser with Web Serial (the till raises the same PosCall locally).
 */
export type PosCall = {
  phone: string;
  at: string;
  line?: string;
  /** Filled by the server when the number matches a customer; the Web Serial path looks it up via /api/pos/customers. */
  customerName?: string;
  ordersCount?: number;
};

/**
 * Customer-facing display at /pos/display, on any device. The till sends a
 * PosDisplayEnvelope two ways: BroadcastChannel POS_DISPLAY_CHANNEL (instant, same
 * browser) and POST /api/pos/display, which the server relays to every display as
 * `event: display` on GET /api/pos/display/stream. GET /api/pos/display lists the
 * tills seen recently (PosDisplayTill[]) so a display that just connected can pair.
 */
export const POS_DISPLAY_CHANNEL = "lf-pos-display";
/** `unitPrice` includes the modifiers' prices; `size` only when the product has more than one. */
export type PosDisplayLine = {
  name: string; detail: string; qty: number; lineTotal: number; image?: string; slug?: string;
  size?: string; unitPrice?: number; modifiers?: { name: string; price: number }[];
};
export type PosDisplayMessage =
  /** `truncated`: the relay dropped trailing lines to fit a notification; the totals are still whole. */
  | { type: "basket"; shopName: string; lines: PosDisplayLine[]; subtotal: number; discount: number; deliveryFee: number; total: number; truncated?: boolean; fulfilment?: "delivery" | "collection" | "eat_in";
      /** Handed to the customer to confirm and pay on the display (lib/pos-display-requests.ts). `pending`: not yet priced as shown - the display waits before offering to pay. */
      handoff?: DisplayHandoff; pending?: boolean }
  | { type: "paying"; total: number; method: "cash" | "reader"; tendered?: number; change?: number }
  | { type: "paid"; orderNumber: number; change?: number }
  | { type: "idle"; shopName: string };
/** One message from one till. `at` is the till's clock (ms) - later wins, so a message arriving twice is harmless. */
export type PosDisplayEnvelope = { tillId: string; tillName: string; at: number; msg: PosDisplayMessage };
/** What the server remembers per till: the latest message, plus the last basket (a "paying" carries no lines). */
export type PosDisplayTill = PosDisplayEnvelope & { basket?: Extract<PosDisplayMessage, { type: "basket" }> };

/** GET /api/pos/marketplaces → which channels are switched on, for the settings card and board badges. */
export type PosMarketplaceStatus = {
  provider: "deliverect" | "none";
  configured: boolean;
  channels: { source: MarketplaceSource; name: string; enabled: boolean; lastOrderAt: string | null }[];
  webhookUrl: string;
};
