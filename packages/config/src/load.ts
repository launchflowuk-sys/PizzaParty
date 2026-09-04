import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ClientSchema, MenuSchema, validateClientRefs, validateMenuRefs, type ClientConfig, type MenuConfig } from "./schema";
import { productsFromCsv } from "./csv";

export class ConfigError extends Error {
  constructor(message: string, public readonly issues: string[] = []) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Resolve the /config directory: env CONFIG_DIR, else walk up from cwd looking for config/_schema. */
export function configRoot(): string {
  if (process.env.CONFIG_DIR) return resolve(process.env.CONFIG_DIR);
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "config");
    if (existsSync(join(candidate, "_schema"))) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), "config");
}

export function clientDir(slug: string): string {
  return join(configRoot(), slug);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new ConfigError(`Cannot read ${path}: ${(e as Error).message}`);
  }
}

function zodIssues(prefix: string, err: { issues: { path: (string | number)[]; message: string }[] }): string[] {
  return err.issues.map((i) => `${prefix}${i.path.length ? " " + i.path.join(".") : ""}: ${i.message}`);
}

export function loadClientConfig(slug: string): ClientConfig {
  const path = join(clientDir(slug), "client.json");
  if (!existsSync(path)) throw new ConfigError(`No client config at ${path}`);
  const parsed = ClientSchema.safeParse(readJson(path));
  if (!parsed.success) throw new ConfigError(`client.json invalid`, zodIssues("client.json", parsed.error));
  if (parsed.data.slug !== slug) throw new ConfigError(`client.json slug "${parsed.data.slug}" does not match folder "${slug}"`);
  const refs = validateClientRefs(parsed.data);
  if (refs.length) throw new ConfigError(`client.json invalid`, refs);
  return parsed.data;
}

/**
 * Loads menu.json, then merges any CSV files in the client folder:
 *  - products.csv → products (+ inferred categories)
 * CSV products override JSON products with the same slug.
 */
export function loadMenuConfig(slug: string): MenuConfig {
  const dir = clientDir(slug);
  const jsonPath = join(dir, "menu.json");
  const raw: unknown = existsSync(jsonPath) ? readJson(jsonPath) : { categories: [], products: [] };
  const base = raw as Record<string, unknown>;
  const csvPath = join(dir, "products.csv");
  if (existsSync(csvPath)) {
    const { products, categories, errors } = productsFromCsv(readFileSync(csvPath, "utf8"));
    if (errors.length) throw new ConfigError(`products.csv invalid`, errors);
    const jsonCats = (base.categories as { slug: string }[] | undefined) ?? [];
    const jsonProducts = (base.products as { slug: string }[] | undefined) ?? [];
    const catSlugs = new Set(jsonCats.map((c) => c.slug));
    const csvSlugs = new Set(products.map((p) => p.slug));
    base.categories = [...jsonCats, ...categories.filter((c) => !catSlugs.has(c.slug))];
    base.products = [...jsonProducts.filter((p) => !csvSlugs.has(p.slug)), ...products];
  }
  const parsed = MenuSchema.safeParse(base);
  if (!parsed.success) throw new ConfigError(`menu.json invalid`, zodIssues("menu.json", parsed.error));
  // normalise price shorthand → sizes
  for (const p of parsed.data.products) {
    if (p.sizes.length === 0 && p.price !== undefined) p.sizes = [{ id: "regular", name: "Regular", price: p.price }];
  }
  const refs = validateMenuRefs(parsed.data);
  if (refs.length) throw new ConfigError(`menu invalid`, refs);
  return parsed.data;
}

/** Per-locality markdown copy for location landing pages. */
export function loadLocalityCopy(slug: string, locality: string): string | null {
  const key = locality.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const path = join(clientDir(slug), "copy", `${key}.md`);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function listClientSlugs(): string[] {
  const root = configRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(join(root, d.name, "client.json")))
    .map((d) => d.name);
}
