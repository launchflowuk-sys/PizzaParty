"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getClientRow, MENU_TAG } from "@/lib/menu";
import { toPence } from "@/lib/money";

/**
 * Building the menu: adding, renaming and removing the things the shop sells.
 *
 * Kept apart from actions.ts, which changes the state of a menu that already
 * exists - sold out, hidden, price. These change its shape, and they carry the
 * rules that stop the shape becoming invalid: a product with no sizes cannot be
 * priced, a category that still has products in it cannot be removed without
 * taking them with it, and a slug that is already a live URL must not move.
 *
 * None of this was safe to build until the seeder stopped rewriting the menu on
 * every deploy - see MenuMode in packages/db/src/seed-client.ts.
 */

async function guard() {
  const staff = await currentStaff();
  if (!staff) throw new Error("Unauthorised");
  if (!can(staff.role, "menu")) throw new Error("Forbidden");
  return getClientRow();
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, d = 0) => {
  const v = Number(String(fd.get(k) ?? "").replace(/[£,\s]/g, ""));
  return Number.isFinite(v) ? v : d;
};
const bump = () => { revalidateTag(MENU_TAG); revalidatePath("/admin", "layout"); };

/**
 * Refuse the change and say why, on the screen.
 *
 * Throwing would give the shop the error boundary and lose what they typed, and
 * these are ordinary "you can't do that yet" answers rather than faults.
 *
 * The answer has to land on the screen the change was made from - refusing to
 * remove the last size of a pizza and then bouncing the shop to the menu list
 * makes them find their way back to see why. Forms carry the screen they are
 * on; anything without one falls back to the list. The value is checked rather
 * than trusted, so a tampered field cannot turn a form post into an open
 * redirect off the site.
 */
function target(fd: FormData, param: "m" | "e", message: string): never {
  const raw = String(fd.get("back") ?? "");
  const back = /^\/admin\/menu(\/[A-Za-z0-9_-]+)?$/.test(raw) ? raw : "/admin/menu";
  redirect(`${back}?${param}=${encodeURIComponent(message)}`);
}
// Declared as functions, not arrow consts: TypeScript only narrows past a
// `never` return for a function declaration, and these are used as guards.
function refuse(fd: FormData, message: string): never { target(fd, "e", message); }
function done(fd: FormData, message: string): never { target(fd, "m", message); }

/**
 * A URL-safe key from whatever the shop typed.
 *
 * Generated once, at creation, and never regenerated on rename: the slug is the
 * public product URL and the value deal slots match on, so renaming "Margherita"
 * to "Margarita" must not break a link somebody has already shared or silently
 * drop the pizza out of a meal deal.
 */
function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/** `pizza`, then `pizza-2`, `pizza-3` - never a collision, never a silent overwrite. */
function uniqueKey(base: string, taken: Set<string>): string {
  const root = base || "item";
  if (!taken.has(root)) return root;
  for (let i = 2; i < 500; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${Date.now()}`;
}

async function nextSort(where: { categoryId: string } | { clientId: string }): Promise<number> {
  const rows = "categoryId" in where
    ? await prisma.product.findMany({ where, select: { sortOrder: true } })
    : await prisma.category.findMany({ where, select: { sortOrder: true } });
  return rows.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;
}

/* ---------- Categories ---------- */

export async function createCategory(fd: FormData) {
  const client = await guard();
  const name = str(fd, "name");
  if (!name) refuse(fd, "Give the section a name.");

  const existing = await prisma.category.findMany({ where: { clientId: client.id }, select: { slug: true } });
  const slug = uniqueKey(slugify(name), new Set(existing.map((c) => c.slug)));

  await prisma.category.create({
    data: {
      clientId: client.id, slug, name,
      description: str(fd, "description"),
      sortOrder: await nextSort({ clientId: client.id }),
    },
  });
  bump();
  done(fd, `Added the ${name} section.`);
}

export async function updateCategory(fd: FormData) {
  await guard();
  const name = str(fd, "name");
  if (!name) refuse(fd, "A section needs a name.");
  await prisma.category.update({
    where: { id: str(fd, "id") },
    data: { name, description: str(fd, "description") },
  });
  bump();
}

/**
 * Removing a section.
 *
 * Refused while it still has products in it. Cascading would take the products
 * with it, and "delete Pizzas" meaning "delete all thirty pizzas" is not a thing
 * anyone should be able to do with one click at the end of a shift.
 */
export async function deleteCategory(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const cat = await prisma.category.findUniqueOrThrow({
    where: { id },
    select: { name: true, _count: { select: { products: true } } },
  });
  if (cat._count.products > 0) {
    refuse(fd, `${cat.name} still has ${cat._count.products} item${cat._count.products === 1 ? "" : "s"} in it. Move or delete those first.`);
  }
  await prisma.category.delete({ where: { id } });
  bump();
  done(fd, `Deleted the ${cat.name} section.`);
}

export async function moveCategory(fd: FormData) {
  const client = await guard();
  const id = str(fd, "id");
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const sibs = await prisma.category.findMany({ where: { clientId: client.id }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const i = sibs.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sibs.length) return;
  const order = sibs.map((s) => s.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  await prisma.$transaction(order.map((cid, k) => prisma.category.update({ where: { id: cid }, data: { sortOrder: k } })));
  bump();
}

/* ---------- Products ---------- */

/**
 * A new item on the menu.
 *
 * Created with one size, because a product with no sizes has no price and
 * cannot be added to a basket - it would appear on the menu and then refuse to
 * be ordered. More sizes can be added straight afterwards.
 */
export async function createProduct(fd: FormData) {
  const client = await guard();
  const name = str(fd, "name");
  const categoryId = str(fd, "categoryId");
  if (!name) refuse(fd, "Give the item a name.");
  if (!categoryId) refuse(fd, "Pick a section for the item.");

  const price = toPence(num(fd, "price"));
  const sizeName = str(fd, "sizeName") || "Regular";

  const existing = await prisma.product.findMany({ where: { clientId: client.id }, select: { slug: true } });
  const slug = uniqueKey(slugify(name), new Set(existing.map((p) => p.slug)));

  await prisma.product.create({
    data: {
      clientId: client.id, categoryId, slug, name,
      description: str(fd, "description"),
      sortOrder: await nextSort({ categoryId }),
      sizes: { create: [{ key: slugify(sizeName) || "regular", name: sizeName, price, sortOrder: 0 }] },
    },
  });
  bump();
  done(fd, `Added ${name}.`);
}

/**
 * Deleting an item.
 *
 * Safe for the books: an order line keeps its own copy of the name, size and
 * price it was sold at, and its link to the product is optional, so past orders
 * and takings read exactly the same afterwards. What is lost is the item, so
 * this is for things put on by mistake - Hide is the one for "not this season".
 */
export async function deleteProduct(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const p = await prisma.product.findUniqueOrThrow({ where: { id }, select: { name: true } });
  await prisma.product.delete({ where: { id } });
  bump();
  // Always the list, never `back`: this is usually pressed on the item's own
  // screen, and that screen is a 404 the moment this returns.
  redirect(`/admin/menu?m=${encodeURIComponent(`Deleted ${p.name}. Past orders are unaffected.`)}`);
}

/**
 * Photo, labels and allergens.
 *
 * Labels and allergens are typed as a plain comma-separated list because that is
 * how someone writes them; blanks are dropped so a trailing comma does not
 * become an empty badge on the storefront.
 */
export async function updateProductMeta(fd: FormData) {
  await guard();
  const list = (k: string) => str(fd, k).split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  await prisma.product.update({
    where: { id: str(fd, "id") },
    data: { image: str(fd, "image"), tags: list("tags"), allergens: list("allergens") },
  });
  bump();
}

export async function moveProductToCategory(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const categoryId = str(fd, "categoryId");
  if (!categoryId) return;
  await prisma.product.update({
    where: { id },
    data: { categoryId, sortOrder: await nextSort({ categoryId }) },
  });
  bump();
}

/* ---------- Sizes ---------- */

export async function addSize(fd: FormData) {
  await guard();
  const productId = str(fd, "productId");
  const name = str(fd, "name");
  if (!name) refuse(fd, "Give the size a name, like Large or 12 inch.");

  const taken = await prisma.productSize.findMany({ where: { productId }, select: { key: true, sortOrder: true } });
  await prisma.productSize.create({
    data: {
      productId,
      key: uniqueKey(slugify(name), new Set(taken.map((s) => s.key))),
      name,
      price: toPence(num(fd, "price")),
      sortOrder: taken.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1,
    },
  });
  bump();
}

export async function updateSize(fd: FormData) {
  await guard();
  const name = str(fd, "name");
  if (!name) refuse(fd, "A size needs a name.");
  // `key` is deliberately untouched - it is written onto every order line and
  // matched by deal slots, so renaming Large to X-Large must not orphan either.
  await prisma.productSize.update({ where: { id: str(fd, "id") }, data: { name, price: toPence(num(fd, "price")) } });
  bump();
}

/** The last size cannot go: a product with none has no price and cannot be ordered. */
export async function deleteSize(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const size = await prisma.productSize.findUniqueOrThrow({
    where: { id },
    select: { productId: true, name: true, product: { select: { name: true } } },
  });
  const count = await prisma.productSize.count({ where: { productId: size.productId } });
  if (count <= 1) refuse(fd, `${size.product.name} needs at least one size. Add another before removing ${size.name}.`);
  await prisma.productSize.delete({ where: { id } });
  bump();
}

export async function toggleSizeSoldOut(fd: FormData) {
  await guard();
  const s = await prisma.productSize.findUniqueOrThrow({ where: { id: str(fd, "id") }, select: { id: true, soldOut: true } });
  await prisma.productSize.update({ where: { id: s.id }, data: { soldOut: !s.soldOut } });
  bump();
}

/* ---------- Option groups and toppings ---------- */

export async function createModifierGroup(fd: FormData) {
  const client = await guard();
  const name = str(fd, "name");
  if (!name) refuse(fd, "Give the option group a name.");
  const min = Math.max(0, Math.round(num(fd, "min")));
  const max = Math.max(min, Math.round(num(fd, "max", min)));

  const taken = await prisma.modifierGroup.findMany({ where: { clientId: client.id }, select: { key: true } });
  await prisma.modifierGroup.create({
    data: {
      clientId: client.id,
      key: uniqueKey(slugify(name), new Set(taken.map((g) => g.key))),
      name, minSelect: min, maxSelect: max, required: min > 0,
    },
  });
  bump();
  done(fd, `Added the ${name} group.`);
}

export async function updateModifierGroup(fd: FormData) {
  await guard();
  const name = str(fd, "name");
  if (!name) refuse(fd, "An option group needs a name.");
  const min = Math.max(0, Math.round(num(fd, "min")));
  const max = Math.max(min, Math.round(num(fd, "max", min)));
  await prisma.modifierGroup.update({
    where: { id: str(fd, "id") },
    data: { name, minSelect: min, maxSelect: max, required: min > 0 },
  });
  bump();
}

/**
 * Deleting a group takes it off every product that offered it, so this says how
 * many that is rather than letting the shop find out afterwards.
 */
export async function deleteModifierGroup(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const g = await prisma.modifierGroup.findUniqueOrThrow({
    where: { id },
    select: { name: true, _count: { select: { products: true } } },
  });
  await prisma.modifierGroup.delete({ where: { id } });
  bump();
  done(fd, g._count.products > 0
    ? `Deleted ${g.name} and took it off ${g._count.products} item${g._count.products === 1 ? "" : "s"}.`
    : `Deleted the ${g.name} group.`);
}

export async function addModifier(fd: FormData) {
  await guard();
  const groupId = str(fd, "groupId");
  const name = str(fd, "name");
  if (!name) refuse(fd, "Give the option a name.");
  const taken = await prisma.modifier.findMany({ where: { groupId }, select: { key: true, sortOrder: true } });
  await prisma.modifier.create({
    data: {
      groupId,
      key: uniqueKey(slugify(name), new Set(taken.map((m) => m.key))),
      name,
      price: toPence(num(fd, "price")),
      sortOrder: taken.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1,
    },
  });
  bump();
}

export async function updateModifier(fd: FormData) {
  await guard();
  const name = str(fd, "name");
  if (!name) refuse(fd, "An option needs a name.");
  await prisma.modifier.update({ where: { id: str(fd, "id") }, data: { name, price: toPence(num(fd, "price")) } });
  bump();
}

export async function deleteModifier(fd: FormData) {
  await guard();
  await prisma.modifier.delete({ where: { id: str(fd, "id") } });
  bump();
}

/** Offer this group on this product, or stop offering it. */
export async function toggleProductGroup(fd: FormData) {
  await guard();
  const productId = str(fd, "productId");
  const groupId = str(fd, "groupId");
  const link = await prisma.productModifierGroup.findUnique({ where: { productId_groupId: { productId, groupId } } });
  if (link) {
    await prisma.productModifierGroup.delete({ where: { productId_groupId: { productId, groupId } } });
  } else {
    const count = await prisma.productModifierGroup.count({ where: { productId } });
    await prisma.productModifierGroup.create({ data: { productId, groupId, sortOrder: count } });
  }
  bump();
}
