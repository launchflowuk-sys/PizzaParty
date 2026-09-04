import type { MetadataRoute } from "next";
import { getConfig, localityPath } from "@/lib/config";
import { getMenu, productPath } from "@/lib/menu";
import { abs } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cfg = getConfig();
  const menu = await getMenu();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: abs("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: abs("/menu"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: abs("/deals"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...cfg.seo.locality.map((l) => ({ url: abs(localityPath(cfg, l)), lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...["/contact", "/allergens", "/privacy", "/terms"].map((p) => ({ url: abs(p), lastModified: now, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
  for (const c of menu.categories) {
    entries.push({ url: abs(`/menu/${c.slug}`), lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    for (const p of c.products) entries.push({ url: abs(productPath(c, p)), lastModified: now, changeFrequency: "weekly", priority: 0.6 });
  }
  for (const d of menu.deals) entries.push({ url: abs(`/deals/${d.slug}`), lastModified: now, changeFrequency: "weekly", priority: 0.7 });
  return entries;
}
