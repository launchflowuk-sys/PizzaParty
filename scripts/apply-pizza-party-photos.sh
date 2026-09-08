#!/bin/sh
# Make the 21 new Pizza Party photographs appear - website, checkout and both apps.
#
# Run this AFTER Coolify has finished redeploying pizza-party, because the SQL
# points at image files that only exist inside the new image.
#
#   sh scripts/apply-pizza-party-photos.sh
#
# Safe to run twice. Every UPDATE is guarded on image='', so it fills blanks
# only and can never overwrite a photograph the owner has set from the back
# office. It does not touch prices, orders or anything else.
#
# Containers are found by their Coolify service label rather than by name,
# because a redeploy gives them a new name every time.

set -eu

SERVER="root@46.225.104.128"
KEY="$HOME/.ssh/hetzner_ed25519"
SQL="$(dirname "$0")/apply-images-pizza-party.sql"

[ -f "$SQL" ] || { echo "cannot find $SQL - run this from the repo root"; exit 1; }

echo "==> 1/3  applying image paths to the pizza-party database"
ssh -i "$KEY" "$SERVER" \
  'docker exec -i $(docker ps -q --filter label=coolify.serviceName=pizza-party-db) \
     sh -c "psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB"' < "$SQL"

echo "==> 2/3  restarting the web container so Next drops its cached menu"
ssh -i "$KEY" "$SERVER" \
  'docker restart $(docker ps -q --filter label=coolify.serviceName=pizza-party)' >/dev/null

echo "==> 3/3  waiting for it to come back, then checking"
i=1
while [ "$i" -le 30 ]; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://pizzaparty.live/api/health || true)
  [ "$code" = "200" ] && break
  i=$((i + 1))
  sleep 5
done

echo
echo "--- image files ---"
for f in products/pepsi-can.jpg products/chicken-strips-wrap.jpg categories/wraps.jpg; do
  printf '  %-34s ' "$f"
  curl -s -o /dev/null -w '%{http_code}\n' --max-time 15 "https://pizzaparty.live/brand/$f"
done

echo
echo "--- what the apps will now be sent ---"
curl -s --max-time 30 https://pizzaparty.live/api/menu | node -e '
let d = "";
process.stdin.on("data", c => d += c).on("end", () => {
  const j = JSON.parse(d);
  let noCat = 0, noProd = 0, prod = 0;
  for (const c of j.categories) {
    if (!c.image) noCat++;
    for (const p of c.products) { prod++; if (!p.image) noProd++; }
  }
  console.log("  categories without an image: " + noCat + " of " + j.categories.length);
  console.log("  products   without an image: " + noProd + " of " + prod);
  console.log(noCat === 0 && noProd === 0
    ? "\n  DONE - every category and product has a photograph."
    : "\n  STILL MISSING - the deploy may not have finished; re-run this script.");
});'
