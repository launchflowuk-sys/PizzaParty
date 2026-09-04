import type { Metadata, Viewport } from "next";
import "./globals.css";
import { contrastInk } from "@launchflow/ui";
import { getConfig, assetUrl, localityPath } from "@/lib/config";
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

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = getConfig();
  const style = {
    "--brand-primary": cfg.brand.primary,
    "--brand-primary-ink": contrastInk(cfg.brand.primary),
    "--brand-secondary": cfg.brand.secondary,
  } as React.CSSProperties;
  return (
    <html lang="en-GB" style={style}>
      <body className="min-h-dvh flex flex-col">
        <Header name={cfg.name} logo={assetUrl(cfg.brand.logo)} phone={cfg.contact.phone} />
        <main className="flex-1 pb-24">{children}</main>
        <Footer name={cfg.name} phone={cfg.contact.phone} address={cfg.contact.address} localities={cfg.seo.locality.map((l) => ({ name: l, path: localityPath(cfg, l) }))} />
        <StickyBar />
      </body>
    </html>
  );
}
