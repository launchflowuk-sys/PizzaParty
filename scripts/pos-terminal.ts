/**
 * CLI: set up a Stripe Terminal card reader for the till.
 *
 *   pnpm tsx scripts/pos-terminal.ts [slug] --simulated          # test mode: location + a simulated WisePOS E
 *   pnpm tsx scripts/pos-terminal.ts [slug] --code=word-word-word --label="Counter"
 *                                                                # a real reader: the code it shows under Settings > Generate pairing code
 *   pnpm tsx scripts/pos-terminal.ts [slug] --list                # locations and readers on the account
 *   pnpm tsx scripts/pos-terminal.ts [slug] --present=tmr_xxx     # test mode: "tap" a test card on a simulated reader
 *
 * slug defaults to CLIENT_SLUG. Reads STRIPE_SECRET_KEY from the environment or ./.env.
 * Everything is created on the shop's connected account when config has
 * payments.stripeAccountId (direct charges, same as online orders); otherwise
 * on the platform account. The Terminal Location is made once from the first
 * location's address in config and reused on later runs.
 */
import { loadClientConfig } from "@launchflow/config";

try { process.loadEnvFile(".env"); } catch { /* env may come from the shell */ }

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const slug = args.find((a) => !a.startsWith("-")) ?? process.env.CLIENT_SLUG;
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!slug || !key) { console.error("Needs a client slug (or CLIENT_SLUG) and STRIPE_SECRET_KEY."); process.exit(1); }
const cfg = loadClientConfig(slug);
const account = cfg.payments.stripeAccountId;
const testMode = key.startsWith("sk_test_") || key.startsWith("rk_test_");

type Obj = Record<string, unknown> & { id: string };
async function stripe(method: "GET" | "POST", path: string, params: Record<string, string> = {}): Promise<Obj & { data?: Obj[] }> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && qs ? `?${qs}` : ""}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded", ...(account ? { "stripe-account": account } : {}) },
    body: method === "POST" ? qs : undefined,
  });
  const json = await res.json() as Obj & { error?: { message: string } };
  if (!res.ok) throw new Error(`${path}: ${json.error?.message ?? res.status}`);
  return json;
}

/** "162 Dock Road, Tilbury, Essex RM18 7BS" -> Stripe's address fields. */
function splitAddress(address: string) {
  const postcode = /([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i.exec(address)?.[1]?.toUpperCase() ?? "";
  const parts = address.replace(postcode, "").split(",").map((s) => s.trim()).filter(Boolean);
  return { line1: parts[0] ?? "", city: parts[1] ?? parts[0] ?? "", postal_code: postcode };
}

async function ensureLocation(): Promise<string> {
  const existing = (await stripe("GET", "terminal/locations", { limit: "100" })).data?.find((l) => (l.metadata as Record<string, string>)?.client === slug);
  if (existing) return existing.id;
  const loc = cfg.locations[0]!;
  const a = splitAddress(loc.address || cfg.contact.address);
  if (!a.line1 || !a.postal_code) throw new Error(`Could not read a street and postcode from "${loc.address}". Fix the address in config.`);
  const created = await stripe("POST", "terminal/locations", {
    display_name: `${cfg.name} ${loc.name}`,
    "address[line1]": a.line1, "address[city]": a.city, "address[postal_code]": a.postal_code, "address[country]": "GB",
    "metadata[client]": slug!, "metadata[location]": loc.id,
  });
  console.log(`Created Terminal Location ${created.id} (${a.line1}, ${a.city} ${a.postal_code})`);
  return created.id;
}

async function main() {
  if (args.includes("--list")) {
    for (const l of (await stripe("GET", "terminal/locations", { limit: "100" })).data ?? []) console.log(`location ${l.id}  ${l.display_name}`);
    for (const r of (await stripe("GET", "terminal/readers", { limit: "100" })).data ?? []) console.log(`reader   ${r.id}  ${r.label}  ${r.device_type}  ${r.status}`);
    return;
  }
  const present = flag("present");
  if (present) {
    if (!testMode) throw new Error("--present only works with test keys.");
    const r = await stripe("POST", `test_helpers/terminal/readers/${present}/present_payment_method`);
    console.log(`Presented a test card on ${r.id}: action ${(r.action as { status?: string } | null)?.status}`);
    return;
  }
  const code = args.includes("--simulated") ? "simulated-wpe" : flag("code");
  if (!code) { console.error("Pass --simulated (test mode) or --code=<pairing code>. See the top of this file."); process.exit(1); }
  if (code === "simulated-wpe" && !testMode) throw new Error("Simulated readers need test keys.");
  const location = await ensureLocation();
  const reader = await stripe("POST", "terminal/readers", { registration_code: code, location, label: flag("label") ?? (code === "simulated-wpe" ? "Simulated reader" : "Counter reader") });
  console.log(`Registered reader ${reader.id} (${reader.device_type}) at ${location}`);
}

main().catch((e) => { console.error(`✖ ${(e as Error).message}`); process.exit(1); });
