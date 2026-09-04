/**
 * Scaffold /config/<slug> from prompts.
 *   pnpm new-client
 *   pnpm new-client --slug=tandoori-nights --name="Tandoori Nights" --domain=tandoorinights.co.uk --cuisine=Indian --locality="Grays,Tilbury" --primary=#D97706
 */
import { mkdirSync, existsSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { configRoot } from "@launchflow/config";

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=")]; }),
) as Record<string, string>;

const slugify = (s: string) => s.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function main() {
  const rl = createInterface({ input, output });
  const ask = async (key: string, q: string, def = "") => {
    if (args[key] !== undefined) return args[key]!;
    if (!input.isTTY) return def;
    const a = await rl.question(`${q}${def ? ` [${def}]` : ""}: `);
    return a.trim() || def;
  };

  const name = await ask("name", "Business name");
  if (!name) throw new Error("name is required (--name=...)");
  const slug = slugify(await ask("slug", "Slug", slugify(name)));
  const domain = await ask("domain", "Domain", `${slug}.co.uk`);
  const cuisine = await ask("cuisine", "Cuisine (e.g. Pizza, Indian, Chinese)", "Pizza");
  const localityRaw = await ask("locality", "Localities, comma separated", "Grays");
  const primary = await ask("primary", "Brand primary hex", "#C8322B");
  const secondary = await ask("secondary", "Brand secondary hex", "#111318");
  const phone = await ask("phone", "Phone", "");
  const prefixes = await ask("postcodes", "Delivery postcode districts, comma separated (e.g. RM16,RM17)", "");
  const fee = Number(await ask("fee", "Delivery fee (£)", "2.50"));
  const minOrder = Number(await ask("min", "Minimum delivery order (£)", "12"));
  rl.close();

  const localities = localityRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const dir = join(configRoot(), slug);
  if (existsSync(dir)) throw new Error(`${dir} already exists`);
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "copy"), { recursive: true });

  const hours = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, ["16:00", "23:00"]]));
  const client = {
    $schema: "../_schema/client.schema.json",
    slug, name, domain, legacyDomains: [],
    brand: { primary, secondary, logo: "assets/logo.svg", og: "assets/og.svg", hero: "assets/hero.svg", tagline: `${cuisine} delivery in ${localities.join(" & ")}` },
    contact: { phone, email: "", address: "", reviewUrl: "", social: {} },
    locations: localities.map((l, i) => ({
      id: slugify(l), name: l, address: "", phone, timezone: "Europe/London",
      postcodePrefixes: prefixes.split(",").map((p) => p.trim().toUpperCase()).filter(Boolean),
      deliveryFee: fee, minOrder, prepMinutes: 15, deliveryMinutes: 35, hours,
    })),
    fulfilment: ["delivery", "collection"],
    payments: { stripeAccountId: "", cashOnCollection: true, cashOnDelivery: false },
    seo: { locality: localities, cuisine, primaryKeyword: `${cuisine.toLowerCase()} delivery ${localities[0]!.toLowerCase()}` },
    notifications: { kitchenEmail: "", kitchenSms: "", printerWebhook: "", reviewDelayMinutes: 45 },
    loyalty: { enabled: false, pointsPerPound: 1 },
  };
  writeFileSync(join(dir, "client.json"), JSON.stringify(client, null, 2) + "\n");

  const menu = {
    $schema: "../_schema/menu.schema.json",
    categories: [{ slug: "mains", name: "Mains", description: "" }, { slug: "sides", name: "Sides", description: "" }, { slug: "drinks", name: "Drinks", description: "" }],
    modifierGroups: [],
    products: [
      { slug: "example-main", category: "mains", name: "Example Main", description: "Replace me", sizes: [{ id: "regular", name: "Regular", price: 9.5 }], featured: true },
      { slug: "example-side", category: "sides", name: "Example Side", price: 3.5 },
      { slug: "coke-can", category: "drinks", name: "Coca-Cola 330ml", price: 1.2 },
    ],
    deals: [],
    promos: [],
  };
  writeFileSync(join(dir, "menu.json"), JSON.stringify(menu, null, 2) + "\n");

  for (const l of localities) {
    writeFileSync(join(dir, "copy", `${slugify(l)}.md`),
      `## ${cuisine} delivery across ${l}\n\n${name} delivers fresh ${cuisine.toLowerCase()} across ${l}. Order online, pay with Apple Pay, Google Pay or card and track your order live.\n\n## Frequently asked questions\n\n### What is the minimum order?\n£${minOrder.toFixed(2)} for delivery with a £${fee.toFixed(2)} fee. No minimum for collection.\n`);
  }

  const src = join(configRoot(), "farm-pizza", "assets");
  for (const f of ["hero.svg", "og.svg"]) if (existsSync(join(src, f))) copyFileSync(join(src, f), join(dir, "assets", f));
  writeFileSync(join(dir, "assets", "logo.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64" width="240" height="64"><rect x="4" y="8" width="48" height="48" rx="12" fill="${primary}"/><text x="68" y="41" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="800" fill="${secondary}">${name.replace(/&/g, "&amp;")}</text></svg>\n`);
  copyFileSync(join(configRoot(), "farm-pizza", "products.csv.example"), join(dir, "products.csv.example"));

  console.log(`\n✔ Created ${dir}`);
  console.log(`Next:\n  1. Fill menu.json (or drop products.csv)\n  2. pnpm validate-config ${slug}\n  3. New Coolify service with CLIENT_SLUG=${slug}\n  4. pnpm seed ${slug}`);
}

main().catch((e) => { console.error(`✖ ${e.message}`); process.exit(1); });
