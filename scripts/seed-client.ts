/**
 * CLI: seed a client from /config/<slug> into the database.
 *
 *   pnpm seed                      # uses CLIENT_SLUG
 *   pnpm seed farm-pizza           # explicit slug
 *   pnpm seed farm-pizza --reset   # deactivate menu rows not present in config (orders are kept)
 *   pnpm seed farm-pizza --overwrite-menu  # re-import the menu over one the shop already owns
 *
 * Without --overwrite-menu a shop that has been seeded once keeps its own menu:
 * after go-live the database is the source of truth, not config, because the owner
 * edits prices in the back office. Overwriting is destructive and deliberate.
 */
import { prisma } from "@launchflow/db";
import { seedClient } from "@launchflow/db/seed";
import { ConfigError } from "@launchflow/config";

const slug = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? process.env.CLIENT_SLUG;
const reset = process.argv.includes("--reset");
const overwriteMenu = process.argv.includes("--overwrite-menu");

if (!slug) { console.error("Usage: pnpm seed <slug>  (or set CLIENT_SLUG)"); process.exit(1); }
seedClient(slug, { reset, menu: overwriteMenu ? "overwrite" : "auto" })
  .then((r) => { console.log(`Seeded ${slug}:`, JSON.stringify(r)); return prisma.$disconnect(); })
  .catch(async (e) => {
    if (e instanceof ConfigError) { console.error(`✖ ${e.message}`); for (const i of e.issues) console.error(`  - ${i}`); }
    else console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
