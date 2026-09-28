/**
 * The contract between the till's money screens (Z report, cash drawer, driver
 * cash, Stripe match, price log) and the Phase 3 routes. No server imports.
 * Same conventions as pos-types.ts / pos-queue-types.ts: all money is integer
 * pence, all times are ISO strings, dates are "YYYY-MM-DD" in the shop's
 * timezone, a success is the bare body, a failure is a non-2xx
 * `{ error: string, issues?: string[], needsPin?: true }`.
 *
 * Who may call what:
 *   day report, CSV, print page, driver cash (read)  → manager, shift_lead ("reports" screen)
 *   close day, Stripe match, price changes           → manager (close day also needs a manager PIN)
 *   drawer read / movements ≤ £50 / driver settle ≤ £50 → anyone on the till
 *   movements or settles over £50, opening the drawer → manager PIN (not needed when signed in as a manager)
 *   closing the drawer                                → manager PIN always
 *
 * Status codes: 400 bad body/date · 401 not signed in · 403 role cannot, or the
 * manager PIN was wrong / locked out (`needsPin: true` when one is missing) ·
 * 404 not this shop's · 409 the state forbids it (message says why) ·
 * 502 Stripe refused.
 */
import type { OrderSource } from "./pos-types";
import type { PaymentKind } from "./pos-queue-types";

/* ---------- Cash drawer ---------- */

export type DrawerMovementKind = "pay_in" | "pay_out";

export type PosDrawerMovement = {
  id: string;
  kind: DrawerMovementKind;
  amount: number;
  reason: string;
  /** Who did it at the till. */
  actor: string;
  /** Manager whose PIN approved it; "" when no PIN was needed. */
  approvedBy: string;
  /** Set on a driver's cash hand-in (POST /api/pos/drivers/:id/settle). */
  driverId: string | null;
  driverName: string | null;
  createdAt: string;
};

/**
 * One drawer session: opened with a float, closed with a count. Only one is
 * open per shop location at a time.
 *
 * expected = float + cashSales − cashRefunds + payIns + driverHandIns − payOuts
 *
 * cashSales is counter cash only: cash a driver collected on the doorstep is
 * the driver's until it is handed in, and then it arrives as driverHandIns.
 * Once closed, every figure is frozen as it was at the close.
 */
export type PosDrawer = {
  id: string;
  locationKey: string;
  locationName: string;
  openedAt: string;
  openedBy: string;
  float: number;
  closedAt: string | null;
  closedBy: string | null;
  cashSales: number;
  cashRefunds: number;
  /** Pay-ins other than driver hand-ins. */
  payIns: number;
  payOuts: number;
  driverHandIns: number;
  expected: number;
  /** Null until closed. */
  counted: number | null;
  /** counted − expected: positive over, negative short. Null until closed. */
  overShort: number | null;
  /** Oldest first. */
  movements: PosDrawerMovement[];
};

/** GET /api/pos/drawer[?location=key] → the open session, else the last closed one today (`drawer.closedAt` set), else null. */
export type PosDrawerResponse = { drawer: PosDrawer | null };

/** POST /api/pos/drawer/open → PosDrawer. 409 if one is already open. */
export type PosDrawerOpen = { float: number; managerPin?: string; locationKey?: string };

/** POST /api/pos/drawer/movement → PosDrawer. Over £50 needs `managerPin`. 409 if no drawer is open. */
export type PosDrawerMovementBody = { kind: DrawerMovementKind; amount: number; reason: string; managerPin?: string; locationKey?: string };

/** POST /api/pos/drawer/close → PosDrawer (closed). Manager PIN always. */
export type PosDrawerClose = { counted: number; managerPin: string; locationKey?: string };

/** Largest pay-in / pay-out / driver settle the till may do without a manager PIN. */
export const DRAWER_NO_PIN_LIMIT = 5000;

/* ---------- Driver cash ---------- */

/**
 * Attribution rule: a cash payment on a delivery order is the driver's when it
 * is taken after the order went out for delivery. The driver is whoever holds
 * the order at that moment, else the last driver put on it. Anything else is
 * counter cash and goes straight to the drawer.
 */
export type PosDriverCashOrder = { orderId: string; number: number; amount: number; at: string };

export type PosDriverCash = {
  id: string;
  name: string;
  /** Cash they collected on the doorstep that day. */
  collected: number;
  /** Cash they handed in that day. */
  handedIn: number;
  /** Still to hand in, all days up to the end of this one (so yesterday's unpaid cash carries). Never negative. */
  owed: number;
  orders: PosDriverCashOrder[];
};

/** GET /api/pos/drivers/cash[?date=] → every active driver, plus any inactive one still owing or with cash that day. */
export type PosDriversCashResponse = { date: string; drivers: PosDriverCash[] };

/**
 * POST /api/pos/drivers/:id/settle → PosDriverSettleResult. Records a hand-in
 * as a drawer pay-in linked to the driver. Needs an open drawer; capped at
 * what they owe (409 above it). Over £50 needs `managerPin`.
 */
export type PosDriverSettle = { amount: number; managerPin?: string; note?: string; locationKey?: string };
export type PosDriverSettleResult = { driver: PosDriverCash; drawer: PosDrawer };

/* ---------- End-of-day (Z) report ---------- */

export type PosAmountRow = { count: number; amount: number };

export type PosVoidLine = { orderId: string; orderNumber: number; qty: number; name: string; value: number; reason: string; by: string; approvedBy: string; at: string };

export type PosOutstanding = { orderId: string; number: number; customerName: string; source: OrderSource; total: number; balance: number };

export type PosAdjustment = {
  refundId: string;
  orderId: string;
  orderNumber: number;
  /** The day the order was placed (already closed, or at least before this report's period). */
  orderDate: string;
  kind: PaymentKind;
  amount: number;
  reason: string;
  at: string;
};

/**
 * GET /api/pos/reports/day[?date=YYYY-MM-DD][&format=csv] (default today).
 * Printable 80 mm version: /admin/reports/day/print?date=YYYY-MM-DD.
 *
 * Period: midnight to midnight in the shop's timezone, except that when the
 * day before was closed early (before its midnight), this day starts at that
 * close, so nothing between a close and midnight falls through a gap.
 *
 * A closed day returns its stored snapshot (`closed` set) and never changes
 * again. Anything that happens later to its orders (a refund, say) lands in
 * the report of the day it happens, listed under `adjustments`.
 *
 * Sales are orders placed in the period (not rejected/cancelled), at what they
 * cost now (after edits). Takings and refunds are money that moved in the
 * period, whichever day the order was from.
 *   sales.total   = sales.subtotal + sales.deliveryFees − sales.promoDiscounts − sales.managerDiscounts
 *   netTakings    = Σ takings − Σ refunds
 */
export type PosDayReport = {
  date: string;
  timezone: string;
  from: string;
  to: string;
  generatedAt: string;
  closed: { at: string; by: string; approvedBy: string; counted: number | null } | null;
  sales: {
    orders: number;
    subtotal: number;
    deliveryFees: number;
    promoDiscounts: number;
    managerDiscounts: number;
    total: number;
    /** total / orders, rounded; 0 with no orders. */
    averageOrder: number;
  };
  /** Always all four channels, in the order web, app, pos, phone. */
  byChannel: ({ channel: OrderSource } & PosAmountRow)[];
  /** By who took it; "Online" for website/app orders. Biggest first. */
  byStaff: ({ name: string } & PosAmountRow)[];
  /** Money in by method (gross, before refunds). Always card, reader, cash. */
  takings: ({ kind: PaymentKind } & PosAmountRow)[];
  /** Money back by method. Always card, reader, cash. Failed card refunds are left out. */
  refunds: ({ kind: PaymentKind } & PosAmountRow)[];
  netTakings: number;
  /** The part of this period's refunds that was goodwill on goods the customer kept. */
  goodwill: number;
  /** Tips are not taken; always 0, here so the report says so. */
  tips: number;
  /** Items taken off sent orders in this period (edits). */
  voids: PosAmountRow & { lines: PosVoidLine[] };
  /** Orders placed in the period that were then rejected or cancelled. */
  cancelled: PosAmountRow;
  /** Orders placed in the period with money still owed now. */
  outstanding: { count: number; amount: number; orders: PosOutstanding[] };
  /** Top 10 by quantity (deals count as the deal). */
  topProducts: { name: string; qty: number; revenue: number }[];
  /** Refunds in this period on orders from before it. */
  adjustments: PosAdjustment[];
  /** Drawer sessions opened in the period. */
  drawers: PosDrawer[];
  /** Σ drawers' expected; null when no drawer was used. */
  cashExpected: number | null;
  /** Σ drawers' counted, for closed drawers; null when none was counted. */
  cashCounted: number | null;
  /** Driver doorstep cash in the period and what drivers still owe at its end. */
  driverCash: { collected: number; handedIn: number; owed: number };
};

/** POST /api/pos/reports/day/close → PosDayReport (closed). Manager PIN. 409 if already closed, a drawer is still open, or the date is in the future. */
export type PosDayClose = { date?: string; managerPin: string; /** Only when no drawer was used; otherwise the drawers' counts are used. */ counted?: number };

/* ---------- Stripe match ---------- */

export type StripeMatchFlag = "ok" | "missing_in_stripe" | "missing_in_till" | "amount_mismatch";

export type StripeMatchRow = {
  /** charge = money in, refund = money back. */
  type: "charge" | "refund";
  flag: StripeMatchFlag;
  /** Our side (null when only Stripe has it). */
  paymentId: string | null;
  refundId: string | null;
  orderId: string | null;
  orderNumber: number | null;
  kind: PaymentKind | null;
  till: number | null;
  /** Stripe's side (null when only we have it). Refunds are positive here. */
  stripeGross: number | null;
  stripeFee: number | null;
  stripeNet: number | null;
  paymentIntent: string;
  at: string;
};

/**
 * GET /api/pos/reports/stripe[?date=]. Stripe's balance transactions for the
 * period on the shop's connected account, matched to our card payments
 * (online + reader) and card refunds by PaymentIntent / refund id.
 * `configured: false` (and empty lists) when Stripe is not set up.
 */
export type PosStripeReport = {
  date: string;
  from: string;
  to: string;
  configured: boolean;
  /** Set when Stripe could not be reached; the till side is still shown. */
  error: string | null;
  stripe: { charges: number; refunds: number; fees: number; net: number; other: number };
  till: { card: number; reader: number; refunds: number };
  /** Rows not "ok". */
  mismatches: number;
  rows: StripeMatchRow[];
};

/* ---------- Price change log ---------- */

export type PriceChangeKind = "size" | "modifier" | "deal" | "supplement" | "delivery_fee" | "min_order" | "band_fee" | "band_min";

export type PosPriceChange = {
  id: string;
  kind: PriceChangeKind;
  /** "Margherita · Large", "Grays delivery fee" … */
  label: string;
  /** null when the price did not exist before. */
  oldPrice: number | null;
  newPrice: number;
  /** "Sam (Manager)", "LaunchFlow (agency)" or "seed". */
  actor: string;
  at: string;
};

/** GET /api/pos/reports/price-changes[?from=&to=] (dates, inclusive; default the last 30 days). Newest first, at most 500. */
export type PosPriceChanges = { from: string; to: string; changes: PosPriceChange[] };
