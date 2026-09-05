#!/bin/sh
set -e
echo "[entrypoint] client=$CLIENT_SLUG"
if [ -n "$DATABASE_URL" ]; then
  # The database may not accept connections yet (fresh volume, managed
  # Postgres still booting), so retry rather than dying on the first refusal.
  attempts=${DB_WAIT_ATTEMPTS:-30}
  delay=${DB_WAIT_DELAY:-2}
  i=1
  echo "[entrypoint] prisma migrate deploy"
  until ./packages/db/node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma; do
    if [ "$i" -ge "$attempts" ]; then
      echo "[entrypoint] database unreachable after $i attempts, giving up" >&2
      exit 1
    fi
    echo "[entrypoint] database not ready (attempt $i/$attempts), retrying in ${delay}s"
    i=$((i + 1))
    sleep "$delay"
  done
  if [ "${SEED_ON_BOOT:-true}" = "true" ]; then
    echo "[entrypoint] seeding $CLIENT_SLUG from /app/config"
    ./node_modules/.bin/tsx scripts/seed-client.ts "$CLIENT_SLUG" || echo "[entrypoint] seed failed (continuing)"
  fi
fi
# Encode the image variants before customers ask for them. In the background,
# because the site should start serving now, not in two minutes - the script
# waits for /api/health itself and then works through the list one at a time.
if [ "${WARM_IMAGES:-true}" = "true" ]; then
  sh scripts/warm-images.sh &
fi

exec node apps/web/server.js
