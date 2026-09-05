import "server-only";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getMenu, getLocations, getClientRow } from "./menu";
import { priceBasket, type PricingPromo } from "./pricing";
import { availability } from "./availability";
import { matchLocation, normalisePostcode } from "./postcode";
import { referrerFor, refereePromo, promoBelongsTo } from "./referral";
import type { BasketLine } from "./basket-types";

const Modifier = z.object({ group: z.string(), modifier: z.string() });
export const LineSchema = z.object({
  key: z.string().min(1).max(32),
  kind: z.enum(["product", "deal"]),
  product: z.string().optional(),
  size: z.string().optional(),
  modifiers: z.array(Modifier).max(30).optional(),
  deal: z.string().optional(),
  components: z.array(z.object({ slot: z.number().int().min(0), product: z.string(), size: z.string(), modifiers: z.array(Modifier).max(30) })).max(20).optional(),
  qty: z.number().int().min(1).max(20),
  notes: z.string().max(200).optional(),
}).passthrough();

export const BasketBody = z.object({
  lines: z.array(LineSchema).max(50),
  fulfilment: z.enum(["delivery", "collection"]).default("delivery"),
  postcode: z.string().max(10).optional().default(""),
  locationKey: z.string().max(40).optional().default(""),
  promoCode: z.string().max(30).optional().default(""),
});
export type BasketBodyT = z.infer<typeof BasketBody>;

export async function resolveLocation(body: Pick<BasketBodyT, "fulfilment" | "postcode" | "locationKey">) {
  const locations = await getLocations();
  if (body.fulfilment === "delivery" && body.postcode) {
    const m = matchLocation(normalisePostcode(body.postcode), locations);
    if (m) return { location: m, locations, postcodeOk: true };
    return { location: null, locations, postcodeOk: false };
  }
  const byKey = body.locationKey ? locations.find((l) => l.key === body.locationKey) : undefined;
  return { location: byKey ?? locations[0] ?? null, locations, postcodeOk: body.fulfilment !== "delivery" };
}

/**
 * Stands in for a code we cannot honour.
 *
 * Pricing walks every rule before deciding, so it needs a complete offer even
 * when the answer is no. Handing it a bare `{ active: false }` threw on the
 * first rule that read an array, which turned a customer mistyping a code into
 * a 500 at the checkout.
 */
function rejectedPromo(code: string): PricingPromo {
  return {
    code, type: "fixed", value: 0, minOrder: 0, fulfilment: [],
    startsAt: null, endsAt: null, maxUses: null, uses: 0,
    firstOrderOnly: false, active: false,
  };
}

export async function priceRequest(body: BasketBodyT, opts: { customerPhone?: string } = {}) {
  const client = await getClientRow();
  const menu = await getMenu();
  const { location, postcodeOk, locations } = await resolveLocation(body);
  const promoCode = body.promoCode.trim().toUpperCase();
  const promo = promoCode ? await prisma.promo.findUnique({ where: { clientId_code: { clientId: client.id, code: promoCode } } }) : null;

  // Who is ordering, if we can tell. Needed for first-order rules, and to stop
  // a reward minted for one person being spent by whoever they read it out to.
  const customer = opts.customerPhone
    ? await prisma.customer.findUnique({
        where: { clientId_phone: { clientId: client.id, phone: opts.customerPhone } },
        select: { id: true, ordersCount: true, referredById: true },
      })
    : null;

  let isFirstOrder: boolean | undefined;
  if (opts.customerPhone) isFirstOrder = !customer || customer.ordersCount === 0;

  // A code that is not a promo may still be somebody's referral code. Resolved
  // into the same shape so pricing, minimums and error messages behave alike.
  let referrerId = "";
  let effective: typeof promo | ReturnType<typeof refereePromo> | null = promo;
  if (promoCode && !promo) {
    const referrer = await referrerFor(client.id, promoCode);
    // You cannot introduce yourself, and a code only counts on a first order.
    if (referrer && referrer.id !== customer?.id && isFirstOrder !== false) {
      referrerId = referrer.id;
      effective = refereePromo(promoCode);
    }
  } else if (promo && !promoBelongsTo(promo, customer?.id ?? null)) {
    // Someone else's reward. Refused rather than silently ignored, so the
    // person holding it is told why instead of wondering.
    effective = null;
  }

  const priced = priceBasket(menu, body.lines as BasketLine[], {
    fulfilment: body.fulfilment,
    deliveryFee: location?.deliveryFee ?? 0,
    minOrder: location?.minOrder ?? 0,
    promo: effective ?? (promoCode ? rejectedPromo(promoCode) : null),
    isFirstOrder,
  });
  if (promoCode && !effective) {
    priced.promoMessage = promo ? "That code was issued to someone else." : "Unknown promo code.";
  }
  if (body.fulfilment === "delivery" && body.postcode && !postcodeOk) priced.errors.unshift("We don't deliver to that postcode. Switch to collection or try another postcode.");
  return {
    priced, location, locations, postcodeOk,
    promo: priced.promoCode ? promo : null,
    /** Set when the code used was a referral code that priced successfully. */
    referrerId: priced.promoCode && referrerId ? referrerId : "",
    availability: location ? availability(location) : null,
  };
}
