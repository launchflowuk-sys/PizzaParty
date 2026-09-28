/**
 * Deliverect order webhook → our order. Pure: no server imports, so
 * scripts/tests/deliverect.test.ts runs it on a fixture.
 *
 * Deliverect relays Just Eat, Deliveroo and Uber Eats orders to a POS as one
 * JSON shape (their "POS integration" order webhook). Every field we read is
 * listed in `DeliverectOrder` below. Their developer docs sit behind a bot wall
 * we could not read from here, so the shape follows their published order model
 * (field names confirmed against an open-source Go client of the same API).
 *
 * TODO confirm against developers.deliverect.com once the account exists:
 *   1. `channel` numbers: Deliveroo = 2 is documented; Uber Eats (7?) and Just Eat
 *      are guesses - set DELIVERECT_CHANNELS explicitly (see .env.example).
 *   2. How "our driver" vs "their rider" is flagged on orderType 2. We read
 *      `deliveryBy`/`courier.deliveryBy` === "restaurant" as own delivery and treat
 *      everything else as the platform's rider collecting.
 *   3. Money is in minor units scaled by `decimalDigits` (2 in the UK). `payment.amount`
 *      is taken as what the customer paid; `discountTotal` may be negative.
 *   4. `status` 100/110 on a re-sent order = the platform cancelled it.
 *
 * PLU scheme (what the menu export sends and what orders are matched on):
 *   product, one size    <productSlug>            e.g. "garlic-bread"
 *   product, a size      <productSlug>@<sizeKey>  e.g. "margherita@12"
 *   option               mod:<groupKey>:<key>     e.g. "mod:toppings:mushroom"
 *   deal                 deal:<dealSlug>          e.g. "deal:family-feast"
 * Anything that does not match is kept as a free-text line at the marketplace's
 * price, and the order is flagged `needsAttention` - nothing is ever dropped.
 */
import { z } from "zod";
import type { BasketLine, PricedLine } from "./basket-types";
import type { MarketplaceSource } from "./pos-phase4-types";

const SubItem: z.ZodType<DeliverectSubItem, z.ZodTypeDef, unknown> = z.lazy(() => z.object({
  plu: z.string().default(""),
  name: z.string().default(""),
  price: z.number().default(0),
  quantity: z.number().int().min(1).default(1),
  subItems: z.array(SubItem).default([]),
}).passthrough());
type DeliverectSubItem = { plu: string; name: string; price: number; quantity: number; subItems: DeliverectSubItem[] };

export const DeliverectOrder = z.object({
  _id: z.string().min(1),
  channelOrderId: z.string().default(""),
  channelOrderDisplayId: z.string().default(""),
  channel: z.number().int().optional(),
  channelLink: z.string().default(""),
  location: z.string().default(""),
  status: z.number().int().default(10),
  /** 1 pickup, 2 delivery, 3 eat in. */
  orderType: z.number().int().default(1),
  deliveryBy: z.string().optional(),
  courier: z.object({ deliveryBy: z.string().optional() }).passthrough().optional(),
  pickupTime: z.string().optional(),
  deliveryTime: z.string().optional(),
  deliveryIsAsap: z.boolean().default(true),
  tableNumber: z.union([z.string(), z.number()]).optional(),
  customer: z.object({
    name: z.string().default(""),
    phoneNumber: z.string().default(""),
    phoneAccessCode: z.string().default(""),
    email: z.string().default(""),
    note: z.string().default(""),
  }).passthrough().default({}),
  deliveryAddress: z.object({
    street: z.string().default(""),
    streetNumber: z.string().default(""),
    postalCode: z.string().default(""),
    city: z.string().default(""),
    extraAddressInfo: z.string().default(""),
  }).passthrough().optional(),
  orderIsAlreadyPaid: z.boolean().default(true),
  payment: z.object({ amount: z.number(), type: z.number().int().default(0) }).passthrough(),
  note: z.string().default(""),
  decimalDigits: z.number().int().min(0).max(4).default(2),
  deliveryCost: z.number().default(0),
  serviceCharge: z.number().default(0),
  bagFee: z.number().default(0),
  tip: z.number().default(0),
  discountTotal: z.number().default(0),
  testOrder: z.boolean().default(false),
  items: z.array(z.object({
    plu: z.string().default(""),
    name: z.string().default(""),
    price: z.number().default(0),
    quantity: z.number().int().min(1).default(1),
    remark: z.string().default(""),
    subItems: z.array(SubItem).default([]),
  }).passthrough()).min(1),
}).passthrough();
export type DeliverectOrderT = z.infer<typeof DeliverectOrder>;

/** Deliverect's order status codes we send and receive. */
export const DELIVERECT_STATUS = { accepted: 20, preparing: 50, ready: 70, inDelivery: 80, finalized: 90, cancel: 100, cancelled: 110 } as const;

/** Only Deliveroo = 2 is documented; the rest must be confirmed (DELIVERECT_CHANNELS overrides). */
export const DEFAULT_CHANNELS: Record<number, MarketplaceSource> = { 2: "deliveroo", 7: "ubereats", 10: "justeat" };
const SOURCES: readonly string[] = ["justeat", "deliveroo", "ubereats"];

/** "2=deliveroo,7=ubereats" → { 2: "deliveroo", 7: "ubereats" }. Bad pairs are ignored. */
export function parseChannels(raw: string): Record<number, MarketplaceSource> {
  if (!raw.trim()) return DEFAULT_CHANNELS;
  const out: Record<number, MarketplaceSource> = {};
  for (const pair of raw.split(",")) {
    const [k, v] = pair.split("=").map((s) => s.trim().toLowerCase());
    if (/^\d+$/.test(k ?? "") && SOURCES.includes(v ?? "")) out[Number(k)] = v as MarketplaceSource;
  }
  return out;
}

/** Just enough of our menu to match PLUs. */
export type MenuIndex = {
  products: { id: string; slug: string; name: string; sizes: { key: string; name: string }[]; groups: { key: string; name: string; modifiers: { key: string; name: string }[] }[] }[];
  deals: { id: string; slug: string; name: string }[];
};

export type MappedOrder = {
  externalRef: string;
  displayId: string;
  source: MarketplaceSource;
  fulfilment: "delivery" | "collection" | "eat_in";
  /** "marketplace" = the platform's rider collects it. */
  courier: "marketplace" | null;
  tableNumber: string | null;
  customer: { name: string; phone: string };
  address: { line1: string; line2: string; city: string; postcode: string } | null;
  notes: string;
  scheduledFor: Date | null;
  lines: PricedLine[];
  basket: BasketLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  /** false = the customer pays on the door (cash): our driver collects it. */
  paid: boolean;
  needsAttention: boolean;
  problems: string[];
  cancelled: boolean;
  test: boolean;
};

const CASH_TYPES = new Set([1, 2, 4, 5, 6]); // cash, on delivery, card/PIN/voucher at the door

export function mapDeliverectOrder(o: DeliverectOrderT, menu: MenuIndex, channels: Record<number, MarketplaceSource>, fallback: MarketplaceSource): MappedOrder {
  const pence = (v: number) => Math.round(v * 10 ** (2 - o.decimalDigits));
  const problems: string[] = [];
  let source = o.channel !== undefined ? channels[o.channel] : undefined;
  if (!source) {
    problems.push(`Unknown marketplace channel ${o.channel ?? "(none)"}; filed as ${fallback}.`);
    source = fallback;
  }

  const lines: PricedLine[] = [];
  const basket: BasketLine[] = [];
  o.items.forEach((it, n) => {
    const key = `dx${n}`;
    const flat = flatten(it.subItems);
    const modsPence = flat.reduce((s, m) => s + pence(m.price) * m.quantity, 0);
    const unitPrice = pence(it.price);
    const lineTotal = (unitPrice + modsPence) * it.quantity;
    const notes = it.remark.slice(0, 500);

    if (it.plu.startsWith("deal:")) {
      const deal = menu.deals.find((d) => d.slug === it.plu.slice(5));
      if (!deal) problems.push(`Not on the menu: ${it.name || it.plu}`);
      lines.push({ key, kind: "deal", name: deal?.name ?? it.name, detail: flat.map((m) => m.name).join(", "), qty: it.quantity, unitPrice, lineTotal, dealId: deal?.id, sizeKey: "", sizeName: "", modifiers: flat.map((m) => ({ groupName: "Deal", name: label(m), price: pence(m.price) })), components: [], notes });
      basket.push({ key, kind: "deal", deal: deal?.slug, qty: it.quantity, name: deal?.name ?? it.name, notes });
      return;
    }
    const [slug, sizeKey] = it.plu.split("@");
    const product = menu.products.find((p) => p.slug === slug);
    const size = product ? (sizeKey ? product.sizes.find((s) => s.key === sizeKey) : product.sizes.length === 1 ? product.sizes[0] : undefined) : undefined;
    const matched = !!product && (!!size || (!sizeKey && product.sizes.length === 0));
    if (!matched) problems.push(`Not on the menu: ${it.name || it.plu}${it.plu ? ` (PLU ${it.plu})` : ""}`);

    const mods = flat.map((m) => {
      const [, group, mod] = m.plu.split(":");
      const g = product?.groups.find((x) => x.key === group);
      const opt = m.plu.startsWith("mod:") ? g?.modifiers.find((x) => x.key === mod) : undefined;
      if (!opt) problems.push(`Option not on the menu: ${m.name || m.plu}`);
      return { m, g, opt };
    });
    lines.push({
      key, kind: "product",
      name: matched ? product!.name : it.name || it.plu,
      detail: [size?.name, ...mods.map((x) => x.opt?.name ?? label(x.m))].filter(Boolean).join(", "),
      qty: it.quantity, unitPrice, lineTotal, productId: matched ? product!.id : undefined,
      sizeKey: size?.key ?? "", sizeName: size?.name ?? "",
      modifiers: mods.map((x) => ({ groupName: x.g?.name ?? "Extras", name: x.opt?.name ?? label(x.m), price: pence(x.m.price) * x.m.quantity })),
      components: [], notes,
    });
    basket.push({
      key, kind: "product", qty: it.quantity, name: it.name, notes,
      ...(matched ? { product: product!.slug, size: size?.key, modifiers: mods.filter((x) => x.g && x.opt).map((x) => ({ group: x.g!.key, modifier: x.opt!.key })) } : {}),
    });
  });

  // The platform already charged the customer: its total is the order's total.
  // Our columns still have to add up (subtotal + fees - discount = total), so
  // any gap the items do not explain is shown as discount or as fees.
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const total = pence(o.payment.amount);
  let fees = pence(o.deliveryCost) + pence(o.serviceCharge) + pence(o.bagFee) + pence(o.tip);
  let discount = subtotal + fees - total;
  if (discount < 0) { fees -= discount; discount = 0; }

  const own = o.deliveryBy === "restaurant" || o.courier?.deliveryBy === "restaurant";
  const fulfilment = o.orderType === 3 ? "eat_in" : o.orderType === 2 && own ? "delivery" : "collection";
  const courier = o.orderType === 2 && !own ? "marketplace" : null;
  const a = o.deliveryAddress;
  const when = o.deliveryIsAsap ? null : (fulfilment === "delivery" ? o.deliveryTime : o.pickupTime) ?? null;
  const scheduledFor = when && !Number.isNaN(Date.parse(when)) && Date.parse(when) > Date.now() ? new Date(when) : null;
  const phone = [o.customer.phoneNumber, o.customer.phoneAccessCode ? `code ${o.customer.phoneAccessCode}` : ""].filter(Boolean).join(" ");

  return {
    externalRef: o._id,
    displayId: (o.channelOrderDisplayId || o.channelOrderId || o._id).slice(0, 40),
    source, fulfilment, courier,
    tableNumber: fulfilment === "eat_in" && o.tableNumber !== undefined ? String(o.tableNumber).slice(0, 12) : null,
    customer: { name: (o.customer.name || "Marketplace customer").slice(0, 80), phone: phone.slice(0, 40) },
    address: fulfilment === "delivery" && a ? { line1: [a.streetNumber, a.street].filter(Boolean).join(" ").slice(0, 120), line2: a.extraAddressInfo.slice(0, 120), city: a.city.slice(0, 80), postcode: a.postalCode.slice(0, 10) } : null,
    notes: [o.note, o.customer.note, o.testOrder ? "TEST ORDER" : ""].filter(Boolean).join(" · ").slice(0, 300),
    scheduledFor, lines, basket, subtotal, deliveryFee: fees, discount, total,
    paid: o.orderIsAlreadyPaid || !CASH_TYPES.has(o.payment.type),
    needsAttention: problems.length > 0,
    problems, cancelled: o.status === DELIVERECT_STATUS.cancel || o.status === DELIVERECT_STATUS.cancelled, test: o.testOrder,
  };
}

const label = (m: DeliverectSubItem) => `${m.quantity > 1 ? `${m.quantity}× ` : ""}${m.name || m.plu}`;

/** Options can nest (a topping inside a size choice); the kitchen needs every one of them. */
function flatten(items: DeliverectSubItem[]): DeliverectSubItem[] {
  return items.flatMap((s) => [s, ...flatten(s.subItems)]);
}

/** Our status → Deliverect's, or null when there is nothing to tell them. */
export function deliverectStatusFor(to: string, courier: string | null): number | null {
  switch (to) {
    case "accepted": return DELIVERECT_STATUS.accepted;
    case "preparing": return DELIVERECT_STATUS.preparing;
    case "ready": return DELIVERECT_STATUS.ready;
    case "out_for_delivery": return courier === "marketplace" ? null : DELIVERECT_STATUS.inDelivery;
    case "completed": return DELIVERECT_STATUS.finalized;
    case "rejected": case "cancelled": return DELIVERECT_STATUS.cancelled;
    default: return null;
  }
}
