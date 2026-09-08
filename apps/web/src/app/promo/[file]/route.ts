import { NextResponse, type NextRequest } from "next/server";
import { slotImage } from "@/lib/promo-slots";

/**
 * A promotional image, straight out of the database.
 *
 * The path carries an extension it does not use - `/promo/<id>.jpg` - because
 * some clients and caches behave better with one, and the real type is whatever
 * the shop uploaded. The id is what matters.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const id = file.replace(/\.(jpe?g|png|webp)$/i, "");

  const img = await slotImage(id);
  if (!img) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(img.bytes), {
    headers: {
      "content-type": img.mime,
      // Short, because a shop that replaces a promotion expects to see the new
      // one. Long enough that a busy evening is not re-reading the same bytes
      // out of Postgres for every customer.
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
