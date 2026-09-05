import "server-only";
import type { Promo } from "@launchflow/db";

/**
 * Only the parts of a promo that affect a price.
 *
 * Narrower than the database row on purpose: a referral code is priced through
 * exactly the same rules without having to be a Promo record first, and pricing
 * stays a pure function of the offer rather than of where it was stored.
 */
export type PricingPromo = Pick<
  Promo,
  "code" | "type" | "value" | "minOrder" | "fulfilment" | "startsAt" | "endsAt" | "maxUses" | "uses" | "firstOrderOnly" | "active"
>;
import type { Menu, MenuProduct } from "./menu";
import { findProduct } from "./menu";
import type { BasketLine, BasketModifier, Fulfilment, PricedBasket, PricedLine } from "./basket-types";

type Ctx = {
  fulfilment: Fulfilment;
  deliveryFee: number;
  minOrder: number;
  promo?: PricingPromo | null;
  isFirstOrder?: boolean;
  now?: Date;
};

type ModRes = { groupName: string; name: string; price: number };

function resolveModifiers(product: MenuProduct, mods: BasketModifier[] | undefined, errors: string[], label: string): ModRes[] | null {
  const out: ModRes[] = [];
  const groups = product.modifierGroups.map((pg) => pg.group);
  const counts = new Map<string, number>();
  for (const m of mods ?? []) {
    const g = groups.find((g) => g.key === m.group);
    if (!g) { errors.push(`${label}: option group "${m.group}" is not available`); return null; }
    const opt = g.modifiers.find((o) => o.key === m.modifier);
    if (!opt) { errors.push(`${label}: option "${m.modifier}" is not available`); return null; }
    if (opt.soldOut) { errors.push(`${label}: ${opt.name} is sold out`); return null; }
    counts.set(g.key, (counts.get(g.key) ?? 0) + 1);
    out.push({ groupName: g.name, name: opt.name, price: opt.price });
  }
  for (const g of groups) {
    const n = counts.get(g.key) ?? 0;
    if (n < g.minSelect) { errors.push(`${label}: choose ${g.name.toLowerCase()}`); return null; }
    if (n > g.maxSelect) { errors.push(`${label}: max ${g.maxSelect} ${g.name.toLowerCase()}`); return null; }
  }
  return out;
}

/**
 * Server-side recompute of every basket line from the cached menu.
 * Lines that no longer resolve are dropped and reported in `removedKeys`.
 */
export function priceBasket(menu: Menu, lines: BasketLine[], ctx: Ctx): PricedBasket {
  const errors: string[] = [];
  const removedKeys: string[] = [];
  const priced: PricedLine[] = [];
  const now = ctx.now ?? new Date();

  for (const line of lines) {
    const qty = Math.max(1, Math.min(20, Math.floor(Number(line.qty) || 1)));
    if (line.kind === "product") {
      const hit = line.product ? findProduct(menu, line.product) : null;
      if (!hit) { removedKeys.push(line.key); errors.push(`An item is no longer on the menu and was removed.`); continue; }
      const { product } = hit;
      if (product.soldOut) { removedKeys.push(line.key); errors.push(`${product.name} is sold out and was removed.`); continue; }
      const size = product.sizes.find((s) => s.key === (line.size ?? "regular")) ?? (product.sizes.length === 1 ? product.sizes[0] : undefined);
      if (!size || size.soldOut) { removedKeys.push(line.key); errors.push(`${product.name}: that size is unavailable and was removed.`); continue; }
      const mods = resolveModifiers(product, line.modifiers, errors, product.name);
      if (!mods) { removedKeys.push(line.key); continue; }
      const unit = size.price + mods.reduce((a, m) => a + m.price, 0);
      priced.push({
        key: line.key, kind: "product", name: product.name,
        detail: [product.sizes.length > 1 ? size.name : "", ...mods.map((m) => m.name)].filter(Boolean).join(", "),
        qty, unitPrice: unit, lineTotal: unit * qty, productId: product.id, sizeKey: size.key, sizeName: size.name,
        modifiers: mods, components: [], notes: (line.notes ?? "").slice(0, 200),
      });
    } else {
      const deal = line.deal ? menu.deals.find((d) => d.slug === line.deal) : null;
      if (!deal) { removedKeys.push(line.key); errors.push(`A deal is no longer available and was removed.`); continue; }
      if (deal.daysOfWeek.length && !deal.daysOfWeek.includes(now.getDay())) { removedKeys.push(line.key); errors.push(`${deal.name} is not available today and was removed.`); continue; }
      if (deal.fulfilment.length && !deal.fulfilment.includes(ctx.fulfilment)) { removedKeys.push(line.key); errors.push(`${deal.name} is only for ${deal.fulfilment.join("/")} and was removed.`); continue; }
      const comps: PricedLine["components"] = [];
      let extra = 0;
      let ok = true;
      for (const [i, slot] of deal.slots.entries()) {
        const picks = (line.components ?? []).filter((c) => c.slot === i);
        if (picks.length !== slot.qty) { errors.push(`${deal.name}: choose ${slot.qty} × ${slot.name}`); ok = false; break; }
        for (const pick of picks) {
          const hit = findProduct(menu, pick.product);
          if (!hit || hit.product.soldOut) { errors.push(`${deal.name}: ${pick.product} is unavailable`); ok = false; break; }
          const { product, category } = hit;
          const allowed = (slot.productSlugs.length ? slot.productSlugs.includes(product.slug) : true) &&
            (slot.categorySlugs.length ? slot.categorySlugs.includes(category.slug) : true);
          if (!allowed) { errors.push(`${deal.name}: ${product.name} is not allowed for ${slot.name}`); ok = false; break; }
          const size = product.sizes.find((s) => s.key === pick.size) ?? (product.sizes.length === 1 ? product.sizes[0] : undefined);
          if (!size || size.soldOut) { errors.push(`${deal.name}: size unavailable for ${product.name}`); ok = false; break; }
          if (slot.sizeKeys.length && !slot.sizeKeys.includes(size.key)) { errors.push(`${deal.name}: ${size.name} is not allowed for ${slot.name}`); ok = false; break; }
          const mods = resolveModifiers(product, pick.modifiers, errors, `${deal.name} – ${product.name}`);
          if (!mods) { ok = false; break; }
          extra += mods.reduce((a, m) => a + m.price, 0);
          // A premium item inside a deal costs the shop more to make, so it may
          // carry a supplement - "any 10 inch pizza, Meat Machine +£2". Without
          // it every customer rationally picks the dearest thing the line allows
          // and the shop carries the difference on every order.
          extra += slot.supplements.find((sup) => sup.productSlug === product.slug)?.extra ?? 0;
          comps.push({ productId: product.id, name: product.name, sizeKey: size.key, sizeName: product.sizes.length > 1 ? size.name : "", modifiers: mods });
        }
        if (!ok) break;
      }
      if (!ok) { removedKeys.push(line.key); continue; }
      const unit = deal.price + extra;
      priced.push({
        key: line.key, kind: "deal", name: deal.name, detail: comps.map((c) => c.name + (c.modifiers.length ? ` (+${c.modifiers.map((m) => m.name).join(", ")})` : "")).join(", "),
        qty, unitPrice: unit, lineTotal: unit * qty, dealId: deal.id, sizeKey: "", sizeName: "", modifiers: [], components: comps,
        notes: (line.notes ?? "").slice(0, 200),
      });
    }
  }

  const subtotal = priced.reduce((a, l) => a + l.lineTotal, 0);
  const deliveryFee = ctx.fulfilment === "delivery" ? ctx.deliveryFee : 0;
  let discount = 0;
  let promoCode = "";
  let promoMessage = "";

  if (ctx.promo) {
    const p = ctx.promo;
    const problems: string[] = [];
    if (!p.active) problems.push("This code is no longer active.");
    if (p.startsAt && p.startsAt > now) problems.push("This code is not active yet.");
    if (p.endsAt && p.endsAt < now) problems.push("This code has expired.");
    if (p.maxUses != null && p.uses >= p.maxUses) problems.push("This code has been fully redeemed.");
    if (p.fulfilment.length && !p.fulfilment.includes(ctx.fulfilment)) problems.push(`This code is for ${p.fulfilment.join("/")} only.`);
    if (subtotal < p.minOrder) problems.push(`Spend £${(p.minOrder / 100).toFixed(2)} to use this code.`);
    if (p.firstOrderOnly && ctx.isFirstOrder === false) problems.push("This code is for first orders only.");
    if (problems.length) promoMessage = problems[0]!;
    else {
      promoCode = p.code;
      if (p.type === "percent") discount = Math.round((subtotal * p.value) / 100);
      else if (p.type === "fixed") discount = Math.min(subtotal, p.value);
      else if (p.type === "free_delivery") { discount = deliveryFee; }
      promoMessage = p.type === "free_delivery" ? "Free delivery applied" : `${p.code} applied`;
    }
  }

  if (ctx.fulfilment === "delivery" && subtotal > 0 && subtotal < ctx.minOrder)
    errors.push(`Minimum order for delivery is £${(ctx.minOrder / 100).toFixed(2)}.`);

  const total = Math.max(0, subtotal + deliveryFee - discount);
  return { lines: priced, subtotal, deliveryFee, discount, total, promoCode, promoMessage, errors, removedKeys };
}
