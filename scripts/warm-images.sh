#!/bin/sh
# Encode every image variant before a customer asks for one.
#
# Next.js optimises images on demand: the first request for a given
# (image, width, format) runs the encode and caches the result. On this box an
# AVIF encode at 1200px takes about three seconds, so without this the first
# person to open each product page waits three seconds staring at a gap - and
# with seventy-odd products, that is most of the people browsing on the day of
# a deploy.
#
# The cache lives on a Docker volume so it survives a deploy. What it does not
# survive is a *new* photograph, or a change to the widths in next.config.ts -
# which is exactly when the shop looks slow again and nobody remembers why.
# Running this from the entrypoint means it fixes itself every time.
#
# Sequential on purpose. Two vCPUs also have to serve the site, and a parallel
# warm makes the shop slow in order to make the shop fast.

set -eu

BASE="${WARM_BASE_URL:-http://127.0.0.1:3000}"
SLUG="${CLIENT_SLUG:-farm-pizza}"
ASSETS="${CONFIG_DIR:-/app/config}/$SLUG/assets"
QUALITY=75

# Must match `deviceSizes` + `imageSizes` in apps/web/next.config.ts. A width
# that is not in that list is rejected by the optimiser, so warming it is a
# wasted request rather than a cached image.
WIDTHS="96 256 414 828 1200"

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -s -o /dev/null -H "Accept: $1" "$2"; }
else
  fetch() { wget -q -O /dev/null --header="Accept: $1" "$2"; }
fi

[ -d "$ASSETS" ] || { echo "[warm] no assets at $ASSETS, nothing to do"; exit 0; }

# Wait for the server rather than racing it. Every request that lands before
# it is listening is an image left cold.
i=1
until fetch "*/*" "$BASE/api/health" 2>/dev/null || [ "$i" -ge 60 ]; do
  i=$((i + 1))
  sleep 2
done

echo "[warm] warming image cache from $ASSETS"
start=$(date +%s)

# SVGs are served as-is and never go through the optimiser.
find "$ASSETS" -type f \( -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' -o -name '*.webp' \) | sort | while read -r file; do
  rel=$(printf '%s' "${file#"$ASSETS"/}" | sed 's|/|%2F|g')
  for w in $WIDTHS; do
    url="$BASE/_next/image?url=%2Fbrand%2F$rel&w=$w&q=$QUALITY"
    # Both formats: browsers that take AVIF get it, older Safari and Firefox
    # fall back to WebP, and a variant nobody warmed is a variant somebody waits for.
    fetch "image/avif,image/webp,*/*" "$url" || true
    fetch "image/webp,*/*" "$url" || true
  done
done

echo "[warm] done in $(($(date +%s) - start))s"
