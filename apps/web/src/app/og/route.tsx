import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { getMenu, findProduct } from "@/lib/menu";
import { gbpShort } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cfg = getConfig();
  const slug = req.nextUrl.searchParams.get("product");
  let title = cfg.name;
  let sub = `${cfg.seo.cuisine} delivery in ${cfg.seo.locality.join(" & ")}`;
  let price = "";
  if (slug) {
    const hit = findProduct(await getMenu(), slug);
    if (hit) { title = hit.product.name; sub = hit.product.description || `${hit.category.name} · ${cfg.name}`; price = `${hit.product.sizes.length > 1 ? "from " : ""}${gbpShort(Math.min(...hit.product.sizes.map((s) => s.price)))}`; }
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 64, background: cfg.brand.secondary, color: "white", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", right: 64, top: 64, width: 220, height: 220, borderRadius: 999, background: cfg.brand.primary }} />
        <div style={{ fontSize: 28, opacity: 0.8 }}>{`${cfg.name} · Order online`}</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 12 }}>{title}</div>
        <div style={{ fontSize: 30, opacity: 0.85, marginTop: 16 }}>{sub}</div>
        {price ? <div style={{ fontSize: 40, fontWeight: 800, marginTop: 20, color: cfg.brand.primary }}>{price}</div> : null}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
