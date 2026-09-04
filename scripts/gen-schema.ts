/** Regenerate config/_schema/*.json from the zod schemas. Run: pnpm tsx scripts/gen-schema.ts */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ClientSchema, MenuSchema, configRoot } from "@launchflow/config";

const out = join(configRoot(), "_schema");
writeFileSync(join(out, "client.schema.json"), JSON.stringify({ $id: "https://launchflow.uk/schemas/client.json", ...zodToJsonSchema(ClientSchema, "Client") }, null, 2) + "\n");
writeFileSync(join(out, "menu.schema.json"), JSON.stringify({ $id: "https://launchflow.uk/schemas/menu.json", ...zodToJsonSchema(MenuSchema, "Menu") }, null, 2) + "\n");
console.log("✔ schemas written to", out);
