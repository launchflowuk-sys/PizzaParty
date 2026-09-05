# LaunchFlow — Takeaway Ordering Template

One repo, config-driven per client, deployed per client via Coolify. First instance: **Farm Pizza** (Basildon & Grays).

- Next.js 15 (App Router) storefront + kitchen + admin, Postgres via Prisma, Stripe (Apple/Google Pay), Resend email, Twilio SMS.
- Zero client-specific code in components. Everything per client lives in `config/<slug>/`.
- SSR menu, JSON-LD (`Restaurant`, `Menu`, `MenuItem`, `Offer`, `LocalBusiness`, `FAQPage`), per-locality landing pages, auto sitemap/OG.

## Layout

```
apps/web/            Next.js app (storefront, /kitchen, /admin, API routes)
packages/ui/         @launchflow/ui — OKLCH tokens + Tailwind v4 preset + primitives
packages/db/         Prisma schema + client
packages/config/     zod schemas, CSV importer, config loader
config/_schema/      JSON schemas (generated from zod)
config/farm-pizza/   client.json, menu.json, copy/<locality>.md, assets/
scripts/             seed-client.ts, new-client.ts, validate-config.ts, gen-schema.ts
docker/              Dockerfile, entrypoint, compose, Coolify notes
```

## Local dev

```bash
cp .env.example .env            # fill DATABASE_URL at minimum
pnpm install
pnpm db:generate
pnpm db:migrate:dev             # or pnpm db:push
pnpm seed farm-pizza
pnpm dev                        # http://localhost:3000
```

- Kitchen: `/kitchen` (PIN = `KITCHEN_PIN`). Admin: `/admin` (`ADMIN_PASSWORD`). Agency: `/admin/launchflow` (`LAUNCHFLOW_KEY`). Staff sign in at `/admin/login` with their own PIN, which decides what they can reach.
- Secrets live in `.env` only. `docker/compose.yml` sets `CLIENT_SLUG` and `DATABASE_URL` and nothing else, because anything in its `environment:` block silently overrides `env_file`. Host ports come from `docker/.env` (`WEB_PORT`, `DB_PORT`) when 3000 or 5432 are taken.
- **Before exposing the stack to anything but your own machine** — a Cloudflare quick tunnel counts — set real values for `ADMIN_PASSWORD`, `LAUNCHFLOW_KEY`, `SESSION_SECRET` and `CRON_SECRET`, and change the sample staff PINs in `config/<slug>/ops.json`. They are committed to this repo, so they are public.
- Without Stripe/Twilio/Resend keys, SMS/email are logged to the console (dry-run) and the OTP login shows the code in the UI (dev only). Cash on collection works end to end without Stripe.

## Demo data

A shop with three orders on the dashboard does not sell itself. This builds one
worth showing:

```bash
pnpm demo-data farm-pizza          # 850 customers, ~9 months of orders
pnpm demo-data farm-pizza --wipe    # clear what it made, then rebuild
```

It writes real rows through the normal tables: a customer base with regulars,
one-timers and a lapsed tail, proper volume in the recent weeks, orders still on
the pass right now so the kitchen and dispatch screens have work in them, and a
win-back campaign that has already run with its revenue attributed. Everything
it creates carries a reserved `+447700 90xxxx` number (Ofcom's fiction range),
so `--wipe` removes exactly what it made and never touches a genuine order.

Re-run it before a demo to refresh the live orders, and never run it against a
shop that is actually trading.

## Marketing

The back office earns its keep here rather than just taking orders.

- **Automations** (`/admin/marketing`) run on their own: win back a lapsed
  customer, nudge a one-timer, thank a new one, fill a quiet night. Each has a
  cooldown and a per-run cap, so a misconfigured rule cannot text the whole list.
  Point a daily scheduler at `POST /api/cron/automations` with
  `Authorization: Bearer $CRON_SECRET`.
- **Campaigns** (`/admin/campaigns`) go out once, to one of nine segments.
- **Attribution** is the point of both. Every message carries an offer code and
  writes a `MarketingSend` row; when an order redeems that code the money is
  credited back to the message that caused it, so a campaign's revenue is
  measured rather than claimed. Both screens check the code against the audience
  first — a first-order-only code sent to a win-back list is a silent, expensive
  failure, because pricing drops an inapplicable promo without erroring.
- Only customers who opted in are ever contacted, and every SMS gets
  "Reply STOP to opt out" appended. Both are legal requirements, not settings.

## New client in 4 steps

```bash
pnpm new-client --name="Tandoori Nights" --domain=tandoorinights.co.uk --cuisine=Indian --locality="Grays,Tilbury" --postcodes=RM16,RM17 --primary=#D97706
# fill config/tandoori-nights/menu.json (or drop products.csv — see products.csv.example)
pnpm validate-config tandoori-nights
# Coolify: new service from docker/Dockerfile, build arg + env CLIENT_SLUG=tandoori-nights, managed Postgres. First boot migrates + seeds.
```

## Checks

`pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm lhci` (Lighthouse mobile ≥ 90 on `/` and `/menu`, enforced in CI).
