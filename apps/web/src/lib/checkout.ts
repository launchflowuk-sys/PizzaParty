import "server-only";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getMenu, getLocations, getClientRow } from "./menu";
import { priceBasket } from "./pricing";
import { availability } from "./availability";
import { matchLocation, normalisePostcode } from "./postcode";
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

export async function priceRequest(body: BasketBodyT, opts: { customerPhone?: string } = {}) {
  const client = await getClientRow();
  const menu = await getMenu();
  const { location, postcodeOk, locations } = await resolveLocation(body);
  const promoCode = body.promoCode.trim().toUpperCase();
  const promo = promoCode ? await prisma.promo.findUnique({ where: { clientId_code: { clientId: client.id, code: promoCode } } }) : null;
  let isFirstOrder: boolean | undefined;
  if (promo?.firstOrderOnly && opts.customerPhone) {
    const c = await prisma.customer.findUnique({ where: { clientId_phone: { clientId: client.id, phone: opts.customerPhone } }, select: { ordersCount: true } });
    isFirstOrder = !c || c.ordersCount === 0;
  }
  const priced = priceBasket(menu, body.lines as BasketLine[], {
    fulfilment: body.fulfilment,
    deliveryFee: location?.deliveryFee ?? 0,
    minOrder: location?.minOrder ?? 0,
    promo: promo ?? (promoCode ? ({ active: false } as never) : null),
    isFirstOrder,
  });
  if (promoCode && !promo) priced.promoMessage = "Unknown promo code.";
  if (body.fulfilment === "delivery" && body.postcode && !postcodeOk) priced.errors.unshift("We don't deliver to that postcode. Switch to collection or try another postcode.");
  return { priced, location, locations, postcodeOk, promo: priced.promoCode ? promo : null, availability: location ? availability(location) : null };
}
