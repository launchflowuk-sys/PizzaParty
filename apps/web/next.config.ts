import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
  reactStrictMode: true,
  // Disable streamed metadata for every user agent so <title>/<meta>/<link canonical> always land in <head>
  // (Lighthouse, PSI and social scrapers read the initial HTML). Metadata here is cheap: config is in-process, menu is cached.
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  transpilePackages: ["@launchflow/ui", "@launchflow/config", "@launchflow/db"],
  serverExternalPackages: ["@prisma/client", "prisma", "twilio", "resend", "stripe"],
  images: { formats: ["image/avif", "image/webp"], deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920] },
  experimental: { optimizePackageImports: ["@launchflow/ui"] },
  async headers() {
    return [
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      { source: "/kitchen/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
