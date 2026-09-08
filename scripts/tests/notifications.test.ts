/**
 * The order notification flow, guarded at the points it has actually broken.
 *
 * Two real faults, both silent, both found only because a customer said an
 * email never arrived:
 *
 *   1. Notification rules were seeded inside `seedOps`, which returns early
 *      when a shop has no `ops.json`. That shop then had zero rules, and the
 *      notifier loops over rules - so it sent nothing, logged nothing and threw
 *      nothing. Pizza Party traded for a day like that.
 *   2. Product images in the receipt were built from the raw database value,
 *      so every one asked for /products/x.jpg when the asset route serves
 *      /brand/products/x.jpg. Every product picture in every email was a
 *      broken-image box.
 *
 * Neither would fail a build, a typecheck or a page load, which is exactly why
 * they need a test.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("notification rules are seeded outside seedOps, so a shop with no ops.json still gets them", () => {
  const src = read("packages/db/src/seed-client.ts");

  const opsStart = src.indexOf("async function seedOps(");
  assert.ok(opsStart > 0, "seedOps not found");

  const rulesAt = src.indexOf("prisma.notificationRule.createMany");
  assert.ok(rulesAt > 0, "notification rule seeding not found");

  assert.ok(
    rulesAt < opsStart,
    "notificationRule seeding is inside seedOps again. seedOps returns early when config/<slug>/ops.json " +
      "is missing, so that shop gets zero rules and silently never notifies anybody.",
  );
});

test("seedOps still returns early when there is no ops file", () => {
  // The early return is correct - staff, stock and reviews genuinely are
  // per-shop. The bug was only ever what got caught behind it.
  const src = read("packages/db/src/seed-client.ts");
  assert.match(src, /if \(!existsSync\(file\)\) return \{/);
});

test("receipt product images go through assetUrl, not the raw database path", () => {
  const src = read("apps/web/src/lib/email/templates.ts");

  assert.match(
    src,
    /image:\s*i\.product\?\.image\s*\?\s*assetUrl\(/,
    "The receipt is using the raw image path again. The database stores 'products/x.jpg' and the asset " +
      "route serves it from /brand/, so every product image in every email renders as a broken box.",
  );
  assert.match(src, /import \{[^}]*assetUrl[^}]*\} from "@\/lib\/config"/);
});

test("the default rules cover the events a customer actually waits on", () => {
  const src = read("packages/db/src/notifications.ts");
  for (const event of ["order_placed", "order_accepted", "order_ready", "order_completed"]) {
    assert.ok(
      src.includes(`event: "${event}", audience: "customer"`),
      `no default rule telling the customer about ${event}`,
    );
  }
  // The kitchen has to hear about a new order or nothing gets cooked.
  assert.ok(src.includes('event: "order_placed", audience: "kitchen"'));
});

test("a missing SMTP host makes sendEmail report a dry run rather than a success", () => {
  // It currently returns ok:true with id "dry-run". That is fine as long as the
  // id says so - a caller that logs the id can tell a real send from a silent
  // one. If this ever returns a plausible-looking id, a misconfigured shop
  // becomes indistinguishable from a working one.
  const src = read("apps/web/src/lib/notify.ts");
  assert.match(src, /id:\s*"dry-run"/);
  assert.match(src, /\[email:dry-run\]/);
});
