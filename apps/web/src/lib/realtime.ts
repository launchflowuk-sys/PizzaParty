import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "pg";
import { prisma } from "@launchflow/db";
import { env } from "./env";

/**
 * Live updates for the ops screens: Postgres LISTEN/NOTIFY fanned out over SSE.
 *
 * Publish goes through the database, so it works from any process (web,
 * webhook, cron) and needs no broker. Listen is ONE dedicated pg connection
 * per server process, however many screens are open; an idle stream holds no
 * database connection. Payloads carry ids only - screens refetch what they show.
 */
const CHANNEL = "lf_orders";
const MAX_STREAMS = 500; // open streams per process before a staff screen is told to poll instead
const HEARTBEAT_MS = 20_000;
const MAX_BACKOFF_MS = 30_000;

export type LiveEvent =
  | { clientId: string; kind: "order"; orderId: string; type: string }
  | { clientId: string; kind: "menu" }
  | { kind: "resync" };

/** Never throws: a missed notification is covered by the screens' slow poll. */
async function notify(sql: Promise<unknown>) {
  try { await sql; } catch (e) { console.error("[realtime] publish failed", (e as Error).message); }
}

/** An order changed. `type` is the OrderEvent type (placed, paid, amended...). */
export function publishOrder(orderId: string, type: string) {
  return notify(prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, json_build_object('kind', 'order', 'clientId', "clientId", 'orderId', id, 'type', ${type}::text)::text) FROM "Order" WHERE id = ${orderId}`);
}

/** The menu changed (price, sold out, deal...). Fire and forget from the admin bump() helpers. */
export function publishMenu() {
  return notify(prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, json_build_object('kind', 'menu', 'clientId', id)::text) FROM "Client" WHERE slug = ${env.clientSlug}`);
}

type Hub = { bus: EventEmitter; pg: Client | null; connecting: boolean; everUp: boolean; fails: number; streams: number };
// On globalThis so dev hot reload (and each route's own module copy) shares one listener.
const g = globalThis as unknown as { __lfRealtime?: Hub };
function hub(): Hub {
  if (!g.__lfRealtime) {
    const bus = new EventEmitter();
    bus.setMaxListeners(0);
    g.__lfRealtime = { bus, pg: null, connecting: false, everUp: false, fails: 0, streams: 0 };
  }
  return g.__lfRealtime;
}

async function connect(h: Hub) {
  if (h.pg || h.connecting) return;
  h.connecting = true;
  // LISTEN needs a session connection: a transaction-mode pooler (PgBouncer) would drop it.
  const pg = new Client({ connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL, keepAlive: true, application_name: "lf-realtime" });
  let dead = false;
  const down = (why: string) => {
    if (dead) return;
    dead = true;
    if (h.pg === pg) h.pg = null;
    pg.removeAllListeners();
    pg.on("error", () => {}); // late socket errors after we have given up on it
    void pg.end().catch(() => {});
    const wait = Math.min(MAX_BACKOFF_MS, 500 * 2 ** h.fails++);
    console.error(`[realtime] listener down (${why}); retry in ${wait}ms`);
    setTimeout(() => void connect(h), wait).unref();
  };
  pg.on("notification", (m) => {
    try { h.bus.emit("event", JSON.parse(m.payload ?? "") as LiveEvent); } catch { /* not ours */ }
  });
  pg.on("error", (e) => down(e.message));
  pg.on("end", () => down("connection ended"));
  try {
    await pg.connect();
    await pg.query(`LISTEN ${CHANNEL}`);
    h.pg = pg;
    h.fails = 0;
    // Anything published while we were down is lost: tell every screen to refetch.
    if (h.everUp) h.bus.emit("event", { kind: "resync" } satisfies LiveEvent);
    h.everUp = true;
  } catch (e) {
    down((e as Error).message);
  } finally {
    h.connecting = false;
  }
}

/** Every live event in this process. Starts the listener on first use. Returns the unsubscribe. */
export function onLive(fn: (e: LiveEvent) => void): () => void {
  const h = hub();
  void connect(h);
  h.bus.on("event", fn);
  return () => { h.bus.off("event", fn); };
}

const HEADERS = { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" };

/**
 * An SSE response. `start` gets a writer and returns its cleanup; the heartbeat,
 * the cap and the unsubscribe on disconnect are handled here.
 * `no-transform` also stops Next's gzip from buffering the stream.
 */
export function sseResponse(signal: AbortSignal, start: (w: { send: (data: unknown, event?: string) => void; close: () => void }) => () => void): Response {
  const h = hub();
  const enc = new TextEncoder();
  let stop: (() => void) | null = null;
  const stream = new ReadableStream({
    start(controller) {
      h.streams++;
      let open = true;
      const write = (s: string) => { if (open) try { controller.enqueue(enc.encode(s)); } catch { close(); } };
      const beat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      let cleanup: (() => void) | null = null;
      const close = () => {
        if (!open) return;
        open = false;
        h.streams--;
        clearInterval(beat);
        cleanup?.();
        signal.removeEventListener("abort", close);
        try { controller.close(); } catch { /* already closed */ }
      };
      stop = close;
      signal.addEventListener("abort", close);
      write(": open\n\n"); // gets the headers out now, so the browser's onopen fires
      cleanup = start({ send: (data, event) => write(`${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`), close });
      if (!open) cleanup(); // start() closed synchronously
    },
    cancel() { stop?.(); },
  });
  return new Response(stream, { headers: HEADERS });
}

/** The staff stream: every order and menu change for this shop. Clients refetch on each event. */
export function shopStream(signal: AbortSignal, clientId: string): Response {
  // Staff screens only: they fall back to polling. A customer's page has no fallback, so is never turned away.
  if (hub().streams >= MAX_STREAMS) return new Response("Too many live screens", { status: 503, headers: { "retry-after": "30" } });
  return sseResponse(signal, ({ send }) =>
    onLive((e) => {
      if (e.kind === "resync") send({}, "resync");
      else if (e.clientId !== clientId) return;
      else if (e.kind === "order") send({ orderId: e.orderId, kind: e.type }, "order");
      else send({}, "menu");
    }),
  );
}
