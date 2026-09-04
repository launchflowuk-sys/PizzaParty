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

- Kitchen: `/kitchen` (PIN = `KITCHEN_PIN`). Admin: `/admin` (`ADMIN_PASSWORD`). Agency: `/admin/launchflow` (`LAUNCHFLOW_KEY`).
- Without Stripe/Twilio/Resend keys, SMS/email are logged to the console (dry-run) and the OTP login shows the code in the UI (dev only). Cash on collection works end to end without Stripe.

## New client in 4 steps

```bash
pnpm new-client --name="Tandoori Nights" --domain=tandoorinights.co.uk --cuisine=Indian --locality="Grays,Tilbury" --postcodes=RM16,RM17 --primary=#D97706
# fill config/tandoori-nights/menu.json (or drop products.csv — see products.csv.example)
pnpm validate-config tandoori-nights
# Coolify: new service from docker/Dockerfile, build arg + env CLIENT_SLUG=tandoori-nights, managed Postgres. First boot migrates + seeds.
```

## Checks

`pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm lhci` (Lighthouse mobile ≥ 90 on `/` and `/menu`, enforced in CI).
