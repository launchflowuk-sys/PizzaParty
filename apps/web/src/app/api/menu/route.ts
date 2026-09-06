import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getMenu } from "@/lib/menu";
import { assetUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * The menu, as JSON.
 *
 * The website renders the menu on the server, so until now it existed nowhere
 * a native app could reach it - the single biggest gap between this backend
 * and a phone.
 *
 * Three things this deliberately does not do.
 *
 * It does not turn tags into labels. `vegetarian` stays `vegetarian`; the app
 * maps it to a green V exactly as the web does. If the server invented the
 * label, the two ends would disagree the first time a shop adds a tag.
 *
 * It does not flatten a size's sold-out state into the product's. A single
 * size can be off while the rest of the product is on, and an app that only
 * reads the product-level flag will happily let somebody order a 20" that
 * pricing then rejects at checkout.
 *
 * It does not read config. Prices come from the database in pence, because the
 * shop owns its menu after the first seed and the config file is only ever the
 * starting point.
 */

type SizeOut = { key: string; name: string; price: number; soldOut: boolean };
type ModifierOut = { key: string; name: string; price: number; soldOut: boolean };

export async function GET(req: NextRequest) {
  const menu = await getMenu();

  const categories = menu.categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description || undefined,
    image: c.image ? assetUrl(c.image) : null,
    count: c.products.length,
    products: c.products.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description || "",
      story: p.story || undefined,
      // Resolved here so the app never has to know how assets are served.
      image: p.image ? assetUrl(p.image) : null,
      tags: p.tags,
      allergens: p.allergens,
      soldOut: p.soldOut,
      sizes: p.sizes.map((s): SizeOut => ({
        key: s.key, name: s.name, price: s.price, soldOut: s.soldOut,
      })),
      modifierGroups: p.modifierGroups.map((pg) => ({
        key: pg.group.key,
        name: pg.group.name,
        minSelect: pg.group.minSelect,
        maxSelect: pg.group.maxSelect,
        required: pg.group.minSelect > 0,
        modifiers: pg.group.modifiers.map((m): ModifierOut => ({
          key: m.key, name: m.name, price: m.price, soldOut: m.soldOut,
        })),
      })),
    })),
  }));

  const payload = { categories };

  /**
   * A version the app can compare against what it already has.
   *
   * Hashed from the payload itself rather than from an `updatedAt` column: a
   * price edit, a sold-out toggle and a re-seed all change what the app should
   * show, and only the content is guaranteed to notice all three.
   */
  const version = createHash("sha1").update(JSON.stringify(payload)).digest("base64url").slice(0, 16);
  const etag = `W/"${version}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { etag, "cache-control": "public, max-age=60" } });
  }

  return NextResponse.json({ version, ...payload }, {
    headers: {
      etag,
      // Matches the 60s revalidate on getMenu, so a phone and the website
      // cannot show different prices for longer than the server itself does.
      "cache-control": "public, max-age=60",
    },
  });
}
