/**
 * Signed cookie tokens (HMAC-SHA256 via Web Crypto so it runs in middleware and Node).
 * Roles: kitchen (PIN), admin (password), agency (LAUNCHFLOW_KEY), customer (SMS OTP).
 */
import { env } from "./env";

export type Role = "kitchen" | "admin" | "agency" | "customer";
export const COOKIE: Record<Role, string> = { kitchen: "lf_kitchen", admin: "lf_admin", agency: "lf_agency", customer: "lf_customer" };
const TTL: Record<Role, number> = { kitchen: 60 * 60 * 24 * 30, admin: 60 * 60 * 12, agency: 60 * 60 * 4, customer: 60 * 60 * 24 * 90 };

/** `sr` is the staff role for admin sessions; `nm` their display name. Absent on a
 *  shared-password session, which is treated as a manager. */
type Payload = { role: Role; sub: string; exp: number; loc?: string; sr?: string; nm?: string };

const enc = new TextEncoder();
const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

/**
 * The HMAC key behind every admin, staff and customer cookie.
 *
 * Checked here rather than at module load because this module is evaluated
 * during `next build`, where no runtime secrets exist. An unset secret in
 * production would mean a predictable signing key and forgeable admin
 * sessions, so it fails the request instead of quietly signing with a
 * placeholder. Local work falls back so the app still runs from a bare clone.
 */
async function key(): Promise<CryptoKey> {
  const secret = env.sessionSecret
    || (env.isProd ? "" : "dev-insecure-secret-change-me");
  if (!secret) throw new Error("SESSION_SECRET must be set in production");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signToken(payload: Omit<Payload, "exp">, ttlSeconds = TTL[payload.role]): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const sig = b64u(new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body))));
  return `${body}.${sig}`;
}

export async function verifyToken(token: string | undefined, role: Role): Promise<Payload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64u(body))) as Payload;
    if (payload.role !== role || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function cookieOptions(role: Role) {
  return { httpOnly: true, sameSite: "lax" as const, secure: env.isProd, path: "/", maxAge: TTL[role] };
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function sha256(s: string): Promise<string> {
  return b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
}
