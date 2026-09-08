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
| Branch | `main` | `main` |
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

1. ~~18 product photos + 3 category headers.~~ **Delivered 2026-09-08** and in
   `config/pizza-party/assets/`. All 87 products and 11 categories now have a
   photograph. The hero, banner and social card are still Farm Pizza's - see
   "Worth replacing when there is time" in `docs/PIZZA-PARTY-PHOTOS-NEEDED.md`.
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

Both pushed. **`pizza-party-tenant` was merged into `main` (fast-forward) on
2026-09-08 and both Coolify applications now track `main`.** That was the point:
a platform-level change lands on both shops from one push, rather than being
applied twice and drifting. The tenant branch still exists but is redundant -
work on `main`.

## Design and specs

- `docs/superpowers/specs/2026-09-07-pizza-party-tenant-and-white-label-app-design.md` — the design, still accurate
- `docs/pizza-party-menu-source.md` and `docs/pizza-party-menu-raw.md` — where the menu came from
- `../farm-pizza-app/TENANTS.md` — how to add a third shop to the app

---

## Next session: the design work, and the order to do it in

Agreed with Shoji on 2026-09-08. The back office is used by shop owners on big
screens and tablets and currently reads as a page of text links; the customer
ordering flow is good in the app and clunky on the web.

**Do the ordering flow first.** The back office is used by two or three people
who will learn any layout. A clunky topping picker costs orders every night, on
both shops. That is where the money is.

**The clunkiness has a specific cause.** The app groups and paces the modifier
groups; the website renders each one as a single flat list. On Pizza Party's
"any 4 toppings" that is 26 checkboxes followed by 26 more for extras. Both ends
already read the same modifier data from the same API, so this is purely
presentation - the web should adopt the app's model, not the reverse.

**On the back office, resist the obvious version.** Shoji's instinct was to turn
the text links into green, red and orange buttons. Colour is not the fix: if
everything is a coloured button then nothing is primary and the screen gets
noisier. The rule the storefront already follows should extend to the admin -
**red says things, green does things** - with one primary action per screen and
red reserved for destructive actions.

What actually makes a back office work on a tablet:

- 44px+ hit targets; it is operated with a finger, often a greasy one
- Real hierarchy: page title, one primary action, then the table
- Consistent row actions rather than links in assorted colours
- A white or near-white ground. Shoji is right that cream is wrong for dense
  tables. Add an admin surface **token** - never hardcode white, or the next
  shop cannot retheme it

**Keep Archivo.** A second typeface is a second design system to maintain, and
an admin that looks like a different product is worse than one that looks plain.

**Treat it as a design job, not a restyle.** Settle the button taxonomy, the
admin surface tokens and the picker interaction first, then build once across
web and app. Otherwise the drift the branch merge just removed comes back as
visual drift instead.

## One decision still open

**Farm Pizza's app has not been rebuilt.** Its TestFlight build 14 and Play v6
are both from 2026-09-06, before any of the white-label work, and it has not had
the animated splash. Pizza Party is fully current; Farm Pizza is not.

Rebuilding it is safe on the evidence - the merged code passes typecheck, lint,
16/16 tests, and Farm Pizza's resolved app config was verified identical key by
key to the `app.json` it replaced - but it had not been done at the end of this
session because Shoji was demoing that app and an unproven rebuild during a
demo is a bad trade. **Ask before rebuilding it.**

---

## The ordering flow: diagnosis, done 2026-09-08

Shoji's read is right - the app's option picker feels good and the website's
feels clunky - and the reason is four specific things, not taste. Read
`apps/web/src/components/product/OptionPicker.tsx` beside
`../farm-pizza-app/src/app/product/[slug].tsx` and it is obvious.

**The app has these. The web does not:**

1. **A sticky footer carrying the live running price.** Always on screen. On the
   web the price sits at the bottom, after the customer has scrolled past every
   control.
2. **Guidance when a required group is unanswered** - *"Choose base first"* -
   with the button disabled until the selection is valid.
3. **A hint on each group** - *"Choose 4"*, *"Up to 8"*.
4. **One uniform row component.** The web renders two visual systems: ruled
   radio rows for single-choice groups, wrapping chips for multi-choice. They
   read as different products on the same page.

**There is also a semantic bug.** The web gives a *selected* topping chip
`btn-primary`, which is the green "do the thing" colour. A selected topping is
not an action. That is why the screen feels noisy - it shouts fifteen calls to
action at once. Selected state belongs in the accent; green stays for the single
primary action.

### Parity is not the goal

The deeper problem is the size of the set. Pizza Party's "Pizza Party Special"
asks for **4 toppings from 26**, then offers **26 more** as extras - 63 controls
on one page. The app handles that better than the web and still not well.

**The design principle: choosing one base from three is a different task from
choosing four toppings from twenty-six, so the picker should adapt to the size
of the set.**

- **2-6 options** - ruled rows, all visible. Already fine.
- **10+ options** - a search field, the **popular six surfaced first** (most
  orders end there in one tap), the remainder grouped **Meat / Vegetables /
  Cheese & extras**, and a live counter reading *"2 of 4 chosen"*.
- **Required groups first**, visually distinct from optional.
- **A sticky bar at every breakpoint** - running total, validity, and what is
  still needed.
- Same interaction model on web and app, so they stop feeling like two products.

### The decision that was open when this session ended

Grouping toppings into Meat / Vegetables / Cheese needs that data to exist:

- **A presentation-only map in the web and app.** No schema change, works today,
  but every new shop needs its toppings categorised in code - which quietly
  makes shop three a developer's problem again.
- **A `category` field on `ModifierOptionSchema`.** Travels with the shop's own
  config, so any future shop gets it for nothing. More work now.

**Recommended: the schema field**, because this is a platform rather than one
shop. Shoji had not chosen when the session ended.

### Order of work

Ordering flow first, back office second - for the reasons in the section above.
Both shops now deploy from `main`, so one design pass covers both.

---

## The night of 2026-09-08, and what changed

Long session. Everything below is committed, pushed and either deployed or
waiting on one button.

### Shipped and verified live

- **21 photographs** - Pizza Party's last 18 products and 3 category headers.
  0 of 11 categories and 0 of 87 products are now without one, on the website,
  in the checkout grid and in both apps.
- **Both shops on the same commit**, website and app, for the first time.

### Built tonight, in the repo, waiting on a website deploy

- **Food icons.** Thirteen category drawings as path data, rendered two ways
  from one source: a colourful icon, and the same shapes flattened to a 4% tint
  for the background pattern. `src/theme/food-shapes.ts` in the app is the
  source of truth; `apps/web/src/theme/food-shapes.ts` is a verbatim copy and a
  test fails if they drift.
- **The club has a name.** `loyalty.name` in config. Farm Pizza is Crust Club,
  Pizza Party is Slice Hub, and loyalty is now on for both. The name was
  previously a literal in the header, footer, account page, rewards page, order
  email and mobile config API - so Pizza Party advertised Farm Pizza's club.
- **Shop-managed home-screen cards.** `PromoSlot`: a graphic, a price, a
  schedule, a pause switch, editable in the back office under the existing
  promos permission. The image is a bytea column, not a file, because
  `config/<slug>/assets` ships inside the Docker image and an upload written
  there disappears on the next deploy.
- **A home screen that sells.** Search, the shop's offers, a deals row and the
  categories, in place of one fixed picture. Already shipped over the air.
- **Campaign cost now includes the discount.** It used to mean the text
  messages only, so a £4 send that gave away £90 read as a £4 campaign.

### Two things that cost hours, so they need not again

**Coolify has no domain.** `APP_URL` is unset and it answers on a bare IP over
HTTP, which is why no GitHub webhook has ever existed and why nothing
auto-deploys. Fix: point a subdomain at `46.225.104.128`, set it as the
instance domain, then add a GitHub App source and switch both applications to
it. Until then every deploy is a button press.

**The housekeeping cron was deleting the build cache every hour**
(`--filter until=2h`), so essentially every deploy was a cold build and took
20-27 minutes. Raised to 168h; a backup of the old script sits beside it. Disk
was never the constraint - 70GB free at the worst point tonight.

**`eas submit` needs `APP_TENANT` set**, not just `--profile`. Without it the
CLI resolves the wrong project, picks the wrong build and the submission fails
in a way that reads like a fluke. Cost one wasted round trip.

### Still open

- Deals card redesign - agreed in principle, not built
- The topping picker - still 26 checkboxes, still the biggest money item
- Stripe is still on test keys
- Prices are still Just Eat's
