/**
 * Seed a client from /config/<slug> into the database. Idempotent (upserts by slug/key).
 * Used by scripts/seed-client.ts (CLI), docker entrypoint, and /admin/launchflow "reseed".
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "./index";
import { clientDir, dayKeys, loadClientConfig, loadMenuConfig, toPence, type ClientConfig } from "@launchflow/config";

function hashConfig(slug: string): string {
  const h = createHash("sha256");
  for (const f of ["client.json", "menu.json"]) {
    try { h.update(readFileSync(join(clientDir(slug), f))); } catch { /* optional */ }
  }
  return h.digest("hex").slice(0, 16);
}

function hoursRows(hours: ClientConfig["locations"][number]["hours"]) {
  const rows: { dayOfWeek: number; opens: string; closes: string }[] = [];
  dayKeys.forEach((key, i) => {
    const dow = (i + 1) % 7; // mon=1 ... sun=0
    const v = hours[key];
    if (!v || v.length === 0) return;
    const ranges = Array.isArray(v[0]) ? (v as [string, string][]) : [v as [string, string]];
    for (const [opens, closes] of ranges) rows.push({ dayOfWeek: dow, opens, closes });
  });
  return rows;
}

export async function seedClient(slug: string, opts: { reset?: boolean } = {}) {
  const client = loadClientConfig(slug);
  const menu = loadMenuConfig(slug);
  const configHash = hashConfig(slug);

  const c = await prisma.client.upsert({
    where: { slug },
    create: clientData(client, configHash),
    update: clientData(client, configHash),
  });

  // Locations + hours
  for (const [i, l] of client.locations.entries()) {
    const loc = await prisma.location.upsert({
      where: { clientId_key: { clientId: c.id, key: l.id } },
      create: { clientId: c.id, key: l.id, ...locationData(l, i) },
      update: locationData(l, i),
    });
    await prisma.openingHours.deleteMany({ where: { locationId: loc.id } });
    const rows = hoursRows(l.hours);
    if (rows.length) await prisma.openingHours.createMany({ data: rows.map((r) => ({ ...r, locationId: loc.id })) });
  }
  if (opts.reset) {
    await prisma.location.updateMany({
      where: { clientId: c.id, key: { notIn: client.locations.map((l) => l.id) } },
      data: { active: false },
    });
  }

  // Categories
  const catIds = new Map<string, string>();
  for (const [i, cat] of menu.categories.entries()) {
    const row = await prisma.category.upsert({
      where: { clientId_slug: { clientId: c.id, slug: cat.slug } },
      create: { clientId: c.id, slug: cat.slug, name: cat.name, description: cat.description, image: cat.image, sortOrder: i, active: true },
      update: { name: cat.name, description: cat.description, image: cat.image, sortOrder: i, active: true },
    });
    catIds.set(cat.slug, row.id);
  }

  // Modifier groups
  const groupIds = new Map<string, string>();
  for (const g of menu.modifierGroups) {
    const row = await prisma.modifierGroup.upsert({
      where: { clientId_key: { clientId: c.id, key: g.id } },
      create: { clientId: c.id, key: g.id, name: g.name, minSelect: g.min, maxSelect: g.max, required: g.min > 0 },
      update: { name: g.name, minSelect: g.min, maxSelect: g.max, required: g.min > 0 },
    });
    groupIds.set(g.id, row.id);
    for (const [i, o] of g.options.entries()) {
      await prisma.modifier.upsert({
        where: { groupId_key: { groupId: row.id, key: o.id } },
        create: { groupId: row.id, key: o.id, name: o.name, price: toPence(o.price), sortOrder: i },
        update: { name: o.name, price: toPence(o.price), sortOrder: i },
      });
    }
    await prisma.modifier.deleteMany({ where: { groupId: row.id, key: { notIn: g.options.map((o) => o.id) } } });
  }

  // Products
  for (const [i, p] of menu.products.entries()) {
    const categoryId = catIds.get(p.category)!;
    const data = {
      categoryId, name: p.name, description: p.description, image: p.image, tags: p.tags, allergens: p.allergens,
      featured: p.featured, sortOrder: i, active: true, soldOut: p.soldOut,
    };
    const row = await prisma.product.upsert({
      where: { clientId_slug: { clientId: c.id, slug: p.slug } },
      create: { clientId: c.id, slug: p.slug, ...data },
      update: data,
    });
    for (const [si, s] of p.sizes.entries()) {
      await prisma.productSize.upsert({
        where: { productId_key: { productId: row.id, key: s.id } },
        create: { productId: row.id, key: s.id, name: s.name, price: toPence(s.price), sortOrder: si },
        update: { name: s.name, price: toPence(s.price), sortOrder: si },
      });
    }
    await prisma.productSize.deleteMany({ where: { productId: row.id, key: { notIn: p.sizes.map((s) => s.id) } } });
    await prisma.productModifierGroup.deleteMany({ where: { productId: row.id } });
    if (p.modifierGroups.length) {
      await prisma.productModifierGroup.createMany({
        data: p.modifierGroups.map((g, gi) => ({ productId: row.id, groupId: groupIds.get(g)!, sortOrder: gi })),
      });
    }
  }
  if (opts.reset) {
    await prisma.product.updateMany({ where: { clientId: c.id, slug: { notIn: menu.products.map((p) => p.slug) } }, data: { active: false } });
    await prisma.category.updateMany({ where: { clientId: c.id, slug: { notIn: menu.categories.map((p) => p.slug) } }, data: { active: false } });
  }

  // Deals
  for (const [i, d] of menu.deals.entries()) {
    const data = {
      name: d.name, description: d.description, image: d.image, price: toPence(d.price), featured: d.featured,
      sortOrder: i, active: true, daysOfWeek: d.daysOfWeek, fulfilment: d.fulfilment,
    };
    const row = await prisma.deal.upsert({
      where: { clientId_slug: { clientId: c.id, slug: d.slug } },
      create: { clientId: c.id, slug: d.slug, ...data },
      update: data,
    });
    await prisma.dealSlot.deleteMany({ where: { dealId: row.id } });
    await prisma.dealSlot.createMany({
      data: d.slots.map((s, si) => ({
        dealId: row.id, name: s.name, qty: s.qty, categorySlugs: s.categories, productSlugs: s.products, sizeKeys: s.sizes, sortOrder: si,
      })),
    });
  }
  if (opts.reset) {
    await prisma.deal.updateMany({ where: { clientId: c.id, slug: { notIn: menu.deals.map((d) => d.slug) } }, data: { active: false } });
  }

  // Promos (config-defined ones; admin-created ones are left alone)
  for (const p of menu.promos) {
    const data = {
      type: p.type, value: p.type === "fixed" ? toPence(p.value) : Math.round(p.value), minOrder: toPence(p.minOrder),
      fulfilment: p.fulfilment, firstOrderOnly: p.firstOrderOnly, maxUses: p.maxUses ?? null,
      endsAt: p.endsAt ? new Date(p.endsAt) : null, active: true,
    };
    await prisma.promo.upsert({
      where: { clientId_code: { clientId: c.id, code: p.code } },
      create: { clientId: c.id, code: p.code, ...data },
      update: data,
    });
  }

  return { clientId: c.id, configHash, counts: { locations: client.locations.length, categories: menu.categories.length, products: menu.products.length, deals: menu.deals.length, promos: menu.promos.length } };
}

function clientData(c: ClientConfig, configHash: string) {
  return {
    slug: c.slug, name: c.name, domain: c.domain, legacyDomains: c.legacyDomains,
    brandPrimary: c.brand.primary, brandSecondary: c.brand.secondary, logo: c.brand.logo,
    phone: c.contact.phone, email: c.contact.email, address: c.contact.address, reviewUrl: c.contact.reviewUrl,
    fulfilment: c.fulfilment, stripeAccountId: c.payments.stripeAccountId,
    cashOnCollection: c.payments.cashOnCollection, cashOnDelivery: c.payments.cashOnDelivery,
    seoLocality: c.seo.locality, seoCuisine: c.seo.cuisine, seoPrimaryKeyword: c.seo.primaryKeyword,
    kitchenEmail: c.notifications.kitchenEmail, kitchenSms: c.notifications.kitchenSms, printerWebhook: c.notifications.printerWebhook,
    configHash,
  };
}

function locationData(l: ClientConfig["locations"][number], sortOrder: number) {
  return {
    name: l.name, address: l.address, phone: l.phone, lat: l.lat ?? null, lng: l.lng ?? null, timezone: l.timezone,
    postcodePrefixes: l.postcodePrefixes.map((p) => p.toUpperCase().replace(/\s+/g, "")),
    deliveryFee: toPence(l.deliveryFee), minOrder: toPence(l.minOrder), prepMinutes: l.prepMinutes, deliveryMinutes: l.deliveryMinutes,
    active: true, sortOrder,
  };
}

