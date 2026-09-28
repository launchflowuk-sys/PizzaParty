/** Customer-display helpers shared by the till, the display and the relay (POS-PLAN item 29). No server imports. */
import type { PosDisplayEnvelope, PosDisplayTill } from "./pos-phase4-types";

/** pg_notify refuses payloads of 8000 bytes or more; leave room for the event wrapper. */
export const NOTIFY_MAX_BYTES = 7000;
/** A till counts as live on the pairing screen if it has sent anything within this long. */
export const TILL_ACTIVE_MS = 12 * 60 * 60_000;

const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * The JSON to NOTIFY for this envelope. A long basket keeps its first lines that fit
 * and is marked `truncated`; the totals always travel whole. `wrap` adds the event's
 * own fields so the whole payload is what gets measured.
 */
export function fitForNotify(env: PosDisplayEnvelope, wrap: (e: PosDisplayEnvelope) => unknown, max = NOTIFY_MAX_BYTES): string {
  let json = JSON.stringify(wrap(env));
  if (bytes(json) < max || env.msg.type !== "basket") return json;
  const { lines } = env.msg;
  for (let n = lines.length - 1; n >= 0; n--) {
    json = JSON.stringify(wrap({ ...env, msg: { ...env.msg, lines: lines.slice(0, n), truncated: true } }));
    if (bytes(json) < max) break;
  }
  return json;
}

/**
 * Which till a display should follow. The remembered choice while it is still live;
 * otherwise the only live till; otherwise ask ("pick"). With no live till at all, keep
 * the remembered one (it may just be quiet) or wait.
 */
export function pickTill(tills: Pick<PosDisplayTill, "tillId" | "at">[], remembered: string | null, now = Date.now()): { follow: string } | { pick: true } | { wait: true } {
  const live = tills.filter((t) => now - t.at < TILL_ACTIVE_MS);
  if (remembered && live.some((t) => t.tillId === remembered)) return { follow: remembered };
  if (live.length === 1) return { follow: live[0]!.tillId };
  if (live.length > 1) return { pick: true };
  return remembered ? { follow: remembered } : { wait: true };
}

/** Merge one envelope into the per-till state. Returns the same object when it is stale (not newer). */
export function mergeTill(prev: PosDisplayTill | undefined, env: PosDisplayEnvelope): PosDisplayTill {
  if (prev && env.at <= prev.at) return prev;
  const basket = env.msg.type === "basket" ? env.msg : env.msg.type === "idle" ? undefined : prev?.basket;
  return { ...env, basket };
}
