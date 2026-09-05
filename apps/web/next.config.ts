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
   * These cover what the layouts actually request: a card thumbnail, a phone,
   * a tablet, and the largest the photographs actually are. `minimumCacheTTL`
   * keeps what has been encoded for a year rather than the default hour.
   *
   * 1920 used to be in this list and was pure waste. No source photograph is
   * wider than 1200, and Next never upscales - so w=1920 and w=1200 returned
   * byte-identical files (143942 bytes each, measured), while costing a second
   * three-second AVIF encode and a second cache entry. Every product page was
   * paying for the same image twice.
   *
   * Adding a photograph wider than 1200 means adding the width back here, and
   * warming it - see scripts/warm-images.sh.
   */
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [414, 828, 1200],
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
