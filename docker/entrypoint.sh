#!/bin/sh
set -e
echo "[entrypoint] client=$CLIENT_SLUG"
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] prisma migrate deploy"
  ./packages/db/node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma
  if [ "${SEED_ON_BOOT:-true}" = "true" ]; then
    echo "[entrypoint] seeding $CLIENT_SLUG from /app/config"
    ./node_modules/.bin/tsx scripts/seed-client.ts "$CLIENT_SLUG" || echo "[entrypoint] seed failed (continuing)"
  fi
fi
exec node apps/web/server.js
