# Handoff — Pizza Party and Farm Pizza

Written 2026-09-08, end of the session that added Pizza Party as the platform's
second shop. Assume the reader knows nothing about that session.

---

## What this is

One repo, one codebase, many takeaways. Everything shop-specific lives in
`config/<slug>/`; there is no shop-specific code. One deployment serves one
shop, selected by `CLIENT_SLUG`.

Two shops exist:

| | Farm Pizza | Pizza Party |
|---|---|---|
| Slug | `farm-pizza` | `pizza-party` |
| Site | farm-pizza.shop | **pizzaparty.live** |
| Branch | `claude/launchflow-takeaway-template-lzuzx5` / `main` | **`pizza-party-tenant`** |
| Shop | Grays + Basildon, 2 branches | 162 Dock Road, Tilbury RM18 7BS, 1 branch |
| Menu | 7 categories, 68 products | 11 categories, 87 products, 10 deals |

The mobile app is a **separate repo**, `../farm-pizza-app`, and is white-label:
one codebase, one store listing per shop, chosen with `APP_TENANT`.

---

## Current state

### Websites

Both live. Pizza Party runs as a **proper Coolify application** — project
`pizza-party`, managed Postgres `pizza-party-db`, built from GitHub branch
`pizza-party-tenant`, domain `pizzaparty.live`. Push the branch and Coolify
deploys it.

> It was briefly deployed as a hand-rolled Docker Compose stack in
> `/opt/pizza-party` and migrated into Coolify on 2026-09-08. That directory
> still holds `secrets.env` (a backup) and `compose.yml.retired`. **Do not start
> it** — it would fight Coolify for the domain.

### Apps — production builds on test channels

Nothing is submitted for App Store or Play review. Deliberate: Shoji wants them
promotable on demand, not in review.

| | iOS (TestFlight) | Android (Play internal) |
|---|---|---|
| My Farm Pizza | build 14 | v6 |
| My Pizza Party | build 13 | v5 |

Pizza Party's App Store listing is **"My Pizza Party"** — Apple requires globally
unique names and both "Pizza Party" and "Pizza Party Online" were taken or
rejected. The home screen still says *Pizza Party* via `CFBundleDisplayName`.

Testers on both: `shujaat818@hotmail.com`, `wajih818@gmail.com`.

---

## Outstanding

1. **18 product photos + 3 category headers.** Full brief with exact filenames
   and dimensions in `docs/PIZZA-PARTY-PHOTOS-NEEDED.md`. These are also the
   blank thumbnails in the checkout "Goes well with" grid, which pulls product
   images.
2. **Stripe is on test keys.** `stripeEnabled()` will run a live shop on sandbox
   keys and every order will look paid while no money moves. Blocker before real
   trading.
3. **Prices are Just Eat's**, which run above the shop's own by an amount that is
   neither a fixed sum nor a percentage. Every one is listed in
   `config/pizza-party/PRICES-TO-CONFIRM.md` for the owner to check.
4. **Delivery zone is assumed** — RM18/RM17/RM16, £2.50 fee, £12 minimum.
5. **No staff accounts.** Pizza Party has no `ops.json`, so the database has zero
   staff. The admin password and kitchen PIN are the only ways in. Shoji supplied
   `zain@`, `aayan@`, `admin@`, `staff@pizzaparty.live` as mailboxes but no names
   or roles yet.
6. **Farm Pizza's animated splash is held back** on purpose while Shoji demos the
   app. One `eas update` when he says.
7. **`www.pizzaparty.live`** resolves and is on the certificate; worth confirming
   it still is after the Coolify migration, which rewrote the Traefik labels.
8. **The Google review link** uses place id `y0fJWPf4kGJg3v64R8Aq`, which is not
   the usual `ChIJ…` shape. Google returns 200 for a bad id so it cannot be
   verified remotely — Shoji was asked to tap it once.

---

## Where the credentials are

**Never in this repo.** `CLAUDE WORK/APP-BUILD-CREDENTIALS/README.md` holds
everything for Apple, Google Play and Expo, plus the traps, and is deliberately
outside every git repo. It also ships three working scripts:

| Script | Does |
|---|---|
| `asc-apps.mjs` | List App Store Connect apps and their ids |
| `enable-push.mjs` | Turn on Push Notifications for a bundle id |
| `testflight-release.mjs` | Actually release an uploaded build to testers |
| `play-check.mjs` | Prove a service account can publish to an app |

Pizza Party's own shop credentials — admin password, kitchen PIN, agency key,
SMTP, database — are on the server at `/opt/pizza-party/secrets.env` (chmod 600)
and were sent to Shoji as a file.

Server: `46.225.104.128`, root, `~/.ssh/hetzner_ed25519`.

---

## Things that cost hours, so they do not cost them again

**Coolify showing a white page is usually not a full disk.** Check
`curl -s -o /dev/null -w "%{http_code}" http://46.225.104.128:8000/` first — a
302 means Coolify is serving and the fault is elsewhere. It was a Laravel cache
compiled while the box was under pressure and surviving after. Fix:
`docker exec coolify php artisan optimize:clear`, then restart `coolify-db` and
`coolify`. **Never `coolify-proxy`** — that is Traefik and would drop every live
site.

**Building on that box is what fills it.** Each Next.js build leaves several GB
of builder cache. Housekeeping now prunes hourly. Batch changes into one deploy
rather than one deploy per tweak.

**Play Console's per-app service-account grant defeats browser automation** at
large window sizes — the clicks land in the wrong place. `resize_window` to
about 1400×950 first and it works. Verify the grant with `play-check.mjs`, never
from the UI.

**`EXPO_APPLE_TEAM_TYPE=COMPANY_OR_ORGANIZATION`** must be exported for iOS
builds, or a piped `y` picks "Enterprise" from a list prompt and Apple 403s with
a message that names nothing relevant.

**Enable push on the App ID before the provisioning profile is minted**, or
every build fails on a missing `aps-environment` entitlement and regenerating
the profile does not fix it.

**Once a shop is seeded, the database owns its menu.** `pnpm seed <slug>` will
report success and change nothing. Use `--overwrite-menu`, and restart the web
container afterwards — Next's data cache serves the old menu otherwise.

---

## Repos

| Repo | Branch | Remote |
|---|---|---|
| `PizzaParty` | `pizza-party-tenant` | github.com/launchflowuk-sys/PizzaParty |
| `farm-pizza-app` | `main` | github.com/launchflowuk-sys/farm-pizza-app |

Both pushed. `pizza-party-tenant` has never been merged to main — Farm Pizza
still deploys from its own branch, so merging needs thought about which branch
each Coolify application tracks.

## Design and specs

- `docs/superpowers/specs/2026-09-07-pizza-party-tenant-and-white-label-app-design.md` — the design, still accurate
- `docs/pizza-party-menu-source.md` and `docs/pizza-party-menu-raw.md` — where the menu came from
- `../farm-pizza-app/TENANTS.md` — how to add a third shop to the app
