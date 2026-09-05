/**
 * What can be sent, to whom, over what.
 *
 * This lives in the database package rather than the web app because both the
 * seeder and the back office need the same list. Adding an event here and
 * nowhere else is the intended way to add a notification: the settings screen
 * builds itself from these arrays.
 */

export const NOTIFY_EVENTS = [
  "order_placed",
  "order_accepted",
  "order_preparing",
  "order_ready",
  "order_out_for_delivery",
  "order_completed",
  "order_rejected",
  "order_refunded",
  "review_request",
] as const;

export const NOTIFY_AUDIENCES = ["customer", "kitchen", "admin", "driver"] as const;
export const NOTIFY_CHANNELS = ["email", "sms"] as const;

export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];
export type NotifyAudience = (typeof NOTIFY_AUDIENCES)[number];
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

/** Plain English for the settings screen. No jargon: the owner reads these. */
export const EVENT_LABEL: Record<NotifyEvent, string> = {
  order_placed: "Order placed",
  order_accepted: "Order accepted",
  order_preparing: "In the oven",
  order_ready: "Ready",
  order_out_for_delivery: "Out for delivery",
  order_completed: "Delivered or collected",
  order_rejected: "Order refused",
  order_refunded: "Refund issued",
  review_request: "Review request",
};

export const EVENT_HINT: Record<NotifyEvent, string> = {
  order_placed: "The moment payment clears and the order is real.",
  order_accepted: "The kitchen has taken it and a time has been given.",
  order_preparing: "Food has started. Most shops leave this one off — it is noise.",
  order_ready: "Collection orders only. Delivery orders use the next one.",
  order_out_for_delivery: "The driver has left with it.",
  order_completed: "Handed over. The receipt and the loyalty points.",
  order_rejected: "The shop could not take it. Say why, and say what happens to their money.",
  order_refunded: "Money has actually gone back. Separate from the refusal above.",
  review_request: "Sent later, once the meal has been eaten.",
};

export const AUDIENCE_LABEL: Record<NotifyAudience, string> = {
  customer: "Customer",
  kitchen: "Kitchen",
  admin: "Owner",
  driver: "Driver",
};

/**
 * Which combinations are real.
 *
 * A driver has no interest in a review request and the kitchen does not need
 * telling that the driver has left. Rendering the full nine-by-four grid would
 * offer thirty switches that do nothing, so the settings screen only draws the
 * cells listed here.
 */
export const APPLICABLE: Record<NotifyEvent, NotifyAudience[]> = {
  order_placed: ["customer", "kitchen", "admin"],
  order_accepted: ["customer", "admin"],
  order_preparing: ["customer"],
  order_ready: ["customer", "driver", "admin"],
  order_out_for_delivery: ["customer", "admin"],
  order_completed: ["customer", "admin"],
  order_rejected: ["customer", "admin"],
  order_refunded: ["customer", "admin"],
  review_request: ["customer"],
};

/**
 * What a new shop starts with.
 *
 * The shape of this is the whole argument: **email is on nearly everywhere,
 * SMS only where somebody has to look at their phone right now.** A text costs
 * around four pence and an email costs nothing, so a shop doing two hundred
 * orders a week that texts every status change is spending real money to tell
 * people things they would happily read in an inbox.
 *
 * SMS defaults to on for exactly four moments: the order landing (the customer
 * wants immediate proof, the kitchen has to look up from the counter), the
 * order being refused, and the driver being handed a job. Everything else is
 * email until the shop decides otherwise.
 */
type Default = { event: NotifyEvent; audience: NotifyAudience; email: boolean; sms: boolean; delayMinutes?: number };

export const DEFAULT_RULES: Default[] = [
  { event: "order_placed", audience: "customer", email: true, sms: true },
  { event: "order_placed", audience: "kitchen", email: true, sms: true },
  { event: "order_placed", audience: "admin", email: true, sms: false },

  { event: "order_accepted", audience: "customer", email: true, sms: true },
  { event: "order_accepted", audience: "admin", email: false, sms: false },

  // Off by default. A text every time a pizza goes in the oven is how a shop
  // teaches its customers to ignore its texts.
  { event: "order_preparing", audience: "customer", email: false, sms: false },

  { event: "order_ready", audience: "customer", email: true, sms: true },
  { event: "order_ready", audience: "driver", email: false, sms: true },
  { event: "order_ready", audience: "admin", email: false, sms: false },

  { event: "order_out_for_delivery", audience: "customer", email: true, sms: true },
  { event: "order_out_for_delivery", audience: "admin", email: false, sms: false },

  { event: "order_completed", audience: "customer", email: true, sms: false },
  { event: "order_completed", audience: "admin", email: true, sms: false },

  { event: "order_rejected", audience: "customer", email: true, sms: true },
  { event: "order_rejected", audience: "admin", email: true, sms: false },

  { event: "order_refunded", audience: "customer", email: true, sms: false },
  { event: "order_refunded", audience: "admin", email: true, sms: false },

  { event: "review_request", audience: "customer", email: true, sms: false, delayMinutes: 45 },
];
