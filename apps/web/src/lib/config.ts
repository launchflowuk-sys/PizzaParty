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

export const localitySlug = (locality: string) => locality.toLowerCase().replace(/[^a-z0-9]+/g, "-");
export const localityPath = (config: ClientConfig, locality: string) =>
  `/${config.seo.cuisine.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-delivery-${localitySlug(locality)}`;
