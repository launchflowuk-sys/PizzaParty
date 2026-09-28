# Onboarding a new takeaway client

How to take a new shop from "signed up" to "live on the till, the website and
the app" on this platform. One codebase, no shop-specific code — everything
that makes a shop different lives in `config/<slug>/`, selected at runtime by
`CLIENT_SLUG`. Two shops already run this way: `farm-pizza` (farm-pizza.shop)
and `pizza-party` (pizzaparty.live).

Written 2026-09-28 against branch `feat/pos`. Every command, env var, file
path and admin screen below is taken directly from the code — grep for it if
you want to double-check. Anywhere the answer isn't in the code (a Coolify
click, a DNS record, an Apple/Google screen) is called out and marked ⚠ where
it could not be verified from this repo.

**Test locally, then push to `main` and deploy from Coolify once you've
approved it on your own machine.** Nothing here auto-deploys — see §2.

---

## 0. What to collect from the client before starting

Get all of this before you open a terminal. Half the pain of onboarding is
starting §1 with half the answers.

**Business**
- [ ] Legal/trading name, cuisine type, one-line tagline
- [ ] Every address the shop trades from (branches → `locations[]`)
- [ ] Phone number(s) per branch
- [ ] Opening hours per day, per branch (including split hours, e.g. lunch/dinner)
- [ ] Domain name, and **who controls the DNS** (client's registrar login, or
      will they delegate/point records for you?)
- [ ] Mailbox(es) the shop will send/receive order mail from (e.g.
      `orders@theirdomain.co.uk`) — SMTP host/port/user/pass for it, or access
      to create one
- [ ] Google Business Profile — does it exist, do they have login, what's the
      Google Place ID (see §8)

**Brand**
- [ ] Logo file(s) — vector (SVG/AI) preferred, PNG fallback at a decent
      resolution for app icon generation
- [ ] Brand primary + secondary colours (hex). If not chosen, pull from the logo.
- [ ] A hero/banner photo for the website and app home screen
- [ ] Photography style preference: full colour, or the platform's optional
      grayscale treatment (`brand.photoStyle`)

**Menu**
- [ ] Full menu: category → item → description → size(s) → price(s)
- [ ] Modifier/option groups (toppings, sides, sauces) with min/max choices
      and prices
- [ ] Any meal deals: what's in each slot, what the bundle costs
- [ ] Photos per product, or per category, if they have them (real photos
      outperform generated ones for a local takeaway — see `docs/runbook.md`)
- [ ] Allergen info per product

**Delivery**
- [ ] Which postcode districts they deliver to (e.g. `RM16, RM17, RM18`)
- [ ] Delivery fee, minimum order — and whether it varies by area (delivery
      bands, see §1)
- [ ] Collection-only items, if any

**Payments**
- [ ] Do they want a Stripe account, or do they already have one? (See §3 —
      there is **no in-app Stripe onboarding flow**; this is done in the
      Stripe Dashboard.)
- [ ] Cash on collection / cash on delivery — on or off

**Staff**
- [ ] Names, phone numbers, and the role each person needs: `manager`,
      `shift_lead`, `kitchen`, `driver`, `front_of_house` (§4 explains what
      each role can open)

**Hardware / phone**
- [ ] Printer model (thermal receipt printer — does it speak CloudPRNT, or
      does it need a bridge? See §5)
- [ ] Tablet(s) for the till, and whether a second screen/tablet exists for
      the customer-facing display
- [ ] Phone line type: **landline** (needs a USB caller-ID box) or **VoIP**
      (Twilio, sipgate, a hosted PBX like 3CX/Yeastar) — and which provider,
      if VoIP

**Marketplaces**
- [ ] Do they already trade on Just Eat / Deliveroo / Uber Eats? Account
      details, if so — these go through Deliverect (§7), which needs its own
      partner approval per platform

**Mobile apps (optional)**
- [ ] Do they want their own branded app, or are they happy under the
      platform's shared listing? If their own: do they have (or will they
      pay for) their own Apple Developer Program and Google Play Console
      accounts, or does this run under LaunchFlow's? (§9)

---

## 1. Create the client config and menu

Everything shop-specific is a folder: `config/<slug>/`. Nothing here touches
the database yet — this step only produces files to review.

### 1.1 Scaffold it

```bash
pnpm new-client --slug=tandoori-nights --name="Tandoori Nights" \
  --domain=tandoorinights.co.uk --cuisine=Indian --locality="Grays,Tilbury" \
  --primary=#D97706 --secondary=#111318 --phone="01375 000000" \
  --postcodes=RM16,RM17 --fee=2.50 --min=12
```

(`scripts/new-client.ts`. Run with no flags and it prompts interactively if
your terminal is a TTY; without a TTY every flag needs a value or it takes
the shown defaults.) This creates:

```
config/<slug>/
  client.json         # shop identity, brand, locations, payments, SEO
  menu.json            # categories, modifier groups, products, deals, promos
  assets/logo.svg       # a placeholder monogram — replace it
  assets/hero.svg, og.svg  # copied from farm-pizza's as placeholders
  copy/<locality>.md    # one SEO landing page stub per locality
  products.csv.example  # a sample for the CSV importer, see 1.3
```

### 1.2 Fill in `client.json`

Full field list is `ClientSchema` in `packages/config/src/schema.ts`
(mirrored for editor autocomplete at `config/_schema/client.schema.json`,
referenced by `client.json`'s own `$schema` key — regenerate it after a
schema change with `pnpm tsx scripts/gen-schema.ts`). The fields that matter
most for a new client:

- `legacyDomains[]` — any domain that should 301 to the canonical `domain`
  (used later in Coolify, §2.4)
- `locations[]` — one entry per branch: `id`, `name`, `address`, `phone`,
  `timezone` (default `Europe/London`), `postcodePrefixes[]`, `deliveryFee`,
  `minOrder`, `prepMinutes`, `deliveryMinutes`, `hours` (per day,
  `["16:00","23:00"]`, or `[]` for closed, or an array of ranges for a split
  shift), and optionally `deliveryBands[]` for postcode-specific fees and
  minimums
- `payments.stripeAccountId` — leave blank unless you are deliberately using
  Stripe Connect (see §3 — both live shops currently run with this blank,
  charging straight to the platform's own Stripe account)
- `notifications.kitchenEmail`, `kitchenSms`, `printerWebhook`,
  `reviewDelayMinutes` — where a new order's alerts go (§5, §8)
- `loyalty.name` — the club's name for this shop (Farm Pizza: "Crust Club",
  Pizza Party: "Slice Hub"). It appears in the header, footer, order email and
  rewards page — don't leave the default "Rewards" if the client wants a
  branded name.
- `pos.eatIn` — turn on "Eat in" with a table number **on the till only**;
  the website and app never offer it regardless of this flag

### 1.3 Fill in `menu.json` — or drop a CSV

Either edit `menu.json` directly (`MenuSchema`, same file), or drop a
`products.csv` (no `.example` suffix) into `config/<slug>/` — it's picked up
automatically by the config loader (`packages/config/src/load.ts`) and merged
in via `productsFromCsv()` (`packages/config/src/csv.ts`). Columns
(case-insensitive): `category, name, description, size, price, slug?,
modifier_groups?, tags?, allergens?, featured?, image?`. One row per size; a
row with no `size` becomes a single "Regular" size. Modifier groups, tags and
allergens are `|`- or `;`-separated. The CSV only creates *products and
categories* — modifier groups, deals and promos still need to be added to
`menu.json` directly (a product's `modifierGroups: []` list just needs to
reference IDs that exist there).

If pulling a menu off a marketplace listing (Just Eat etc.), see the memory
note **"Pulling a takeaway menu off Just Eat"** — the whole menu sits in
`__NEXT_DATA__` on the listing page — and `scripts/import-real-menu.py` for a
worked (if shop-specific) example of turning a scraped listing into
`menu.json`. **Marketplace prices run above the shop's own** — don't ship
Just Eat's prices as the website's without asking the owner first
(`config/pizza-party/PRICES-TO-CONFIRM.md` is the paper trail from the last
time this happened).

### 1.4 Validate before touching anything else

```bash
pnpm validate-config <slug>      # one client
pnpm validate-config              # every client folder
```

(`scripts/validate-config.ts`, backed by `loadClientConfig` /
`loadMenuConfig` and the cross-reference checks `validateMenuRefs` /
`validateClientRefs` in `packages/config/src/schema.ts` — catches things zod
alone can't, like a product pointing at a modifier group that doesn't exist,
a duplicate size on one product, or a delivery-enabled location with no
postcode prefixes.) **Done when:** it prints `✔ <slug>: N locations, N
categories, N products, N deals` with zero `✖` lines.

---

## 2. Server: Coolify, database, domain, deploy

Reference: `docker/coolify.md` (the canonical short version of this section),
`docker/Dockerfile`, `docker/entrypoint.sh`.

### 2.1 Database

Coolify → **Databases → New → PostgreSQL 16**. Name it `<slug>-db`. Copy its
**internal** connection string — that's the `DATABASE_URL` value for step 2.3.
Never expose the database port publicly (neither existing shop does).

### 2.2 Application

Coolify → **New Resource → Docker (Dockerfile)**.
- Repository: this repo (`launchflowuk-sys/PizzaParty`), branch `main`
- Dockerfile path: `docker/Dockerfile`
- Build arg: `CLIENT_SLUG=<slug>` — this has to match the `CLIENT_SLUG` env
  var in step 2.3, or the image is built for one shop and runs as another.

What the build actually does (`docker/Dockerfile`, for when it goes wrong):
multi-stage — installs the whole pnpm workspace, generates the Prisma client,
builds the Next.js standalone output, then a slim runner image that carries
`apps/web/.next/standalone`, the full `node_modules` + `packages/` (needed
because the boot-time migrate/seed run the Prisma CLI and `tsx`, not just the
compiled server), `config/`, `content/` (help-centre articles — a *sibling*
of `config/`, not nested inside it, so `CONFIG_DIR` can't reach it; missing
this in a custom build ships an empty help centre with no error), and
`scripts/`. Healthcheck: `GET /api/health` every 30s.

### 2.3 Environment variables

Set these in Coolify → the application → **Environment Variables**. Source of
truth: `.env.example` (repo root) and `apps/web/src/lib/env.ts`.

| Variable | Required? | What it does |
|---|---|---|
| `CLIENT_SLUG` | **required** | Which `config/<slug>` to load. Must match the build arg. |
| `NEXT_PUBLIC_SITE_URL` | **required** | Canonical origin, no trailing slash. Baked in at **build time** — changing it needs a redeploy, not just a restart. Drives canonical tags, sitemap, OG images, SMS links, order-tracking links. |
| `DATABASE_URL` | **required** | Postgres connection string from step 2.1. |
| `DATABASE_URL_DIRECT` | optional | A direct (non-pooled) connection, used only by the SSE/realtime layer's `LISTEN/NOTIFY` client (`apps/web/src/lib/realtime.ts`). Falls back to `DATABASE_URL` if unset — only set this if a connection pooler (e.g. PgBouncer) ever sits in front of the database, since `LISTEN` needs a direct session. |
| `STRIPE_SECRET_KEY` | for card payments | `sk_live_…` (or `sk_test_…` while testing). Powers both online checkout and the till's card reader — see §3. |
| `STRIPE_WEBHOOK_SECRET` | for card payments | `whsec_…` from the Stripe webhook endpoint, §3.3. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | for online card checkout | `pk_live_…`. Baked in at build time like `NEXT_PUBLIC_SITE_URL`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | for email | The shop's own mailbox, or any SMTP host. No sending-API vendor. Port 465 = implicit TLS, 587 = STARTTLS. |
| `SMTP_SECURE` | optional | Overrides the TLS auto-detection from the port. |
| `MAIL_FROM` | for email | e.g. `"Tandoori Nights <orders@tandoorinights.co.uk>"`. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | for SMS | A UK Twilio number (needs a registered address, can take a day or two). `TWILIO_AUTH_TOKEN` also verifies the inbound `/api/sms/inbound` webhook (Reply STOP) and, if caller ID is on Twilio, its call-status webhook signature — set it even before you're sending SMS. |
| `GOOGLE_PLACES_API_KEY` | optional | A Places API (New) key. Blank = Google-review features stay off; reviews left on the site still work. |
| `KITCHEN_PIN` | **required** for kitchen sign-in | A single shared PIN for `/kitchen` — distinct from individual staff PINs (§4). |
| `ADMIN_PASSWORD` | recommended | The shop's shared owner password. Blank disables that login path entirely (safe). Generate with `node -e "console.log(require('crypto').randomBytes(21).toString('base64url'))"`. |
| `LAUNCHFLOW_KEY` | recommended | Your own (agency) access key — same generation command. |
| `SESSION_SECRET` | **required in production** | Signs every session cookie. Empty is fatal on purpose once `NODE_ENV=production`. |
| `CRON_SECRET` | for scheduled tasks | Bearer token the three cron endpoints check (§8). |
| `CALLERID_TOKEN` | optional (till item 28) | Empty = the `/api/pos/callerid` webhook 404s. Long random token, same generation command. |
| `CALLERID_FORWARD_TO` | optional | Only set if this webhook is also Twilio's "A call comes in" URL — forwards the call to this number. See §6. |
| `DELIVERECT_SECRET` | optional (marketplaces) | Empty = both Deliverect endpoints 404. Switches order-in on. |
| `DELIVERECT_MENU_TOKEN` | optional | Bearer token for the menu export endpoint (kept separate from `DELIVERECT_SECRET` so the order-signing secret never sits in a URL). |
| `DELIVERECT_API_BASE` | optional | `https://api.staging.deliverect.com` or `https://api.deliverect.com`. Needed for status push-back (accepted/ready/etc. back to the marketplace). |
| `DELIVERECT_CLIENT_ID` / `DELIVERECT_CLIENT_SECRET` | optional | OAuth client-credentials for status push-back. |
| `DELIVERECT_AUDIENCE` | optional | OAuth audience; blank defaults to `DELIVERECT_API_BASE`. |
| `DELIVERECT_CHANNELS` | optional | `"2=deliveroo,7=ubereats,10=justeat"` — blank uses that same default. Only Deliveroo's `2` is Deliverect-documented; confirm the others once the account exists. |
| `DELIVERECT_LOCATIONS` | optional | `"<deliverect location id>=<our location key>,…"`; blank = first location. |
| `DELIVERECT_DEFAULT_SOURCE` | optional | Where an unrecognised channel's orders get filed (default `deliveroo`) — still taken, just flagged. |
| `DELIVERECT_ACCOUNT_ID` / `DELIVERECT_LOCATION_ID` | optional | Echoed into the menu export as-is. |
| `PUSH_DRY_RUN` | optional | Forces push notifications to log-only. Defaults to dry-run outside production — set `PUSH_DRY_RUN=0` deliberately if you want a dev box to really send. |
| `SEED_ON_BOOT` | optional, entrypoint-only | Default `true`. Set `false` to skip the automatic seed on container start. |
| `DB_WAIT_ATTEMPTS` / `DB_WAIT_DELAY` | optional, entrypoint-only | How long the entrypoint retries `prisma migrate deploy` against a not-yet-ready database (default 30 attempts × 2s). |
| `WARM_IMAGES` | optional, entrypoint-only | Default `true`. Pre-encodes every product image into AVIF in the background on boot (`scripts/warm-images.sh`) so the first customer isn't the one paying the encode cost. |

⚠ Local-only, **not** a Coolify variable: `docker/.env.example` has
`WEB_PORT` / `DB_PORT` for `docker/compose.yml` (local dev stack only — port
remaps if 3000/5432 are already taken on your machine).

### 2.4 Domain, DNS, certificate

- Coolify → the application → **Domains**: add the primary `domain`, `www.`
  + every `legacyDomains[]` entry from `client.json`. The app 301-redirects
  www and legacy hosts to the canonical domain itself — you don't need
  separate redirect rules.
- DNS: point the domain's `A` (and `AAAA` if used) record at the server.
  ⚠ **Ask the client who controls DNS** before you start (§0) — if it's
  Cloudflare-proxied, existing shops run **SSL/TLS mode "Full (strict)"**;
  if the client's registrar is somewhere else, the equivalent is "the origin
  serves a valid cert and you're not doing SSL termination at the edge
  yourself."
- Let Coolify/Traefik issue the certificate, then check `https://` loads
  before moving on.
- **Do not touch existing mail (MX) records** when pointing a domain at the
  new site — moving the website never moves the mailboxes.

### 2.5 Deploying — and the trap

Push to `main`. **That alone does not deploy.** Two ways it actually ships:

1. **Manual (works today, every time):** Coolify → the application →
   **Deploy**. ~10 minutes on a small (2 vCPU) box — the Next.js build is
   CPU-bound.
2. **Automatic, only once wired up:** "Auto deploy" being switched on in
   Coolify is not enough by itself if the application was created from a
   **deploy key** rather than a **GitHub App** — nothing on GitHub's side
   calls the webhook, so the toggle sits on doing nothing. Wire it up by
   copying the application's webhook URL from Coolify (**Application →
   Webhooks**) and adding it under the repo's **Settings → Webhooks** on
   GitHub. ⚠ Per this project's own working notes, the webhooks exist on
   both existing shops but are **deliberately disarmed** pending a server
   resize — verify current status in Coolify before assuming a push will
   deploy itself.

If the Coolify panel's public port is unreachable, deploy through the Coolify
API from inside the server over SSH (the API listens on `127.0.0.1:8000`).
The API token for each Coolify box is in `PizzaParty/.env` as
`COOLIFY_API_TOKEN` (never paste it anywhere else):

```bash
ssh -i ~/.ssh/hetzner_ed25519 root@46.225.104.128   "curl -s -X POST -H 'Authorization: Bearer <COOLIFY_API_TOKEN>'    'http://127.0.0.1:8000/api/v1/deploy?uuid=<application uuid>&force=false'"
```

It answers with a `deployment_uuid`; poll
`GET /api/v1/deployments/<deployment_uuid>` until `status` is `finished`.
The application uuid is on the app's page in Coolify (Pizza Party's is
`5fdryyokmhaam9v3yersgyl6`). Deploy one shop at a time on the small box.

**Housekeeping:** each build leaves several GB of builder cache; either batch
several changes into one deploy, or make sure a pruning cron exists on the
box (`docker builder prune -af --keep-storage 6GB`, `docker image prune
-af`), or a full disk will 503 the whole site (Postgres can't write its lock
file). See §11.

### 2.6 Migrations and seeding — automatic on boot

`docker/entrypoint.sh` runs on every container start:
1. `prisma migrate deploy` (retries against a not-yet-ready database)
2. If `SEED_ON_BOOT` isn't `false`: `tsx scripts/seed-client.ts $CLIENT_SLUG`
   — failure is logged but does **not** stop the container
3. If `WARM_IMAGES` isn't `false`: `scripts/warm-images.sh` in the background

**A half-applied migration blocks startup.** If the log loops on a Prisma
`P3009` error, the fix is to mark that migration resolved once the schema is
genuinely correct (`prisma migrate resolve --applied <name>`) — never delete
migration rows to make the error go away.

**The seed does not touch an existing menu.** `seedClient()`
(`packages/db/src/seed-client.ts`) seeds the menu **once**; after that the
database — i.e. what the owner edits in the back office — owns it. Config
only supplies the *opening* menu. To deliberately re-import config over a
shop's own edits: `pnpm tsx scripts/seed-client.ts <slug> --overwrite-menu`
(destructive, and **restart the web container afterwards** — Next's data
cache otherwise keeps serving the old menu). `--reset` deactivates menu rows
no longer present in config without touching order history.

### 2.7 Verify

- `GET https://<domain>/api/health` → `{ ok: true, client: "<slug>", seeded:
  true, configHash: "…" }`. `seeded: false` means the seed never ran or
  failed — check the container logs.
- `/admin/launchflow` (sign in with the agency key or admin password, §4) —
  the built-in status page: seeded state + config hash, Stripe configuration,
  every domain's HTTP check, and any blocker it can see (e.g. "No Stripe
  keys — card payments do not work. Cash orders still do.").

**Done when:** `/api/health` is green, `/admin/launchflow` shows no
blockers you haven't consciously accepted, and the site loads on the real
domain over `https://`.

---

## 3. Payments (Stripe)

### 3.1 The account — manual, outside the app

⚠ **There is no in-app Stripe Connect onboarding flow in this codebase** —
no account-creation or account-links code exists (`apps/web/src/lib/stripe.ts`
only wraps an already-existing key/account). Two ways to run a shop:

- **Simplest (what both live shops currently do):** leave
  `payments.stripeAccountId` blank in `client.json`. All charges go straight
  to the platform's own Stripe account, using the platform's
  `STRIPE_SECRET_KEY`.
- **Stripe Connect (direct charges on the shop's own account):** create the
  connected account yourself in the **Stripe Dashboard → Connect → Add a
  connected account** (Standard or Express), complete or have the client
  complete its own onboarding there, then paste the resulting `acct_…` id
  into `config/<slug>/client.json` → `payments.stripeAccountId`. Every
  Stripe call in this codebase (`connectOpts()` in `lib/stripe.ts`) already
  passes `{ stripeAccount: … }` when that field is set — no code change
  needed, just the config value and a completed onboarding.

Cash on collection / cash on delivery are config flags
(`payments.cashOnCollection`, `payments.cashOnDelivery`) and work with no
Stripe keys at all.

### 3.2 Keys

Coolify → the application → Environment Variables (§2.3):
`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`. Use `sk_test_…` / `pk_test_…` while testing, switch
to `sk_live_…` / `pk_live_…` only when the client is ready to take real
money — `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is baked in at build time, so
switching from test to live needs a **redeploy**, not just an env change.

**Paste live keys into Coolify yourself. Don't send them in chat or email.**

### 3.3 Webhook

Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
`https://<domain>/api/stripe/webhook`. Subscribe to exactly these events
(`apps/web/src/app/api/stripe/webhook/route.ts` — anything else is ignored):

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `refund.updated`
- `refund.failed`
- `charge.refund.updated`

(The last three were added for the till's refund flow — see
`docs/POS-PLAN.md` "Before it goes live" — make sure they're on the endpoint
even if it was set up before the till existed.)

### 3.4 The till's card reader needs only the secret key

`stripeServerEnabled()` (`lib/stripe.ts`) is deliberately separate from
`stripeEnabled()` (which also needs the publishable key): a shop can take
card payments at the counter with only `STRIPE_SECRET_KEY` set, without
switching on online card checkout on the website/app.

Register a physical reader with `scripts/pos-terminal.ts`:

```bash
# Test mode: creates a Terminal Location from config + a simulated WisePOS E
pnpm tsx scripts/pos-terminal.ts <slug> --simulated

# Real hardware: the pairing code shown on the reader under
# Settings → Generate pairing code
pnpm tsx scripts/pos-terminal.ts <slug> --code=word-word-word --label="Counter"

# See what's registered
pnpm tsx scripts/pos-terminal.ts <slug> --list

# Test mode only: "tap" a simulated card on a simulated reader
pnpm tsx scripts/pos-terminal.ts <slug> --present=tmr_xxx
```

Reads `STRIPE_SECRET_KEY` from the environment or a local `.env`. The
Terminal Location is created once (from the first location's address in
`client.json`) and reused on later runs. Supported readers: **WisePOS E**
or **S700** (internet-connected readers — the script registers either the
same way, via the pairing code they display).

**Done when:** `--list` shows the location and the reader with status
`online`, and — in test mode — `--present` completes a simulated payment
that shows up as a paid order on the till.

---

## 4. Staff and access

One login endpoint, `POST /api/admin/login` (`apps/web/src/app/api/admin/login/route.ts`),
three ways in, checked in this privilege order:

1. **`LAUNCHFLOW_KEY`** — agency access. Signs in as a manager named
   "LaunchFlow" and also grants the kitchen cookie.
2. **`ADMIN_PASSWORD`** — the shop's shared owner password. Signs in as a
   manager named "Owner", also grants the kitchen cookie. This predates
   per-person sign-in — treat it as the owner's own master key.
3. **A staff PIN** (4–8 digits) — looked up by its salted hash against
   `Staff.pinHash` for this shop, signs that person in **as their own role**,
   so permissions are actually enforced rather than just displayed. If their
   role can reach the kitchen screen, they get that cookie too (no second
   login).

Every attempt gets the same ~300ms delay regardless of path, so a wrong PIN
can't be told from an unknown one by timing.

### 4.1 Roles and what each can open

`apps/web/src/lib/permissions.ts` — one matrix used by the sidebar, the page
guards and the server actions, so they can't disagree.

| Role | Screens it can open |
|---|---|
| `manager` | **everything** (granted implicitly — a new screen can never accidentally lock a manager out) |
| `shift_lead` | dashboard, kitchen, orders, dispatch, inventory, hours, reviews, help, till, reports |
| `kitchen` | kitchen, help |
| `driver` | kitchen, dispatch, help |
| `front_of_house` | dashboard, kitchen, orders, help, till |

Screens live at `/admin/<screen>` except: `dashboard` → `/admin`, `kitchen` →
`/kitchen`, and both `pos` and `reports` → `/pos` (reports and the cash
drawer are worked from inside the till). A role denied a page is sent to the
first screen it *can* open (`landingFor()`), not bounced back to `/admin` —
that would loop forever for anyone who can't see the dashboard.

### 4.2 Setting up real staff

Two ways:

- **At seed time**, via `config/<slug>/ops.json`'s `staff[]` array (`name`,
  `role`, `phone`, `hoursWeek`, `onShift`, optional `pin`). A `pin` here is
  only ever applied **on first creation** of that staff row
  (`packages/db/src/seed-client.ts`) — re-seeding never resets a PIN someone
  already changed. If you leave `pin` out, that person has no usable PIN
  until set from the back office. ⚠ `ops.json` is explicitly documented in
  its own `_comment` field as build-stage sample data — replace the seeded
  stock/staff/reviews with the real shop's before go-live, not after.
- **From the back office**, `/admin/staff` (`staff-actions.ts`):
  **Staff → Add somebody** (name, role, phone, email, PIN), and **set/change
  a PIN** on an existing person at any time. Rules enforced server-side:
  4–8 digits only, rejects an obvious/weak PIN (`0000`, `1234`, `1111`…, see
  the `WEAK` set in `staff-actions.ts`), rejects a PIN already in use by
  someone else at the same shop, and once set **cannot be recovered** —
  only replaced (stored only as a salted hash, `sha256(clientId:pin)`).
  Someone leaving is **deactivated**, not deleted — their PIN stops working
  immediately but their name stays attached to the orders and shifts they
  already have.

### 4.3 Kitchen PIN

`KITCHEN_PIN` is a **single shared PIN** for `/kitchen`
(`apps/web/src/app/api/kitchen/login/route.ts`) — a different concept from
individual staff PINs, meant for a shared kitchen tablet nobody needs to sign
out of. Set it in Coolify env vars (§2.3).

**Done when:** the admin password and `LAUNCHFLOW_KEY` are real (not blank
or shared-in-a-chat placeholders — see §11's rotation note), every real
staff member has their own working PIN, the build-stage `ops.json` names are
gone from `/admin/staff`, and `KITCHEN_PIN` is set.

---

## 5. Shop hardware

### 5.1 The till — `/pos`

Full-screen, no storefront chrome, guarded by `requireScreen("pos")`
(`apps/web/src/app/pos/page.tsx`). Sign in with the same `/api/admin/login`
PIN flow as §4. Recommended setup:

- A tablet with a reasonably large screen (this is worked with a finger, not
  a mouse — every control targets ≥44–60px). Any modern tablet browser
  works; there's no native till app.
- Install it as a **PWA / add-to-home-screen**, opened full-screen (or launch
  the browser in kiosk mode) so it behaves like a dedicated device rather
  than a browser tab that can be swiped away.
- ⚠ The exact desk footprint was tested against a 1024×768 layout during
  development (`docs/POS-PLAN.md` "Before it goes live" #8 flags this as the
  one check not repeated on the final pass) — confirm the real tablet's
  resolution renders cleanly before go-live, not after.

### 5.2 Customer-facing display — `/pos/display`

`apps/web/src/app/pos/display/page.tsx` + `PosDisplayClient`. **Any screen
works**: a second monitor on the till computer, or a separate tablet/TV facing
the customer on the shop's Wi-Fi.

- **Second monitor on the till computer:** till top bar → **Customer display**
  → **Open on this computer**, then drag the window onto the monitor and make
  it full screen (F11).
- **Separate tablet or screen:** till top bar → **Customer display** shows the
  address (`https://<shop domain>/pos/display`) with a **Copy** button. Open it
  on the tablet and sign in with a staff PIN. Use a **Kitchen**-role PIN (make
  a staff member such as "Counter display" with the Kitchen role): it can open
  the display and the kitchen queue, never the till or its actions, cash or
  reports. Put the tablet in kiosk/guided-access mode so customers cannot
  leave the page.

**Pairing.** Each till names itself (Cash & reports → Settings → **Till
name**, default "Till 1"; stored on that till). A display follows the only
till that is sending; if several are, it shows a full-screen "Which till is
this screen for?" list and remembers the choice on that device. To re-pick
later, tap the top-left corner of the display three times quickly.

How it moves: the till sends each change over `BroadcastChannel` (instant,
same browser) and to `POST /api/pos/display`, which relays it through the
live-updates channel to `GET /api/pos/display/stream` on every device. A
display that has just connected asks `GET /api/pos/display` for each till's
latest state. Nothing is sent while the till is offline; it catches up when
the internet is back. Branding, photos, the "You might also like" cards (top
sellers with photos, never what is already in the basket), today's deal and
the loyalty line (only when `loyalty.enabled`) come from config/menu.

### 5.3 Kitchen screen — `/kitchen`

Signs in with `KITCHEN_PIN` (§4.3), or is already signed in automatically if
someone signed into the till/admin with a role that can reach it. Auto-prints
on `markPlaced()` — no separate setup once the printer (below) is wired.

### 5.4 Receipt printer

Two paths, both driven from `notifications.printerWebhook` in `client.json`:

- **A printer with a CloudPRNT/webhook bridge:** point `printerWebhook` at
  it. `postPrinter()` (`apps/web/src/lib/notify.ts`) POSTs a JSON payload to
  that URL on every order placement; comment in the code names this as a
  **Star CloudPRNT / ESC-POS bridge** pattern — any printer/bridge that
  accepts a JSON POST and turns it into a ticket will do. Leave
  `printerWebhook` blank and this step is simply skipped (no error, no
  ticket sent that way).
- **Browser print (no networked printer, or as a fallback):** the kitchen
  screen's auto-print (`components/print/AutoPrint.tsx`) calls
  `window.print()` once every image on the ticket has loaded (or after a
  2.5s backstop, so a hung image request can't swallow the ticket). Whether
  this shows a print dialog or prints silently is entirely up to the
  browser: **Chrome started with `--kiosk-printing` prints straight to the
  default printer with no dialog** — that's the flag to launch the kitchen
  tablet's browser with if you want fully silent printing.
- `ChangeTicket.tsx` (`components/print`) is the same mechanism for a
  reprint of only the *changed* lines when a sent order is edited.

### 5.5 Stripe card reader — pairing

Covered in §3.4 (`scripts/pos-terminal.ts --code=…`). Physically: power the
reader, put it in pairing mode (**Settings → Generate pairing code** on the
device), run the script with that code, confirm it shows `online` in
`--list`.

### 5.6 Network and offline

The till, kitchen screen and customer display should share the shop's
Wi-Fi. Card payments, online orders and the live queue need the internet.
If it drops, the till switches to **offline mode** by itself (amber bar):
collection and eat-in orders paid in cash keep working, are saved on the
tablet, and send themselves when the connection is back; delivery, phone
lookup and the card reader wait for the internet. Each saved order carries a
request id, so it can never land twice.

**Done when:** the till signs in and takes a test order; the kitchen screen
receives and auto-prints it; the customer display (on its own tablet, if the
shop has one) shows the live basket; a
card test payment completes on the reader.

---

## 6. Caller ID

`docs/POS-PLAN.md` item 28. Two independent paths — pick whichever matches
the shop's phone line; a shop can also have neither switched on.

### 6.1 Option A — VoIP / SIP (recommended)

Works with **any** provider that can POST or GET a URL on an incoming call —
confirmed shapes in `apps/web/src/app/api/pos/callerid/route.ts`:

- **Twilio** — form POST with `From`, `To`, `CallSid`, `CallStatus`
- **sipgate**-style push API — form POST with `from` / `to` / `direction`
- Many hosted PBXs (generic) — form POST with any of `caller`, `callerid`,
  `cli`, `number`
- **JSON POST** — `{ "phone": "07...", "line": "Shop" }` or the same field
  names as above
- **GET with the number in the query** (`?number=` / `?from=` / `?caller=`)
  — for PBXs such as **3CX** or **Yeastar** whose "call a URL on incoming
  call" feature can only issue a GET

Setup:

1. Set `CALLERID_TOKEN` in Coolify env vars (§2.3) — a long random value,
   generate with `node -e "console.log(require('crypto').randomBytes(21).toString('base64url'))"`.
   Leaving it blank makes the whole endpoint 404.
2. Give the provider this URL:
   `POST https://<site>/api/pos/callerid?token=<CALLERID_TOKEN>`
3. **Twilio specifically:** set it as the number's **"Call status changes"**
   callback (not "A call comes in") so the call keeps ringing exactly as it
   does today — Twilio ignores whatever this endpoint replies with on that
   webhook. Set `TWILIO_AUTH_TOKEN` too; if set, every Twilio POST's
   `X-Twilio-Signature` is verified (signed over the full public URL,
   query string included) and a bad signature is rejected with 403.
4. **Only if** this same URL is also being used as Twilio's **"A call comes
   in"** webhook (i.e. this app is answering the call itself), set
   `CALLERID_FORWARD_TO` to the shop's real phone number — the reply becomes
   `<Dial>` to that number, so one URL both pops the till and puts the call
   through. Leave it blank for the normal case (status-callback only): the
   reply is an empty `<Response/>`, which would **end the call** if used as
   "A call comes in" by mistake — don't wire it that way unless
   `CALLERID_FORWARD_TO` is set.

Testing (fake number, no real call needed):

```bash
curl -X POST "https://<site>/api/pos/callerid?token=<CALLERID_TOKEN>" \
  -d "phone=07902810090&line=Shop"
```

A till signed in and open on `/pos` should show a caller-ID banner. The
lookup falls back gracefully — a withheld or unrecognised number still pops
up, just without a customer name attached.

Rate limits are built in and self-cleaning (`route.ts`): 30 requests/minute
per token, a separate 30/minute-per-source-IP limit on **wrong token**
guesses before the token is even compared, and the bad-guess address map
caps itself at 5,000 entries.

### 6.2 Option B — landline + USB caller-ID box

For a shop with no VoIP, a USB serial caller-ID box on the landline. Reads
via the **Web Serial API**:

- ⚠ **Chrome desktop only** — this will not work on Safari, Firefox, or any
  mobile browser (`useCallerId.ts` checks `navigator.serial` and shows "This
  browser cannot use a caller ID box — Chrome desktop only" otherwise).
- Box type: **Bellcore/BT-style FSK caller-ID box with a USB serial
  interface**, 1200 baud, 8N1 (`SERIAL_BAUD` in `useCallerId.ts`). The
  parser (`callerid-parser.ts`) reads the common line formats such boxes
  print — `NMBR=07902810090`, `CALL 07902810090`, or a bare digit string —
  and ignores everything else (`RING`, `DATE=`, `TIME=`, blank lines). ⚠ No
  specific box model is named or tested in this codebase — any box that
  speaks the standard FSK/DTMF caller-ID protocol over USB serial in one of
  those line formats should work; confirm with a real unit before promising
  it to a client.
- On the till: **Cash & reports → Settings → Connect caller ID box**.
  Chrome's own device picker opens (this is the browser's own permission
  prompt, not part of the app) — pick the USB device. Once granted, it
  reconnects automatically on future visits without asking again.
- Test: with the box connected, dial the shop's landline from any phone —
  the same banner should appear as the VoIP path.

**Done when:** whichever path you set up, ringing the shop's number from a
number the shop hasn't ordered from before shows a caller-ID banner with
just the number; ringing from a number that has ordered before also shows
the name and past order count.

---

## 7. Marketplaces (Just Eat / Deliveroo / Uber Eats) via Deliverect

`docs/POS-PLAN.md` item 31. All three marketplaces flow through **Deliverect**
as a single integration — this codebase never talks to Just Eat/Deliveroo/
Uber Eats directly.

### 7.1 What gets signed up

⚠ Outside the code: the client (or you, on their behalf) needs a Deliverect
**POS partner integration** account, and the shop's own Just Eat / Deliveroo
/ Uber Eats accounts linked to it inside Deliverect. Partner approval is
per-platform and outside this codebase's control.

### 7.2 Orders in

- `DELIVERECT_SECRET` switches the order-webhook on. Blank = it 404s.
  Deliverect signs the raw request body: HMAC-SHA256 keyed by the partner
  secret (on Deliverect's **staging** environment this secret is simply the
  channel-link id), sent as the `x-server-authorization-hmac-sha256` header
  — verified in `hmacValid()` (`apps/web/src/lib/deliverect.ts`), accepting
  either hex or base64 encoding of the signature.
- Give Deliverect this webhook URL:
  `POST https://<site>/api/integrations/deliverect/orders`

### 7.3 Menu export

- `DELIVERECT_MENU_TOKEN` gates it (kept separate from `DELIVERECT_SECRET`
  so the order-signing secret is never exposed in a URL).
- URL: `GET https://<site>/api/integrations/deliverect/menu` with
  `Authorization: Bearer <DELIVERECT_MENU_TOKEN>`.
- Built from the live menu (`menuExport()` in `lib/deliverect.ts`) — every
  product, size, and modifier group/option, plus every deal as a single
  bundle-priced item (a deal's internal choices are **not** modelled in the
  export; the kitchen just sees whatever the marketplace sent as free-text
  options for a deal line).

### 7.4 PLU scheme

Deliverect matches marketplace order lines back to our menu by PLU
(`deliverect-map.ts`):

| Kind | PLU format | Example |
|---|---|---|
| Product, one size | `<productSlug>` | `garlic-bread` |
| Product, a specific size | `<productSlug>@<sizeKey>` | `margherita@12` |
| Modifier/option | `mod:<groupKey>:<key>` | `mod:toppings:mushroom` |
| Deal | `deal:<dealSlug>` | `deal:family-feast` |

Anything that doesn't match is still taken — kept as a free-text line at the
marketplace's own price — and the order is flagged `needsAttention` rather
than silently dropped or rejected.

### 7.5 Status push-back

Also needs `DELIVERECT_API_BASE`, `DELIVERECT_CLIENT_ID`,
`DELIVERECT_CLIENT_SECRET` (OAuth client-credentials; `DELIVERECT_AUDIENCE`
optional, defaults to the API base). Without these three, order-in still
works, but every status change is logged as "Not sent" in the order's audit
trail rather than failing silently.

### 7.6 Linking each channel

`DELIVERECT_CHANNELS` maps Deliverect's numeric channel id to our source
name, e.g. `"2=deliveroo,7=ubereats,10=justeat"`. Blank uses that same
default. **Only Deliveroo's `2` is Deliverect-documented** in this codebase's
comments — confirm Uber Eats and Just Eat's actual channel numbers with
Deliverect once the account exists, and set `DELIVERECT_CHANNELS`
explicitly rather than trusting the guessed defaults. An order on an
unrecognised channel number is still taken and filed under
`DELIVERECT_DEFAULT_SOURCE`, flagged with a note.

`DELIVERECT_LOCATIONS` maps Deliverect's location id to our own location key
(`"<deliverect-id>=<our-key>,…"`); blank uses the shop's first location for
everything.

### 7.7 Open TODOs — confirm in Deliverect's sandbox before go-live

Straight from the code comments (`deliverect-map.ts`), because their
developer docs sit behind a bot-wall this repo's author couldn't read from
here — the shape was built against an open-source client of the same API
instead:

1. Exact channel numbers for Uber Eats and Just Eat (Deliveroo's `2` is
   confirmed; the others are placeholders)
2. How "our own driver" vs. "the platform's rider collecting" is actually
   flagged on a delivery order — currently inferred from
   `deliveryBy`/`courier.deliveryBy === "restaurant"`, everything else
   treated as the platform's rider
3. Money units/scaling — amounts are read as `decimalDigits`-scaled minor
   units (2 in the UK); `payment.amount` is taken as what the customer
   actually paid, `discountTotal` may arrive negative
4. Whether status `100`/`110` on a **re-sent** order genuinely always means
   "the platform cancelled it"
5. Tax field names/units on the menu export (currently sent as 20% VAT =
   `20000` in Deliverect's milli-percent units) and whether Deliverect
   actually pulls from this export URL or expects a push

**Done when:** a real test order placed on each marketplace's own sandbox/
test tools lands in the queue correctly priced, with matched product/option
names (not `needsAttention`), and an accept/reject from the queue reaches
Deliverect's status log.

---

## 8. Online presence

### 8.1 Website content / SEO

- `copy/<locality>.md` per locality (scaffolded in §1.1) — the on-page SEO
  copy and FAQ block for each landing page. Write it properly per locality
  rather than leaving the placeholder text.
- `client.json` → `seo.locality[]`, `seo.cuisine`, `seo.primaryKeyword`, and
  optionally `titleTemplate` / `homeTitle` / `homeDescription` if the
  defaults don't fit.

### 8.2 Google Business / reviews

- `contact.googlePlaceId` in `client.json` — find it at
  [Google's Place ID finder](https://developers.google.com/maps/documentation/places/web-service/place-id).
  Blank = Google-review features simply stay off; on-site reviews still work
  either way. ⚠ Google returns HTTP 200 for a *bad* place id too, so this
  can't be verified purely by hitting the API — actually open the resulting
  link once to confirm it's the right business.
- `GOOGLE_PLACES_API_KEY` — a Places API (New) key from a Google Cloud
  project. Note the platform limitation baked into the code: Google's API
  only ever returns **five** reviews, and there is no way to post a reply
  through it.
- Cron: `GET/POST /api/cron/google-reviews` pulls the shop's reviews —
  `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/google-reviews`.
  Daily is enough (Google returns the same five no matter how often you ask).

### 8.3 Email

Plain SMTP via Nodemailer (`apps/web/src/lib/notify.ts`) — **never** a
sending-API vendor, by deliberate choice (one less bill, one less account to
keep alive, and an unset key used to silently degrade to a dry run rather
than failing loudly). `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` (§2.3).
**Publish SPF and DKIM for the sending domain** — without them, receipts
land in spam and the shop only finds out when a customer says they never got
one. Until SMTP is configured, `sendEmail()` just logs `[email:dry-run]` and
reports success — meaning **campaigns will report as "sent" while
delivering nothing** if this step is skipped.

Cron: `GET https://<host>/api/cron/review-requests` (same Bearer auth) —
sends review-request SMS for orders completed more than
`notifications.reviewDelayMinutes` ago, and cancels abandoned
`pending_payment` orders older than 2 hours. **Hit this every 5 minutes.**

### 8.4 SMS

Twilio, same three env vars as §2.3/§6.1. Without them, `sendSms()` logs
`[sms:dry-run]` and reports success — same silent-failure trap as email.

Cron: `POST https://<host>/api/cron/automations` (same Bearer auth) — runs
every active marketing automation; each one carries its own cooldown and
per-run send cap, so running this more often than needed can't double-
contact anyone. Daily is plenty.

### 8.5 Push notifications

Sent through Expo's push service (`sendPush()`, `apps/web/src/lib/notify.ts`)
— relevant once the shop has its own app or uses the shared one (§9).
Deliberately **not** dry-run-by-default like email/SMS: if there are no
registered devices there's genuinely nothing to send, reported as "0 sent",
never mistaken for success. `PUSH_DRY_RUN=1` forces dry-run anywhere (useful
on a dev box that holds a copy of production's real customer push tokens);
`PUSH_DRY_RUN=0` lets a non-production box really send.

**Done when:** a test order sends a real order-confirmation email (not
`[email:dry-run]` in the logs) and a real kitchen alert; the three crons are
scheduled at the intervals above; SPF/DKIM pass on the sending domain (use
any free SPF/DKIM checker against `MAIL_FROM`'s domain).

---

## 9. Branded mobile apps (optional)

The mobile app is a **separate repository**, `../farm-pizza-app`
(`github.com/launchflowuk-sys/farm-pizza-app`) — one Expo codebase, one App
Store/Play listing **per shop**, selected by `APP_TENANT`. Full detail in
that repo's `TENANTS.md`; summarised here.

### 9.1 What's decided per shop, and where

- **Server-side (change any time, no rebuild):** the shop's real name, logo,
  hero image, phone number, opening hours, branches, whether card payment is
  live — all served from `GET /api/config/mobile` in *this* repo when the
  app launches.
- **Baked into the app binary (`tenants/<slug>.json`, needs a new build +
  App Store review to change):** the name on the home screen, the bundle
  identifier, the URL scheme, the icons, the splash colour, the onboarding
  slides, and the base URL.

Rule of thumb from `TENANTS.md`: if a shop should be able to change it
without asking a developer, it belongs on the server side, not in the tenant
file.

### 9.2 Adding a shop's app

1. `tenants/<slug>.json` in `farm-pizza-app` — copy an existing shop's file.
2. Register it in `app.config.ts`'s `TENANTS` map (one line — deliberately a
   static import, not a directory scan, so a typo fails immediately in your
   editor rather than silently building the default shop under the wrong
   name).
3. Icons: generate five PNGs from this repo,
   `node scripts/app-icons.mjs <slug> --logo=/path/to/logo.png`, which reads
   the shop's brand colour from `config/<slug>/`. Copy
   `config/<slug>/assets/app/{icon,favicon,splash-icon,android-icon-foreground,android-icon-background}.png`
   into `farm-pizza-app/assets/tenants/<slug>/`.
4. `APP_TENANT=<slug> eas init`, paste the resulting EAS project id into the
   tenant file. **Builds refuse to run without it** — this is deliberate, so
   a build with no project id can't silently upload against whichever
   project the CLI last remembered (which is exactly how one shop's binary
   has ended up in another shop's TestFlight before).
5. Add `<slug>-development`, `<slug>-preview`, `<slug>-production` build
   profiles and a submit profile to `eas.json` (they `extend` the Farm
   Pizza ones, three lines each).
6. Create the **App Store Connect** app and the **Play Console** listing,
   put the resulting `ascAppId` in both the tenant file and `eas.json`'s
   submit profile.

Local run / build commands:

```bash
npx expo start                              # default tenant (farm-pizza)
APP_TENANT=pizza-party npx expo start        # a specific shop, dev
eas build --profile <slug>-production
eas submit --profile <slug>-production       # APP_TENANT must ALSO be set here —
                                              # --profile alone resolves the wrong
                                              # project and fails in a way that
                                              # reads like a fluke
```

### 9.3 Apple Developer / Google Play accounts

⚠ Outside the code — either the client has (or buys) their own Apple
Developer Program membership and Google Play Console account, or the app
ships under LaunchFlow's own developer accounts. Decide this with the client
in §0, since it changes who can be added as a tester/reviewer and who
ultimately owns the listing.

### 9.4 Traps that have already cost real time on this project

- **`EXPO_APPLE_TEAM_TYPE=COMPANY_OR_ORGANIZATION`** must be exported before
  an iOS build, or a non-interactive `y` answer to the CLI's team-type
  prompt silently picks "Enterprise" from the list and Apple rejects the
  build with a 403 that names nothing relevant.
- **Enable Push Notifications on the App ID before the provisioning profile
  is minted**, or every build fails on a missing `aps-environment`
  entitlement, and *regenerating* the profile afterwards does not fix it —
  the App ID capability has to be turned on first.
- **A store reviewer tests against the live production server, not the
  build.** Anything that gates sign-in for review (a reviewer bypass
  account, etc.) has to be **deployed to production and verified there**
  *before* submission — a green local test proves nothing to Apple/Google.
  This project's own `apps/web/src/lib/reviewer.ts` is the working example:
  a fixed phone number + fixed OTP code for the app-store reviewer, since
  the reviewer can't receive a real UK SMS.
- **`eas submit` puts a build on TestFlight. That is not a release.** It
  does not reach a tester's phone until a separate release step runs
  (`APP-BUILD-CREDENTIALS/testflight-release.mjs` in this project's working
  notes — actually release an uploaded build to testers).
- **Play's own API cannot tell you whether an app is actually published.**
  A first submission can read as `production completed` from the API while
  the console still shows the app as **Draft** and in review — read the
  Play Console itself for real publishing status, not just the API.
- **Play Console's per-app service-account grant defeats browser
  automation at large window sizes** — clicks land in the wrong place above
  roughly 1400×950; resize the window down first if automating this step,
  and verify the grant landed via the API check script rather than trusting
  the UI.
- ⚠ Where working credentials, App Store Connect app ids and the actual
  helper scripts live: `CLAUDE WORK/APP-BUILD-CREDENTIALS/README.md`,
  deliberately kept **outside every git repository**. It also documents
  `asc-apps.mjs` (list App Store Connect apps), `enable-push.mjs` (turn on
  Push Notifications for a bundle id), `testflight-release.mjs` (release a
  build to testers), and `play-check.mjs` (prove a service account can
  publish to an app — use this to verify the Play grant instead of the UI).

**Done when:** the app builds and runs under `APP_TENANT=<slug>` locally,
both store listings exist with the shop's own name/icon/bundle id, a test
build has been through TestFlight/internal-testing **and released** (not
just uploaded), and — if sign-in is gated for review — the reviewer bypass
is live on production and was tested against the production domain before
submitting.

---

## 10. Go-live checklist and handover

### 10.1 Final test pass, in order

- [ ] `/api/health` green, `/admin/launchflow` shows no unresolved blockers
- [ ] Place a real test order on the **website** (card + cash if both are on)
- [ ] Place a real test order on the **app**, if the shop has one
- [ ] Place a real test order on the **till** (`/pos`) — collection, delivery,
      and (if used) phone order paths
- [ ] Take a **live** card payment on the physical Stripe reader for a small
      real amount, then **refund it** from the till/queue and confirm the
      refund shows correctly against Stripe (§3.3's three refund webhook
      events exist for exactly this)
- [ ] Confirm the kitchen ticket **auto-prints** on the real printer (not
      just the browser print dialog, unless that's the deliberate setup)
- [ ] Run an actual **end-of-day close** (`Cash & reports → Day report` on
      the till, manager role) against the day's test activity and check the
      numbers add up by hand once
- [ ] If caller ID is on: ring the shop's real number and confirm the banner
      appears on the till
- [ ] If marketplaces are on: place one real test order per platform through
      that platform's own sandbox/test tools
- [ ] Confirm SPF/DKIM pass for the sending domain and a real order
      confirmation email lands (not in spam)
- [ ] Live Stripe keys are in (not test keys) if the shop is trading for real
      money — see §3.2's "no accidental test-key launch" reminder

### 10.2 Handover to the client — 30-minute till training outline

⚠ Not scripted in the code — a suggested structure based on what the till
actually does:

1. **Sign in** (2 min) — their PIN, what happens if they mistype it a few
   times (nothing catastrophic for sign-in itself; only the *manager PIN
   prompt* for discounts/refunds locks out after 5 wrong tries for 15
   minutes, §11)
2. **Taking an order** (10 min) — order type bar, category rail, the pizza/
   product builder, basket, notes, a phone order end to end (type the
   number, see saved addresses/last orders, "Repeat last order")
3. **Getting paid** (8 min) — cash panel (quick amounts + change due), the
   card reader, split payment, "pay later" for a phone order
4. **The queue and the kitchen screen** (5 min) — where an online/app/
   marketplace order shows up, accept/reject, assigning a driver
5. **End of day** (5 min) — opening float, pay-ins/pay-outs, closing the
   drawer, reading the day report

**Done when:** the checklist above is fully ticked, and someone other than
you has successfully taken and paid for an order on the till without asking
for help.

---

## 11. Troubleshooting quick table

| Symptom | Likely cause | Fix |
|---|---|---|
| Coolify shows a white page | Usually **not** a full disk — a poisoned Laravel cache | `curl -s -o /dev/null -w "%{http_code}" http://<server-ip>:8000/` first; a `302` means Coolify itself is fine and the fault is elsewhere. `docker exec coolify php artisan optimize:clear`, then restart `coolify-db` and `coolify`. **Never restart `coolify-proxy`** — that's Traefik and would drop every live site on the box. |
| Whole site 503s | Full disk — Postgres can't write its lock file and crash-loops | `df -h /`, `docker system df`, then `docker builder prune -af --keep-storage 6GB` and `docker image prune -af` (both safe — the second keeps anything currently running). |
| Container loops on startup, log shows `P3009` | A half-applied migration | Mark it resolved once the schema is actually correct (`prisma migrate resolve --applied <name>`) — never delete migration rows to make the error disappear. |
| Product images load slowly on every deploy | The AVIF image cache volume came up root-owned | Confirm the volume at `/app/apps/web/.next/cache/images` is writable by uid 100 (`app`) — the Dockerfile pre-creates the directory specifically so Docker seeds the volume with the right ownership; a custom build that skips this silently turns caching off with no error anywhere. |
| Re-seeding a shop "succeeds" but the menu doesn't change | Once seeded, the **database** owns the menu, not config | Use `pnpm tsx scripts/seed-client.ts <slug> --overwrite-menu` deliberately, then **restart the web container** — Next's data cache otherwise keeps serving the stale menu even after the DB changes. |
| Push to `main`, site doesn't update | No GitHub webhook wired to Coolify (deploy key origin, not GitHub App), or the webhook exists but is disarmed | Coolify → application → **Deploy**, manually, until §2.5's webhook wiring is confirmed live. |
| Manager PIN prompt (discount/refund/void) refuses a correct-looking PIN | 5 wrong attempts in the last 15 minutes locks that till-session out of manager approvals for 15 minutes (`PIN_MAX_FAILS` / `PIN_LOCK_MS`, `apps/web/src/lib/pos.ts`) | Wait out the 15 minutes, or have a different manager approve it — this lockout is **per asking-staff-member**, not global. This is separate from the general staff/admin sign-in, which has no such lockout. |
| `/api/pos/callerid` returns 404 | `CALLERID_TOKEN` is unset | Set it in Coolify env vars (§6.1) — blank is a deliberate "off" switch, not a bug. |
| `/api/integrations/deliverect/*` returns 404 | `DELIVERECT_SECRET` (orders) or `DELIVERECT_MENU_TOKEN` (menu export) unset | Set the relevant one (§7.2/§7.3) — same deliberate off-switch pattern. |
| Caller ID box: "This browser cannot use a caller ID box" | Web Serial only exists in **Chrome desktop** | Use Chrome on a desktop/laptop till, not Safari/Firefox/mobile (§6.2). |
| Campaign/order-confirmation "sent" but nobody received it | `SMTP_HOST`/`MAIL_FROM` (email) or Twilio creds (SMS) unset — both silently dry-run and report success | Check the container logs for `[email:dry-run]` / `[sms:dry-run]` lines; set the real credentials (§8.3/§8.4). Push notifications do **not** have this trap — they report "0 sent" honestly. |
| Stripe reader payment never marks the order paid | Webhook not receiving events, or the three refund events (`refund.updated`, `refund.failed`, `charge.refund.updated`) missing from the endpoint | Re-check the Stripe webhook endpoint's subscribed events against §3.3's exact list, and that `STRIPE_WEBHOOK_SECRET` in Coolify matches the endpoint Stripe shows. |
| Live behind SSE stalls / order queue doesn't update live | A realtime `LISTEN` connection needs a **direct**, non-pooled DB connection | If a connection pooler ever sits in front of Postgres, set `DATABASE_URL_DIRECT` (§2.3) — `apps/web/src/lib/realtime.ts` otherwise falls back to the (possibly pooled) `DATABASE_URL`. |
| SSE/live features seem capped under load | A hard ceiling on concurrent live streams (`MAX_STREAMS`, `apps/web/src/lib/realtime.ts`) returns HTTP 503 with `retry-after: 30` once hit | ⚠ Exact ceiling not enumerated here — check `realtime.ts` directly if a shop is running many simultaneous devices/screens and seeing this. |

---

## What could not be verified from this codebase

Marked ⚠ inline above; collected here for a quick scan:

- Recommended till tablet model/size, and confirmation that the till's
  layout has been checked at the real device's resolution (only 1024×768
  was checked during development, per `docs/POS-PLAN.md`).
- Any specific USB caller-ID box model/brand — the code supports the
  standard FSK/DTMF-over-serial protocol generically, but no unit has been
  named or tested in this repository.
- Deliverect's actual channel numbers for Uber Eats and Just Eat, and four
  other Deliverect-shape assumptions listed in full in §7.7 — Deliverect's
  own developer docs were inaccessible while this integration was written.
- Whether a client needs their own Apple Developer / Google Play accounts
  or can ship under LaunchFlow's — a business decision per client, not
  something the code determines.
