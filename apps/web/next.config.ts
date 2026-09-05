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
  serverExternalPackages: ["@prisma/client", "prisma", "twilio", "nodemailer", "stripe"],
  /**
   * Fewer widths, on purpose.
   *
   * Every (image, width) pair is encoded on demand the first time it is asked
   * for - around half a second each on a small box - and the result is cached
   * inside the container, so a deploy throws the lot away and the next visitor
   * pays again. Eight widths across fifty-odd product photographs is roughly
   * four hundred encodes waiting to happen.
   *
   * These four cover what the layouts actually request: a card thumbnail, a
   * phone, a tablet, and a full-width hero. `minimumCacheTTL` keeps what has
   * been encoded for a year rather than the default hour.
   */
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [414, 828, 1200, 1920],
    imageSizes: [96, 256],
    minimumCacheTTL: 31536000,
  },
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
