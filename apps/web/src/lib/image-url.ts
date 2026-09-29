/**
 * A photograph, sized for a phone.
 *
 * The app used to be handed the original files under /brand/ - 100 to 700KB
 * each, up to 1200px wide - and draw them into 60-100pt thumbnails. Pizza
 * Party's menu alone was 22MB of images. The same file through Next's own
 * optimiser at w=256 is 8-10KB, cached for a year (see `images` in
 * next.config.ts, and scripts/warm-images.sh which pre-encodes every width).
 *
 * Widths must be ones next.config.ts allows (deviceSizes + imageSizes); any
 * other width is a 400. Quality 75 matches what the warm script encodes.
 *
 * Only raster files on this server go through it. SVGs are not optimisable,
 * and anything on another origin would be refused by the optimiser.
 */
export type AppImageWidth = 256 | 414 | 828 | 1200;

const RASTER = /\.(jpe?g|png|webp|avif)$/i;

export function optimisedImageUrl(siteUrl: string, path: string, width: AppImageWidth): string {
  if (!path) return "";
  const local = path.startsWith(siteUrl + "/") ? path.slice(siteUrl.length) : path;
  if (/^https?:\/\//.test(local)) return local;
  if (!RASTER.test(local)) return siteUrl + local;
  return `${siteUrl}/_next/image?url=${encodeURIComponent(local)}&w=${width}&q=75`;
}
