import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import { Calistoga, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/* Calistoga for headlines, Plus Jakarta Sans for everything else. Both are
   self-hosted through next/font, so there is no render-blocking Google Fonts
   request and the Lighthouse score survives the change of family.
   Calistoga ships one weight only - it is a display face and does not need
   more, and asking for weights it lacks would silently synthesise them. */
const display = Calistoga({ subsets: ["latin"], weight: ["400"], variable: "--font-display", display: "swap" });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });
import { contrastInk } from "@launchflow/ui";
import { getConfig, assetUrl, localityPath } from "@/lib/config";
import { paymentMarks } from "@/lib/payments";
import { env } from "@/lib/env";
import { fill, seoVars } from "@/lib/seo";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StickyBar } from "@/components/basket/StickyBar";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  const vars = seoVars(cfg);
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: fill(cfg.seo.homeTitle, vars), template: fill(cfg.seo.titleTemplate, { ...vars, page: "%s" }) },
    description: fill(cfg.seo.homeDescription, vars),
    openGraph: { siteName: cfg.name, type: "website", locale: "en_GB", images: [assetUrl(cfg.brand.og)] },
    twitter: { card: "summary_large_image" },
    icons: { icon: assetUrl(cfg.brand.logo) },
    alternates: { canonical: "/" },
  };
}

export const viewport: Viewport = { themeColor: "#f3f2f2", width: "device-width", initialScale: 1, viewportFit: "cover" };

/**
 * Screens that are not the shop.
 *
 * The back office and the kitchen have their own chrome and their own way out.
 * Wrapping them in the storefront's header, footer and basket bar put a "Order
 * now" button and a menu of takeaway links on top of the till - which on a
 * phone pushed the actual controls off the screen entirely.
 */
const OPS = ["/admin", "/kitchen"];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by middleware; layouts are not given the URL they render.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isOps = OPS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const cfg = getConfig();
  const style = {
    "--brand-primary": cfg.brand.primary,
    "--brand-primary-ink": contrastInk(cfg.brand.primary),
    "--brand-secondary": cfg.brand.secondary,
  } as React.CSSProperties;
  return (
    <html lang="en-GB" className={`${display.variable} ${sans.variable}`} style={style} data-photo={cfg.brand.photoStyle}>
      <body style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        {isOps ? null : <Header name={cfg.name} logo={assetUrl(cfg.brand.logo)} fulfilment={cfg.fulfilment} loyalty={cfg.loyalty.enabled} />}
        <main style={{ flex: 1 }}>{children}</main>
        {isOps ? null : <Footer
          name={cfg.name}
          phone={cfg.contact.phone}
          address={cfg.contact.address}
          localities={cfg.seo.locality.map((l) => ({ name: l, path: localityPath(cfg, l) }))}
          loyalty={cfg.loyalty.enabled}
          logo={assetUrl(cfg.brand.logo)}
          payments={paymentMarks()}
        />}
        {isOps ? null : <StickyBar />}
      </body>
    </html>
  );
}
