/** Validate every client folder (or one slug) without touching the DB. */
import { ConfigError, listClientSlugs, loadClientConfig, loadMenuConfig } from "@launchflow/config";

const only = process.argv[2];
const slugs = only ? [only] : listClientSlugs();
let failed = 0;
for (const slug of slugs) {
  try {
    const c = loadClientConfig(slug);
    const m = loadMenuConfig(slug);
    console.log(`✔ ${slug}: ${c.locations.length} locations, ${m.categories.length} categories, ${m.products.length} products, ${m.deals.length} deals`);
  } catch (e) {
    failed++;
    if (e instanceof ConfigError) { console.error(`✖ ${slug}: ${e.message}`); for (const i of e.issues) console.error(`   - ${i}`); }
    else console.error(`✖ ${slug}:`, e);
  }
}
process.exit(failed ? 1 : 0);
