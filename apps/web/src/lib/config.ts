import "server-only";
import { loadClientConfig, loadMenuConfig, loadLocalityCopy, type ClientConfig, type MenuConfig } from "@launchflow/config";
import { env } from "./env";

let clientCache: ClientConfig | null = null;
let menuCache: MenuConfig | null = null;

/** Client config from /config/<CLIENT_SLUG>/client.json. Loaded once per process; /admin/launchflow can reload. */
export function getConfig(): ClientConfig {
  if (!clientCache) clientCache = loadClientConfig(env.clientSlug);
  return clientCache;
}

export function getMenuConfig(): MenuConfig {
  if (!menuCache) menuCache = loadMenuConfig(env.clientSlug);
  return menuCache;
}

export function reloadConfig(): ClientConfig {
  clientCache = null;
  menuCache = null;
  return getConfig();
}

export function localityCopy(locality: string): string | null {
  return loadLocalityCopy(env.clientSlug, locality);
}

/** Map a config asset path ("assets/logo.svg") to its public URL. Served by /brand/[...path]. */
export function assetUrl(rel: string): string {
  if (!rel) return "";
  if (/^https?:\/\//.test(rel) || rel.startsWith("/")) return rel;
  return "/brand/" + rel.replace(/^assets\//, "");
}

/**
 * The same asset, but reachable from a phone.
 *
 * `assetUrl` returns a site-relative path, which is right for markup the
 * browser resolves against its own origin and useless in a JSON payload: a
 * native app has no origin, so `/brand/products/original.jpg` resolves to
 * nothing and every product photo silently renders as an empty grey box.
 *
 * Anything the app reads - the menu, the deals, the bootstrap config - must go
 * through this one instead.
 */
export function absoluteAssetUrl(rel: string): string {
  const url = assetUrl(rel);
  if (!url || /^https?:\/\//.test(url)) return url;
  return env.siteUrl + url;
}

export const localitySlug = (locality: string) => locality.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const localityPath = (config: ClientConfig, locality: string) =>
  `/${config.seo.cuisine.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-delivery-${localitySlug(locality)}`;
