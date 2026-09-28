/** The contract between the POS screen and /api/pos/*. No server imports here. All money in pence. */
import type { BasketLine, PricedBasket } from "./basket-types";
import type { PosFulfilment } from "./pos-phase4-types";

export type OrderSource = "web" | "app" | "pos" | "phone";
export type PosPaymentKind = "cash" | "reader" | "later";

export type PosDiscount = { kind: "percent" | "amount"; value: number; reason: string; managerPin: string };

export type PosReader = { id: string; label: string; status: "online" | "offline"; simulated: boolean };

/** GET /api/pos/bootstrap */
export type PosBootstrap = {
  staff: { id: string; name: string; role: string };
  shopName: string;
  /** Product slugs in best-seller order, for the pinned row. */
  bestsellers: string[];
  locations: { key: string; name: string }[];
  readers: PosReader[];
  cashOnDelivery: boolean;
  /** Shop status the website sees; the till may still take orders. */
  onlineStatus: { open: boolean; paused: boolean; message: string };
  /** Phase 4. Offer "Eat in" (with a table number) on the till. */
  eatIn: boolean;
};

/** Body for POST /api/pos/price and the basket part of POST /api/pos/orders. */
export type PosBasket = {
  lines: BasketLine[];
  /** "eat_in" only when bootstrap says `eatIn`; needs PosCreateOrderExtras.tableNumber. */
  fulfilment: PosFulfilment;
  postcode?: string;
  locationKey?: string;
  discount?: PosDiscount;
};

/** POST /api/pos/price → PricedBasket plus the manual discount applied on top. */
export type PosPriced = PricedBasket & { manualDiscount: number };

export type PosAddress = { id: string; line1: string; line2: string; city: string; postcode: string; notes: string };

export type PosPastOrder = { id: string; number: number; placedAt: string; total: number; summary: string; lines: BasketLine[] };

/** GET /api/pos/customers?phone= → { customer: PosCustomer | null } */
export type PosCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  ordersCount: number;
  totalSpent: number;
  loyaltyPoints: number;
  staffNotes: string;
  blocked: boolean;
  addresses: PosAddress[];
  lastOrders: PosPastOrder[];
};

/** POST /api/pos/orders */
export type PosCreateOrder = PosBasket & {
  source: "pos" | "phone";
  customer: { name: string; phone?: string; email?: string };
  address?: { line1: string; line2?: string; city?: string; postcode: string };
  notes?: string;
  /** ISO; omitted = ASAP. */
  scheduledFor?: string;
  /** "later" = pay on collection/delivery; the order goes to the kitchen now. */
  payment: PosPaymentKind;
};

export type PosOrderRef = { id: string; number: number; total: number; paid: number; status: string };

/** POST /api/pos/orders/:id/pay */
export type PosPay =
  | { kind: "cash"; amount: number; tendered: number }
  | { kind: "reader"; amount: number; readerId: string };

/** Response of POST .../pay and GET .../pay/:paymentId */
export type PosPayment = {
  id: string;
  kind: "cash" | "reader";
  amount: number;
  change?: number;
  /** reader: waiting → succeeded | failed | cancelled. cash is always succeeded. */
  status: "waiting" | "succeeded" | "failed" | "cancelled";
  message?: string;
  order: PosOrderRef;
};
