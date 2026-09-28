/**
 * The contract between the POS queue screen and the Phase 2 routes. No server
 * imports here. Same conventions as pos-types.ts: all money is integer pence,
 * all times are ISO strings, a success is the bare body, a failure is a
 * non-2xx `{ error: string, issues?: string[] }`.
 *
 * Status codes: 400 bad body · 401 not signed in · 403 role cannot use the
 * till, or a manager PIN was wrong / locked out · 404 not this shop's order ·
 * 409 the order's state forbids it (message says why) · 502 Stripe refused.
 */
import type { BasketLine } from "./basket-types";
import type { AnyOrderSource, PosFulfilment } from "./pos-phase4-types";

export type OrderStatus =
  | "pending_payment" | "placed" | "accepted" | "preparing" | "ready"
  | "out_for_delivery" | "completed" | "rejected" | "cancelled";

/**
 * paid: nothing owed · part: some paid, balance owed · unpaid: nothing paid,
 * balance owed · refund_due: more is held than the order now costs (after an
 * edit took items off) - offer `refundDue` back via /refund.
 */
export type PaidState = "paid" | "part" | "unpaid" | "refund_due";

/** card = paid online, reader = Stripe Terminal, cash = at the counter or on the doorstep. */
export type PaymentKind = "card" | "reader" | "cash";

export type QueueDriver = {
  id: string;
  name: string;
  status: "available" | "on_delivery" | "off";
  /** The order they are out with, if any. */
  orderId: string | null;
  orderNumber: number | null;
  backAt: string | null;
};

/** One card in the queue. */
export type QueueOrder = {
  id: string;
  number: number;
  /** Phase 4: marketplace orders (justeat/deliveroo/ubereats) come through Deliverect. */
  source: AnyOrderSource;
  /** Phase 4: may be "eat_in" (see tableNumber). */
  fulfilment: PosFulfilment;
  status: OrderStatus;
  /** Statuses this order may move to from here (same rules as the kitchen). */
  next: OrderStatus[];
  /** Staff name for till/phone orders, null for website/app. */
  takenBy: string | null;
  customerName: string;
  customerPhone: string;
  /** "12 High St, RM17 6AB" for delivery, "" for collection. */
  address: string;
  /** When it reached the shop (placedAt, else createdAt for an unpaid till order). Age = now - placedAt. */
  placedAt: string;
  /** Promised time: the booked slot, else the ETA once accepted, else null. */
  dueAt: string | null;
  /** True when dueAt is a customer-booked slot rather than the shop's ETA. */
  scheduled: boolean;
  etaMinutes: number | null;
  /** What the order costs now. */
  total: number;
  /** Money in, net of refunds. */
  paid: number;
  /** Still to take via POST /api/pos/orders/:id/pay. */
  balance: number;
  /** Held beyond the order's cost, to hand back via /refund. */
  refundDue: number;
  /** Refunded so far (all methods). */
  refunded: number;
  paidState: PaidState;
  /** Distinct ways money came in. */
  paymentKinds: PaymentKind[];
  /** Customer chose pay on collection / delivery and it is not settled yet. */
  payLater: boolean;
  driver: { id: string; name: string } | null;
  itemCount: number;
  /** "2× Margherita (12\"), 1× Coke" */
  summary: string;
  notes: string;
  rejectReason: string;
  /** Last time items were added or voided after it was sent; null if never. Highlight it. */
  amendedAt: string | null;
  /** Items may be added/voided (see PosEdit). */
  editable: boolean;
  /** Voiding items now needs a manager PIN (the kitchen has started: preparing, ready, out_for_delivery). */
  voidNeedsPin: boolean;
  updatedAt: string;
  /** Phase 4. Eat-in: the table; null otherwise. */
  tableNumber: string | null;
  /** Phase 4. The marketplace's own order number, to match a rider to the bag. */
  marketplaceRef: string | null;
  /** Phase 4. "marketplace" when the platform's rider collects it (show no driver button). */
  courier: "marketplace" | null;
  /** Phase 4. Something on it could not be matched to the menu: someone should read it before cooking. */
  needsAttention: boolean;
  /** Phase 4. When the offline till actually took it, if it synced later; else null. */
  createdOfflineAt: string | null;
};

/**
 * GET /api/pos/queue[?since=<cursor>]
 *
 * No `since` (or a `since` from before today): full snapshot, `full: true` -
 * replace everything. With `since`: only orders changed after it, plus
 * `removed` ids that have left the queue (e.g. yesterday's open order now
 * done) - merge by id. Always pass the last response's `cursor` back as
 * `since`; it overlaps by a few seconds so nothing is missed, and a duplicate
 * is just an update. `drivers` is always the full list. Poll every 3-5 s.
 *
 * Scope: every order created today (shop's timezone) whatever its status,
 * plus any order still open from earlier days. Website/app orders still at
 * pending_payment (card not yet paid) are left out; till/phone ones are in.
 */
export type QueueResponse = {
  /** Server clock; ages = now - placedAt so a wrong till clock cannot skew them. */
  now: string;
  cursor: string;
  full: boolean;
  orders: QueueOrder[];
  removed: string[];
  drivers: QueueDriver[];
};

export type PosOrderLine = {
  /** Pass as `orderItemId` to void it. */
  id: string;
  qty: number;
  name: string;
  size: string;
  modifiers: string[];
  /** Deal contents, one string each. */
  components: string[];
  notes: string;
  lineTotal: number;
  /** The original basket line, for "edit": void it and add a changed copy. */
  line: BasketLine | null;
};

export type PosOrderPayment = {
  id: string;
  /** later = the pay-on-collection/delivery placeholder for what is owed. */
  kind: PaymentKind | "later";
  status: "succeeded" | "waiting" | "failed" | "refunded" | "owed";
  amount: number;
  refunded: number;
  /** What /refund may still send back against this payment. */
  refundable: number;
  createdAt: string;
};

export type PosRefund = {
  id: string;
  paymentId: string;
  kind: PaymentKind;
  amount: number;
  reason: string;
  /** Who asked. */
  actor: string;
  /** Manager whose PIN approved it. */
  approvedBy: string;
  /** Card refunds can sit at pending briefly; cash is always succeeded. */
  status: "pending" | "succeeded" | "failed";
  createdAt: string;
};

export type PosOrderEvent = { id: string; type: string; actor: string; message: string; createdAt: string };

/** GET /api/pos/orders/:id - everything the queue's order panel needs. */
export type PosOrderDetail = QueueOrder & {
  subtotal: number;
  deliveryFee: number;
  /** Promo + manager discount together. */
  discount: number;
  promoCode: string;
  /** Refunded as goodwill on goods the customer kept (not an overpayment); already taken off what is owed. */
  writtenOff: number;
  lines: PosOrderLine[];
  payments: PosOrderPayment[];
  refunds: PosRefund[];
  /** Newest first, last 50. */
  events: PosOrderEvent[];
};

/** POST /api/pos/orders/:id/status → QueueOrder. Same moves as the kitchen screen. */
export type PosStatusMove = {
  to: Exclude<OrderStatus, "pending_payment" | "placed">;
  /** Only with to: "accepted"; 5-180. Defaults to the shop's prep/delivery minutes. */
  etaMinutes?: number;
  /** Required-ish for rejected/cancelled; shown to the customer on reject. Rejecting a card-paid order refunds it. */
  reason?: string;
  /** Rejecting or cancelling an order that has been paid needs a manager; without it the route answers 403 { needsPin: true }. */
  managerPin?: string;
};

/** POST /api/pos/orders/:id/driver → PosDriverResult. null takes the order off whoever had it. */
export type PosDriverAssign = { driverId: string | null };
export type PosDriverResult = { order: QueueOrder; drivers: QueueDriver[] };

/**
 * POST /api/pos/orders/:id/edit → PosEditResult
 *
 * Add lines (priced against today's menu, like a new basket) and/or void
 * lines (their stored price comes off). Allowed from pending_payment to
 * out_for_delivery, never while a reader payment is in progress. Voiding once
 * the kitchen has started (preparing, ready, out_for_delivery) needs
 * `managerPin`. Promo percent and manager percent discounts follow the new
 * subtotal; fixed amounts stay, capped so the order never goes negative. The
 * delivery fee does not change. Money afterwards: `balance` > 0 → take it via
 * /pay; `refundDue` > 0 → offer it back via /refund.
 */
export type PosEdit = {
  add?: BasketLine[];
  remove?: { orderItemId: string; reason: string }[];
  managerPin?: string;
  /**
   * Optional, up to 64 chars, one per tap of "Save changes". A retry with the
   * same requestId on the same order is not applied twice: it gets the first
   * edit's result back with `replayed: true`.
   */
  requestId?: string;
};
export type PosEditResult = {
  order: PosOrderDetail;
  /** The "amended" event; the change ticket is built from it. */
  eventId: string;
  /** Browser print of only the added/voided lines. */
  changeTicketUrl: string;
  /** Printer webhook result: null when no printer is configured. */
  printer: { ok: boolean; error?: string } | null;
  /** Non-blocking, e.g. "Now below the £15.00 delivery minimum." */
  warnings: string[];
  /** True when this was a repeat of an edit already applied (same requestId); nothing changed. */
  replayed?: boolean;
};

/**
 * POST /api/pos/orders/:id/refund → PosRefundResult. Manager PIN always.
 * Card (online or reader) goes back through Stripe to the same card, partial
 * allowed; cash is recorded as money out of the drawer. Capped at the chosen
 * payment's `refundable`. Without `paymentId` the newest payment that can
 * cover the amount is used; if none can alone, 409 - pick one. The same
 * amount on the same payment twice within 10 s is refused as a double tap.
 */
export type PosRefundRequest = { amount: number; reason: string; managerPin: string; paymentId?: string };
export type PosRefundResult = { refund: PosRefund; order: PosOrderDetail };

export type PrintCopy = "kitchen" | "customer" | "driver";

/** POST /api/pos/orders/:id/reprint → PosReprintResult. Opens `printUrl` in the browser whatever the printer said. */
export type PosReprint = { copy: PrintCopy };
export type PosReprintResult = { printUrl: string; printer: { ok: boolean; error?: string } | null };

/** The browser print page for any copy; `changes` needs the edit's eventId. */
export function printUrl(orderId: string, copy: PrintCopy | "all" | "changes", eventId?: string): string {
  const q = copy === "changes" && eventId ? `copy=changes&event=${encodeURIComponent(eventId)}` : `copy=${copy}`;
  return `/kitchen/print/${encodeURIComponent(orderId)}?${q}`;
}
