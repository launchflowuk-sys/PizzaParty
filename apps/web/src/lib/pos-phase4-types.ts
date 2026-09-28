/** Phase 4 contract (POS-PLAN items 28-33). Additive to pos-types.ts and pos-queue-types.ts. No server imports. Money in pence. */
import type { Fulfilment } from "./basket-types";

/** Eat-in is priced like collection; the table number rides on the order. */
export type PosFulfilment = Fulfilment | "eat_in";

/** Marketplace orders arrive through the aggregator webhook with one of these sources. */
export type MarketplaceSource = "justeat" | "deliveroo" | "ubereats";
export type AnyOrderSource = "web" | "app" | "pos" | "phone" | MarketplaceSource;

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
 * Customer-facing display at /pos/display, opened on a second screen by the same
 * browser. The till posts these on BroadcastChannel POS_DISPLAY_CHANNEL; no server involved.
 */
export const POS_DISPLAY_CHANNEL = "lf-pos-display";
export type PosDisplayLine = { name: string; detail: string; qty: number; lineTotal: number; image?: string };
export type PosDisplayMessage =
  | { type: "basket"; shopName: string; lines: PosDisplayLine[]; subtotal: number; discount: number; deliveryFee: number; total: number }
  | { type: "paying"; total: number; method: "cash" | "reader"; tendered?: number; change?: number }
  | { type: "paid"; orderNumber: number; change?: number }
  | { type: "idle"; shopName: string };

/** GET /api/pos/marketplaces → which channels are switched on, for the settings card and board badges. */
export type PosMarketplaceStatus = {
  provider: "deliverect" | "none";
  configured: boolean;
  channels: { source: MarketplaceSource; name: string; enabled: boolean; lastOrderAt: string | null }[];
  webhookUrl: string;
};
