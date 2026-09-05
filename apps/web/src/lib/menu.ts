import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@launchflow/db";
import { env } from "./env";

export const MENU_TAG = "menu";
export const CLIENT_TAG = "client";

export const getClientRow = unstable_cache(
  async () => {
    const c = await prisma.client.findUnique({ where: { slug: env.clientSlug } });
    if (!c) throw new Error(`Client "${env.clientSlug}" is not seeded. Run: pnpm seed ${env.clientSlug}`);
    return c;
  },
  ["client-row", env.clientSlug],
  { tags: [CLIENT_TAG], revalidate: 300 },
);

async function loadMenu() {
  const client = await getClientRow();
  const categories = await prisma.category.findMany({
    where: { clientId: client.id, active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          sizes: { orderBy: { sortOrder: "asc" } },
          modifierGroups: { orderBy: { sortOrder: "asc" }, include: { group: { include: { modifiers: { orderBy: { sortOrder: "asc" } } } } } },
        },
      },
    },
  });
  const deals = await prisma.deal.findMany({
    where: { clientId: client.id, active: true },
    orderBy: { sortOrder: "asc" },
    include: { slots: { orderBy: { sortOrder: "asc" } } },
  });
  return { categories, deals };
}

export const getMenu = unstable_cache(loadMenu, ["menu", env.clientSlug], { tags: [MENU_TAG], revalidate: 60 });

export type Menu = Awaited<ReturnType<typeof loadMenu>>;
export type MenuCategory = Menu["categories"][number];
export type MenuProduct = MenuCategory["products"][number];
export type MenuDeal = Menu["deals"][number];

export function findProduct(menu: Menu, slug: string): { product: MenuProduct; category: MenuCategory } | null {
  for (const category of menu.categories) {
    const product = category.products.find((p) => p.slug === slug);
    if (product) return { product, category };
  }
  return null;
}

export const minPrice = (p: MenuProduct) => Math.min(...p.sizes.map((s) => s.price));
export const productPath = (category: { slug: string }, product: { slug: string }) => `/menu/${category.slug}/${product.slug}`;

export function topSellers(menu: Menu, n = 6): { product: MenuProduct; category: MenuCategory }[] {
  const all = menu.categories.flatMap((category) => category.products.map((product) => ({ product, category })));
  return all
    .filter((x) => x.product.sizes.length && !x.product.soldOut)
    .sort((a, b) => Number(b.product.featured) - Number(a.product.featured) || b.product.ordersCount - a.product.ordersCount)
    .slice(0, n);
}

export async function getLocations() {
  const client = await getClientRow();
  return prisma.location.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" }, include: { hours: true, bands: { orderBy: { sortOrder: "asc" } } } });
}
