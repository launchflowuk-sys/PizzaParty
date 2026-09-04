import { NextResponse, type NextRequest } from "next/server";
import { getMenu, productPath } from "@/lib/menu";

/** Cheap upsells: sides, drinks and desserts not already in the basket. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { products?: string[] };
  const have = new Set(body.products ?? []);
  const menu = await getMenu();
  const prefer = ["drinks", "sides", "desserts", "dips", "extras"];
  const items = menu.categories
    .filter((c) => prefer.some((p) => c.slug.includes(p)))
    .flatMap((c) => c.products.filter((p) => !have.has(p.slug) && !p.soldOut).slice(0, 3).map((p) => ({ name: p.name, href: productPath(c, p), price: Math.min(...p.sizes.map((s) => s.price)) })))
    .slice(0, 6);
  return NextResponse.json({ items });
}
