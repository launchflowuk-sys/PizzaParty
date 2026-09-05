import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { configRoot, clientDir } from "@launchflow/config";
import { can, type Screen, type StaffRole } from "./permissions";
import { getConfig } from "./config";
import { env } from "./env";

/**
 * The help centre.
 *
 * Articles are markdown on disk rather than rows in the database, because 90%
 * of this is about the software and is byte-identical for every tenant. The
 * per-shop 10% - who to ring, where the spare tablet lives - lives in the
 * client folder and is layered on top.
 *
 * Filtering happens here, on the server. A driver's help never reaches their
 * browser at all, so the search index in the client bundle cannot leak a
 * manager-only topic to somebody who should not see it.
 */

export type HelpKind = "guide" | "runbook" | "reference";

export type HelpMeta = {
  id: string;
  title: string;
  summary: string;
  kind: HelpKind;
  screens: Screen[];
  roles: StaffRole[];
  keywords: string[];
  requires: string[];
  updated: string;
};

export type HelpArticle = HelpMeta & { body: string; headings: { id: string; text: string }[] };
export type HelpIndexEntry = HelpMeta & { headings: { id: string; text: string }[] };

/**
 * Where the articles are.
 *
 * CONFIG_DIR points at /app/config in the image, and content/ is its sibling
 * rather than its child, so it cannot be found by walking down from there.
 * Hence its own variable, with the sibling as the fallback.
 */
function contentRoot(): string {
  const explicit = (process.env.CONTENT_DIR ?? "").trim();
  if (explicit) return explicit;
  return resolve(configRoot(), "..", "content");
}

const helpDir = () => join(contentRoot(), "help");
const tenantHelpDir = () => join(clientDir(env.clientSlug), "help");

/* ── Frontmatter ─────────────────────────────────────────────────────────── */

/**
 * A deliberately small parser: `key: value` and `key: [a, b, c]`, nothing else.
 *
 * Nesting throws rather than being quietly dropped, because an article that
 * silently loses its `requires` gate would advertise a feature the shop has
 * not got - which is worse than the page failing to load.
 */
function parseFrontmatter(raw: string, file: string): { meta: Record<string, string | string[]>; body: string } {
  if (!raw.startsWith("---")) throw new Error(`${file}: missing frontmatter`);
  const end = raw.indexOf("\n---", 3);
  if (end === -1) throw new Error(`${file}: unterminated frontmatter`);

  const head = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\r?\n/, "");
  const meta: Record<string, string | string[]> = {};

  for (const line of head.split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    if (/^\s+\S/.test(line) && !line.trimStart().startsWith("-")) {
      throw new Error(`${file}: nested frontmatter is not supported (${text})`);
    }
    const colon = text.indexOf(":");
    if (colon === -1) throw new Error(`${file}: cannot read frontmatter line "${text}"`);

    const key = text.slice(0, colon).trim();
    const value = text.slice(colon + 1).trim();

    if (value.startsWith("[")) {
      meta[key] = value.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      meta[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return { meta, body };
}

const str = (v: string | string[] | undefined, fallback = "") => (typeof v === "string" ? v : fallback);
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** `## Putting a price up` becomes `#putting-a-price-up`, so search can deep-link. */
export const slugifyHeading = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);

function headingsOf(body: string) {
  const out: { id: string; text: string }[] = [];
  for (const m of body.matchAll(/^##\s+(.+)$/gm)) {
    const text = m[1]!.trim();
    out.push({ id: slugifyHeading(text), text });
  }
  return out;
}

/* ── Loading ─────────────────────────────────────────────────────────────── */

type TenantOverrides = { hide: string[]; order: string[]; vars: Record<string, string> };

async function tenantOverrides(): Promise<TenantOverrides> {
  const file = join(tenantHelpDir(), "help.json");
  if (!existsSync(file)) return { hide: [], order: [], vars: {} };
  try {
    const parsed = JSON.parse(await readFile(file, "utf-8")) as Partial<TenantOverrides>;
    return { hide: parsed.hide ?? [], order: parsed.order ?? [], vars: parsed.vars ?? {} };
  } catch {
    // A broken override file must not take the whole help centre down with it.
    console.error("[help] could not read tenant help.json; ignoring it");
    return { hide: [], order: [], vars: {} };
  }
}

async function readArticle(dir: string, filename: string): Promise<HelpArticle | null> {
  const file = join(dir, filename);
  try {
    const raw = await readFile(file, "utf-8");
    const { meta, body } = parseFrontmatter(raw, filename);
    const id = str(meta.id) || filename.replace(/\.md$/, "");
    const kind = str(meta.kind, "guide") as HelpKind;
    return {
      id,
      title: str(meta.title, id),
      summary: str(meta.summary),
      kind: kind === "runbook" || kind === "reference" ? kind : "guide",
      screens: list(meta.screens) as Screen[],
      roles: list(meta.roles) as StaffRole[],
      keywords: list(meta.keywords).map((k) => k.toLowerCase()),
      requires: list(meta.requires),
      updated: str(meta.updated),
      body,
      headings: headingsOf(body),
    };
  } catch (e) {
    console.error(`[help] skipping ${filename}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Every article, baseline then tenant.
 *
 * A tenant file of the same name replaces the baseline outright; a
 * `<id>.append.md` is added to the end of it instead. That covers both real
 * cases - "our refund policy is different" and "also, ring Dave".
 */
async function loadAll(): Promise<HelpArticle[]> {
  const base = helpDir();
  if (!existsSync(base)) return [];

  const files = (await readdir(base)).filter((f) => f.endsWith(".md"));
  const byId = new Map<string, HelpArticle>();
  for (const f of files) {
    const a = await readArticle(base, f);
    if (a) byId.set(a.id, a);
  }

  const tenant = tenantHelpDir();
  if (existsSync(tenant)) {
    const tfiles = (await readdir(tenant)).filter((f) => f.endsWith(".md"));
    for (const f of tfiles.filter((f) => !f.endsWith(".append.md"))) {
      const a = await readArticle(tenant, f);
      if (a) byId.set(a.id, a);
    }
    for (const f of tfiles.filter((f) => f.endsWith(".append.md"))) {
      const id = f.replace(/\.append\.md$/, "");
      const existing = byId.get(id);
      if (!existing) continue;
      const extra = await readFile(join(tenant, f), "utf-8");
      const body = `${existing.body}\n\n${extra.replace(/^---[\s\S]*?\n---\n/, "")}`;
      byId.set(id, { ...existing, body, headings: headingsOf(body) });
    }
  }

  return [...byId.values()];
}

/* ── Visibility ──────────────────────────────────────────────────────────── */

/** Which optional features this deployment actually has. Help must not advertise the rest. */
export function activeGates(isAgency = false): Set<string> {
  const cfg = getConfig();
  const gates = new Set<string>();
  if (cfg.loyalty.enabled) gates.add("loyalty");
  if (cfg.referral.enabled) gates.add("referral");
  if (env.stripeSecretKey) gates.add("stripe");
  if (env.twilioSid && env.twilioToken && env.twilioFrom) gates.add("twilio");
  if (isAgency) gates.add("agency");
  return gates;
}

function visible(a: HelpArticle, role: StaffRole, gates: Set<string>, hidden: string[]): boolean {
  if (hidden.includes(a.id)) return false;
  if (!a.requires.every((g) => gates.has(g))) return false;
  if (a.roles.length && a.roles.includes(role)) return true;
  if (a.screens.length) return a.screens.some((s) => can(role, s));
  return a.roles.length === 0;
}

/** Everything this person is allowed to read, in a sensible order. */
export async function helpFor(role: StaffRole, opts: { isAgency?: boolean } = {}): Promise<HelpArticle[]> {
  const [all, overrides] = await Promise.all([loadAll(), tenantOverrides()]);
  const gates = activeGates(opts.isAgency);
  const allowed = all.filter((a) => visible(a, role, gates, overrides.hide));

  const rank = (a: HelpArticle) => {
    const pinned = overrides.order.indexOf(a.id);
    if (pinned !== -1) return pinned;
    // Runbooks first: when somebody opens help mid-service, it is because
    // something has gone wrong, not because they fancy reading a guide.
    return a.kind === "runbook" ? 1000 : a.kind === "guide" ? 2000 : 3000;
  };
  return allowed.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}

export async function helpArticle(id: string, role: StaffRole, opts: { isAgency?: boolean } = {}) {
  const all = await helpFor(role, opts);
  return all.find((a) => a.id === id) ?? null;
}

/** The index shipped to the browser for search: metadata only, never bodies. */
export function toIndex(articles: HelpArticle[]): HelpIndexEntry[] {
  return articles.map(({ body: _body, ...rest }) => rest);
}

/** Substitute {phone} and {shop} so an article can name the shop's own details. */
export async function helpVars(): Promise<Record<string, string>> {
  const cfg = getConfig();
  const overrides = await tenantOverrides();
  return { shop: cfg.name, phone: cfg.contact.phone, address: cfg.contact.address, ...overrides.vars };
}

export function fillVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);
}
