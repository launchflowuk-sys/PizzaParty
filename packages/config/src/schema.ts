import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM");
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase-kebab-case");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex colour like #C8322B");
const money = z.number().nonnegative(); // pounds in config, pence in DB

export const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof dayKeys)[number];

/** ["16:00","23:00"] or [] for closed. Multiple ranges allowed: [["11:30","14:00"],["17:00","23:00"]] */
const dayHours = z.union([
  z.tuple([hhmm, hhmm]),
  z.array(z.tuple([hhmm, hhmm])),
  z.tuple([]),
]);

export const LocationSchema = z.object({
  id: slug,
  name: z.string().min(1),
  address: z.string().default(""),
  phone: z.string().default(""),
  lat: z.number().optional(),
  lng: z.number().optional(),
  timezone: z.string().default("Europe/London"),
  postcodePrefixes: z.array(z.string().min(2)).default([]),
  deliveryFee: money.default(0),
  minOrder: money.default(0),
  prepMinutes: z.number().int().positive().default(15),
  deliveryMinutes: z.number().int().positive().default(35),
  /**
   * Delivery charges that vary by area.
   *
   * Optional: a shop charging one price everywhere leaves this out and
   * `deliveryFee` applies to its whole patch. Where bands exist, `deliveryFee`
   * becomes the fallback for districts no band names.
   */
  deliveryBands: z
    .array(
      z.object({
        name: z.string().default(""),
        prefixes: z.array(z.string().min(2)).min(1),
        fee: money.default(0),
        /** 0 inherits the location's minimum rather than removing it. */
        minOrder: money.default(0),
        extraMinutes: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
  hours: z.record(z.enum(dayKeys), dayHours).default({}),
});

export const ClientSchema = z.object({
  slug,
  name: z.string().min(1),
  domain: z.string().min(1),
  legacyDomains: z.array(z.string()).default([]),
  brand: z.object({
    primary: hex,
    secondary: hex,
    logo: z.string().default("assets/logo.svg"),
    og: z.string().default("assets/og.jpg"),
    hero: z.string().default("assets/hero.jpg"),
    tagline: z.string().default(""),
    /**
     * How food photography is rendered.
     *
     * The Modernist prototypes desaturate every photograph, which is striking
     * and consistent but works against a takeaway's actual job - a golden
     * cheese pull sells a pizza and a grey one does not. Photos are always
     * stored in colour, so this is a presentation choice a shop can change
     * without re-shooting anything.
     */
    photoStyle: z.enum(["colour", "grayscale"]).default("colour"),
  }),
  contact: z
    .object({
      phone: z.string().default(""),
      email: z.string().default(""),
      address: z.string().default(""),
      reviewUrl: z.string().default(""),
      /**
       * The shop's Google Place ID, used to pull its reviews.
       * Find it at https://developers.google.com/maps/documentation/places/web-service/place-id
       * Leave empty and the Google review features simply stay switched off.
       */
      googlePlaceId: z.string().default(""),
      social: z.record(z.string()).default({}),
    })
    .default({}),
  locations: z.array(LocationSchema).min(1),
  fulfilment: z.array(z.enum(["delivery", "collection"])).min(1).default(["delivery", "collection"]),
  payments: z
    .object({
      stripeAccountId: z.string().default(""),
      cashOnCollection: z.boolean().default(true),
      cashOnDelivery: z.boolean().default(false),
    })
    .default({}),
  seo: z.object({
    locality: z.array(z.string().min(1)).min(1),
    cuisine: z.string().min(1),
    primaryKeyword: z.string().min(1),
    titleTemplate: z.string().default("{page} | {name} — Order Online"),
    homeTitle: z.string().default("{cuisine} Delivery in {locality} | {name} — Order Online"),
    homeDescription: z
      .string()
      .default("Order {cuisine} online from {name} for fast delivery or collection in {locality}. Fresh, hot and straight to your door."),
  }),
  notifications: z
    .object({
      kitchenEmail: z.string().default(""),
      kitchenSms: z.string().default(""),
      printerWebhook: z.string().default(""),
      reviewDelayMinutes: z.number().int().positive().default(45),
    })
    .default({}),
  loyalty: z
    .object({ enabled: z.boolean().default(false), pointsPerPound: z.number().default(1) })
    .default({}),
  /**
   * Refer a friend. Both figures are in pounds, matching every other price in
   * this file. The reward is minted as a single-use code for the referrer once
   * the friend's first order is paid for - never on sign-up, or the shop pays
   * for introductions that never buy anything.
   */
  referral: z
    .object({
      enabled: z.boolean().default(false),
      /** Off the friend's first order, when they use the referrer's code. */
      refereeDiscount: z.number().default(5),
      /** The referrer's thank-you, once that first order is paid. */
      referrerReward: z.number().default(5),
      /** Both sides need a basket at least this big. */
      minOrder: z.number().default(15),
      /** Days the referrer's reward code stays live. */
      rewardExpiryDays: z.number().default(90),
    })
    .default({}),
});

export type ClientConfig = z.infer<typeof ClientSchema>;
export type LocationConfig = z.infer<typeof LocationSchema>;

// ---------- Menu ----------

export const MenuCategorySchema = z.object({
  slug,
  name: z.string().min(1),
  description: z.string().default(""),
  image: z.string().default(""),
});

export const ModifierOptionSchema = z.object({
  id: slug,
  name: z.string().min(1),
  price: money.default(0),
});

export const ModifierGroupSchema = z.object({
  id: slug,
  name: z.string().min(1),
  min: z.number().int().nonnegative().default(0),
  max: z.number().int().positive().default(10),
  options: z.array(ModifierOptionSchema).min(1),
});

export const ProductSizeSchema = z.object({
  id: slug,
  name: z.string().min(1),
  price: money,
});

export const MenuProductSchema = z.object({
  slug,
  category: slug,
  name: z.string().min(1),
  description: z.string().default(""),
  /** The few appetising lines on the item's own page. `description` stays the
   *  short ingredient line the cards, search and the deal picker show. */
  story: z.string().default(""),
  image: z.string().default(""),
  price: money.optional(), // shorthand for a single "regular" size
  sizes: z.array(ProductSizeSchema).default([]),
  modifierGroups: z.array(slug).default([]),
  tags: z.array(z.string()).default([]),
  allergens: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  soldOut: z.boolean().default(false),
});

export const DealSlotSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().positive().default(1),
  categories: z.array(slug).default([]),
  products: z.array(slug).default([]),
  sizes: z.array(slug).default([]),
});

export const MenuDealSchema = z.object({
  slug,
  name: z.string().min(1),
  description: z.string().default(""),
  image: z.string().default(""),
  price: money,
  featured: z.boolean().default(false),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  fulfilment: z.array(z.enum(["delivery", "collection"])).default([]),
  slots: z.array(DealSlotSchema).min(1),
});

export const PromoSchema = z.object({
  code: z.string().min(2).transform((s) => s.toUpperCase()),
  type: z.enum(["percent", "fixed", "free_delivery"]),
  value: z.number().nonnegative().default(0),
  minOrder: money.default(0),
  fulfilment: z.array(z.enum(["delivery", "collection"])).default([]),
  firstOrderOnly: z.boolean().default(false),
  maxUses: z.number().int().positive().optional(),
  endsAt: z.string().optional(),
});

export const MenuSchema = z.object({
  categories: z.array(MenuCategorySchema).min(1),
  modifierGroups: z.array(ModifierGroupSchema).default([]),
  products: z.array(MenuProductSchema).min(1),
  deals: z.array(MenuDealSchema).default([]),
  promos: z.array(PromoSchema).default([]),
});

export type MenuConfig = z.infer<typeof MenuSchema>;
export type MenuProduct = z.infer<typeof MenuProductSchema>;
export type MenuDeal = z.infer<typeof MenuDealSchema>;

/** Cross-reference validation beyond what zod can express. Returns human-readable errors. */
export function validateMenuRefs(menu: MenuConfig): string[] {
  const errors: string[] = [];
  const cats = new Set(menu.categories.map((c) => c.slug));
  const groups = new Set(menu.modifierGroups.map((g) => g.id));
  const products = new Map(menu.products.map((p) => [p.slug, p]));
  const seen = new Set<string>();

  for (const p of menu.products) {
    if (seen.has(p.slug)) errors.push(`product "${p.slug}" is defined twice`);
    seen.add(p.slug);
    if (!cats.has(p.category)) errors.push(`product "${p.slug}" references unknown category "${p.category}"`);
    if (p.price === undefined && p.sizes.length === 0) errors.push(`product "${p.slug}" needs either "price" or "sizes"`);
    for (const g of p.modifierGroups) if (!groups.has(g)) errors.push(`product "${p.slug}" references unknown modifierGroup "${g}"`);
    const sizeIds = new Set<string>();
    for (const s of p.sizes) {
      if (sizeIds.has(s.id)) errors.push(`product "${p.slug}" has duplicate size "${s.id}"`);
      sizeIds.add(s.id);
    }
  }
  for (const d of menu.deals) {
    for (const s of d.slots) {
      if (s.categories.length === 0 && s.products.length === 0)
        errors.push(`deal "${d.slug}" slot "${s.name}" needs categories or products`);
      for (const c of s.categories) if (!cats.has(c)) errors.push(`deal "${d.slug}" slot "${s.name}" references unknown category "${c}"`);
      for (const ps of s.products) if (!products.has(ps)) errors.push(`deal "${d.slug}" slot "${s.name}" references unknown product "${ps}"`);
    }
  }
  return errors;
}

export function validateClientRefs(client: ClientConfig): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const l of client.locations) {
    if (ids.has(l.id)) errors.push(`location "${l.id}" is defined twice`);
    ids.add(l.id);
    if (client.fulfilment.includes("delivery") && l.postcodePrefixes.length === 0)
      errors.push(`location "${l.id}" offers delivery but has no postcodePrefixes`);
  }
  return errors;
}

export const toPence = (pounds: number) => Math.round(pounds * 100);
