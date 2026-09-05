# Coolify per-client deploy

1. **Postgres**: Coolify → Databases → PostgreSQL 16. Name `<slug>-db`. Copy internal `DATABASE_URL`.
2. **Service**: Coolify → New Resource → Docker (Dockerfile). Repo = this repo, branch `main`, Dockerfile `docker/Dockerfile`, build arg `CLIENT_SLUG=<slug>`.
3. **Env vars** (see `.env.example`): `CLIENT_SLUG, DATABASE_URL, NEXT_PUBLIC_SITE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, KITCHEN_PIN, ADMIN_PASSWORD, LAUNCHFLOW_KEY, SESSION_SECRET, CRON_SECRET`.
4. **Domains**: `domain`, `www.domain`, and every `legacyDomains[]` entry all pointed at the service. The app 301s www/legacy hosts to the canonical domain. Cloudflare proxied, SSL Full (strict).
5. **Stripe webhook**: `https://<domain>/api/stripe/webhook` → `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
6. **Cron** (Coolify scheduled task or Cloudflare cron): every 5 min `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/review-requests`.
7. **First boot** runs `prisma migrate deploy` then `seed-client` automatically (`SEED_ON_BOOT=true`).
8. Verify at `/admin/launchflow` (health, config hash, Stripe, domain check).
