import "server-only";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { clientDir } from "@launchflow/config";
import { env } from "./env";

/**
 * Which card marks this shop actually has files for.
 *
 * Read from disk rather than listed in config, so dropping a file into
 * assets/payments/ is the whole job - and so a mark can never be advertised
 * that has no artwork behind it.
 *
 * They must be the real thing, downloaded from the scheme's own brand centre.
 * A drawn approximation of the Visa wordmark is worse than nothing: it reads as
 * fake immediately, which destroys the only reason the badge is there, and the
 * schemes require their marks to be reproduced exactly.
 */
/* Read once. This is called from the root layout, so without the cache it is a
   synchronous directory read on the render path of every single page view - for
   a list of at most five filenames that only changes on deploy. */
let cached: string[] | undefined;

export function paymentMarks(): string[] {
  if (cached) return cached;
  try {
    cached = readdirSync(join(clientDir(env.clientSlug), "assets", "payments"))
      .filter((f) => f.toLowerCase().endsWith(".svg") || f.toLowerCase().endsWith(".png"));
    return cached;
  } catch {
    // No folder yet. The footer falls back to a line of text rather than
    // showing an empty row where the badges should be.
    cached = [];
    return cached;
  }
}
