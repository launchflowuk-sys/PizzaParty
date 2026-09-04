/**
 * CLI: seed a client from /config/<slug> into the database.
 *
 *   pnpm seed                      # uses CLIENT_SLUG
 *   pnpm seed farm-pizza           # explicit slug
 *   pnpm seed farm-pizza --reset   # deactivate menu rows not present in config (orders are kept)
 */
import { prisma } from "@launchflow/db";
import { seedClient } from "@launchflow/db/seed";
import { ConfigError } from "@launchflow/config";

const slug = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? process.env.CLIENT_SLUG;
const reset = process.argv.includes("--reset");

if (!slug) { console.error("Usage: pnpm seed <slug>  (or set CLIENT_SLUG)"); process.exit(1); }
seedClient(slug, { reset })
  .then((r) => { console.log(`Seeded ${slug}:`, JSON.stringify(r)); return prisma.$disconnect(); })
  .catch(async (e) => {
    if (e instanceof ConfigError) { console.error(`✖ ${e.message}`); for (const i of e.issues) console.error(`  - ${i}`); }
    else console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
