import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/kitchen", "/admin", "/api/", "/basket", "/checkout", "/order/", "/account"] }],
    sitemap: abs("/sitemap.xml"),
  };
}
