# Help centre — build specification

An in-app help system for the back office (`/admin/*`) and the kitchen tablet (`/kitchen`).
Three parts, one content set:

1. **A searchable help centre** at `/admin/help` — fuzzy search, deep-linkable sections, a keyboard shortcut, filtered to what the signed-in person's role can actually reach.
2. **Contextual hotspots** — a small marker beside a control that opens the relevant passage in place, with a link through to the full article.
3. **"What to do if…" runbooks** — written for someone standing in a shop at 8pm on a Friday, not for an engineer.

Everything here is grounded in screens that exist today. No help is written for a screen that has not been built.

---

## 1. Principles

**Write for the shop, not the developer.** "The card machine is down" is a real heading. "Stripe webhook signature validation failure" is not — that belongs in the escalation line at the bottom.

**Be honest about what the software cannot do.** Half the value of this system is telling someone *before* they go looking that there is no refund button, no live driver map, and no way to add a product without ringing LaunchFlow. Help that pretends otherwise costs more time than no help at all.

**One source of truth for who sees what.** Article visibility derives from `can(role, screen)` in `apps/web/src/lib/permissions.ts` — the same function that drives the sidebar, the page guards and the server actions. A driver never sees a promo-code article because a driver cannot open `/admin/promos`. There is no second list to keep in step.

**Content is data, not code.** Articles are markdown files. Adding one is a file, not a component. A tenant can replace any article without touching the platform.

**No new runtime dependencies.** `marked` (18.0.11) is already in `apps/web` and already wrapped in `apps/web/src/lib/markdown.ts`. Frontmatter parsing and fuzzy search are about 120 lines of our own code between them. Do not add MDX — `@next/mdx` pulls a compiler into the build for no gain here, since articles contain no JSX — and do not add a search library.

---

## 2. Content architecture

### 2.1 Where articles live

```
content/help/                          platform baseline — identical for every tenant
  _index.json                          section grouping and default order
  signing-in.md
  dashboard.md
  kitchen-queue.md
  ...
config/farm-pizza/help/                per-tenant, optional
  help.json                            { hide: [...], order: [...], vars: {...} }
  kitchen-queue.append.md              appended to the baseline article
  refund-a-customer.md                 replaces the baseline article entirely
```

Roughly 90% of this help is about the software, which is byte-identical for every tenant, so the baseline belongs in the repo — not copied into every client folder where it would immediately drift. The tenant folder exists for the 10% that is genuinely shop-specific: who to ring, where the spare tablet lives, which manager has the Stripe login.

`content/` is a new top-level folder alongside `config/`. It is read at runtime from disk, in the same way `loadLocalityCopy` already reads `config/<slug>/copy/<town>.md` (`packages/config/src/load.ts:87`), so it needs no build step.

Two deployment details, both easy to miss and both silent when wrong:

- **Copy it into the image.** `docker/Dockerfile:41` copies `config/` into the standalone runner and nothing else. Add a matching `COPY --from=build /app/content ./content`, or the image ships an empty help centre.
- **Resolve it explicitly.** `loadLocalityCopy` finds its file through `clientDir()` then `configRoot()`, and `configRoot()` reads the `CONFIG_DIR` env var, which the Dockerfile pins to `/app/config` (`docker/Dockerfile:33`). A sibling `content/` is **not** reachable from that, so the help loader needs its own resolver: `CONTENT_DIR` if set, else `<configRoot()>/../content`. Copying `content/` without this gives an empty help centre and no error.

### 2.2 Article format

Markdown with a small frontmatter block. No YAML library — a ~30-line parser handling `key: value` and `key: [a, b, c]` only. Nesting is unsupported and must throw rather than be silently ignored.

```markdown
---
id: menu-and-pricing
title: Changing prices and marking things sold out
summary: Put a price up, take an item off, and why a new product needs LaunchFlow.
kind: guide
screens: [menu]
keywords: [price, prices, put prices up, sold out, out of stock, run out, 86, hide item, new product, add item, photo]
requires: []
updated: 2026-09-05
---

## Putting a price up
...

## Marking something sold out
...
```

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | slug | Route is `/admin/help/<id>`. Must match the filename. |
| `title` | string | Shown in search results and as the H1. |
| `summary` | string | One line, max 120 characters (enforced by the test). Shown under the title in results. |
| `kind` | `guide` \| `runbook` \| `reference` | Runbooks pin to the top of the index and win ties in search. |
| `screens` | `Screen[]` | From `SCREENS` in `permissions.ts`. Drives visibility and the "Help for this screen" panel. Empty means universal. |
| `roles` | `StaffRole[]` | Optional override for articles that are not about one screen. Empty means derive from `screens`. |
| `keywords` | `string[]` | **The single most important field.** Search succeeds or fails on this. See §2.5. |
| `requires` | `("stripe" \| "referral" \| "loyalty" \| "twilio" \| "agency")[]` | Feature gate. See §2.4. |
| `updated` | ISO date | Shown in the article footer. |

### 2.3 Visibility rules

An article is visible to a signed-in person when **all** of these hold:

- every entry in `requires` is satisfied for this tenant (§2.4), **and**
- it is not listed in the tenant's `help.json` `hide` array, **and**
- one of:
  - `roles` is non-empty and includes their role, **or**
  - `screens` is non-empty and `screens.some((s) => can(role, s))`, **or**
  - both are empty (universal — for example `signing-in`).

That is the whole per-role story. A driver's grants are `["kitchen", "dispatch"]`, so they see the kitchen and dispatch articles, the universal ones, and the runbooks tagged for them. They never see promo codes, campaigns, customer lists or pricing, because those articles carry `screens: [promos]`, `[campaigns]`, `[customers]` and `[menu]`, and `can("driver", …)` is false for all four.

Filtering happens **server-side** in `lib/help.ts`. A hidden article never reaches the browser, so the search index in the client bundle cannot leak a manager-only topic to a kitchen hand.

### 2.4 Feature gates (`requires`)

The platform is white-label and several features are switched off per tenant in config. Help must not advertise them.

| Gate | Satisfied when | Why it matters today |
| --- | --- | --- |
| `loyalty` | `cfg.loyalty.enabled` | **False for Farm Pizza.** `/rewards` returns not-found and no points accrue. Without this gate the help centre would explain a scheme that does not exist. |
| `referral` | `cfg.referral.enabled` | True for Farm Pizza (£5 / £5, £15 minimum, 90-day expiry). |
| `stripe` | `STRIPE_SECRET_KEY` is set | Card payment articles are wrong on a cash-only deployment. |
| `twilio` | Twilio credentials set | Every "the customer gets a text" sentence is false in dry-run mode. Gate the SMS articles and surface the dry-run runbook instead (§6, runbook 9). |
| `agency` | The `LAUNCHFLOW_KEY` session, not the role matrix | `/admin/launchflow` needs a separate key, so a manager who can see every other screen still cannot open it. Its articles gate on the key, not on `can()`. |

### 2.5 Keywords are the product

Shop staff do not search for "fulfilment method" or "promo redemption cap". They search for what is in their head. Every article carries an aggressive synonym list, and the test in §7 fails any article with fewer than six keywords.

What must resolve:

| Someone types | Must find |
| --- | --- |
| `card machine`, `chip and pin`, `payment not working`, `card declined` | `card-payments-down` |
| `till`, `takings`, `how much have we taken` | `dashboard` |
| `86`, `run out`, `out of stock`, `no dough` | `run-out-of-something` first (it is a runbook, and §7.3 pins runbooks), with `menu-and-pricing#sold-out` directly under it |
| `stop`, `stop orders`, `too busy`, `swamped`, `shut early` | `stop-taking-orders` |
| `money back`, `refund`, `give them their money` | `refund-a-customer` |
| `printer`, `docket`, `ticket not printing` | `tickets-and-printing` |
| `driver gone`, `where is my driver`, `driver not back` | `driver-off-radar` |
| `never arrived`, `didn't get food`, `missing order` | `order-never-arrived` |
| `no text`, `customer had no message`, `text not sent` | `messages-not-going-out` |
| `price went back`, `changed it back`, `prices wrong again` | `changes-reverting` |

### 2.6 Tenant overrides

`config/<slug>/help/help.json`:

```json
{
  "hide": ["loyalty-crust-club"],
  "order": ["stop-taking-orders", "card-payments-down"],
  "vars": { "managerName": "Naz", "spareTablet": "the office drawer" }
}
```

- `<id>.md` in the tenant folder **replaces** the baseline article of that id, frontmatter and all.
- `<id>.append.md` **appends** to the baseline body under an automatic `## At {name}` heading.
- `hide` removes an article outright.
- `order` pins ids to the top of the index, in the order given.

**Variable substitution** uses the same shape as the SEO templates in `lib/seo.ts`: `{name}`, `{phone}`, `{locality}`, `{cuisine}`, `{siteUrl}` from `client.json`, plus any key in `vars`. An unresolved `{token}` is left verbatim and fails the test, so a typo cannot ship as literal braces on a live help page.

### 2.7 Loader

`packages/config/src/help.ts`:

```ts
export type HelpKind = "guide" | "runbook" | "reference";

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  kind: HelpKind;
  screens: string[];
  roles: string[];
  keywords: string[];
  requires: string[];
  updated: string;
  body: string;                                        // markdown, after override merge and substitution
  headings: { id: string; text: string; level: 2 | 3 }[];
}

export function loadHelpArticles(slug: string): HelpArticle[];
```

**Where the cache lives matters, and the obvious place is wrong.** `loadClientConfig` in `packages/config` is *not* cached - it reads and validates on every call. The process-lifetime cache sits in the app wrapper (`apps/web/src/lib/config.ts:5`, `clientCache` / `menuCache`), and `reloadConfig()` there is what nulls it. So `loadHelpArticles` stays a pure disk read, its cache goes next to the other two in `apps/web/src/lib/help.ts`, and `reloadConfig()` is extended to clear it. Cache inside `packages/config` instead and the LaunchFlow "Reload config" button will reload the menu and serve stale help behind it.

`apps/web/src/lib/help.ts` wraps it with the parts that need request context:

```ts
export async function visibleArticles(): Promise<HelpArticle[]>;      // role + feature filtered
export async function articleFor(id: string): Promise<HelpArticle | null>;
export async function helpIndex(): Promise<HelpIndexEntry[]>;         // no bodies — for the client
export async function articlesForScreen(s: Screen): Promise<HelpArticle[]>;
```

`HelpIndexEntry` is `{ id, title, summary, kind, keywords, headings }` with no body. This spec defines **32 articles** - 16 screen articles (§5), 4 universal, 12 runbooks (§6) - so the index is roughly 8-10KB of JSON, cheap enough to ship into the admin shell. Bodies are fetched on demand.

### 2.8 Heading anchors

`marked` does not emit heading ids. Extend `apps/web/src/lib/markdown.ts` with `renderHelpMarkdown(md)`, using a `marked` renderer override that slugifies each `##`/`###` and emits `<h2 id="sold-out">`. The same slugifier feeds `HelpArticle.headings`, so a hotspot anchor and a rendered anchor can never disagree. Every heading also gets a hover "#" control that copies `/admin/help/<id>#<anchor>` — that is the hot-linking behaviour.

---

## 3. Routes

| Route | Type | What it is |
| --- | --- | --- |
| `/admin/help` | Server page | The help centre. Runbooks band, then sections grouped by area, then "Help for the screen you came from" when `?from=<screen>` is present. Search box focused on load. |
| `/admin/help/[article]` | Server page | One article: anchored headings, "Screens this covers" links straight to those screens, related articles. |
| `/api/admin/help/[id]` | Route handler | Returns one article's rendered HTML for the drawer. Role-checked through the same `visibleArticles()` filter — 404 for anything the caller cannot see. |

`/admin/*` already carries `X-Robots-Tag: noindex` from `apps/web/next.config.ts`, so no sitemap or robots work is needed.

**Permissions plumbing.** Add `"help"` to `SCREENS` in `permissions.ts`, add a `SCREEN_LABEL` entry (the `Record<Screen, string>` type makes a missing label a typecheck failure), and **append** `"help"` to each role's array in `GRANTS`. Append, not prepend: `landingFor()` returns `GRANTS[role][0]`, so putting help first would make the help centre the landing screen for every non-manager. A test asserts `can(role, "help")` is true for all five roles.

Do **not** add `/admin/help` to the sidebar `NAV` array in `app/admin/(shell)/layout.tsx`. It belongs in the rail footer beside "Open the storefront", plus a persistent "?" button in the shell header, so it does not compete with the working screens.

---

## 4. Components

All under `apps/web/src/components/help/`. Styling uses the existing design system only — `lf-card`, `lf-btn`, `lf-btn-ghost`, `lf-input`, `lf-pill`, `lf-prose`, `fp-adminhead`, `fp-kicker`, `fp-rule`, and the `--color-*` tokens. No new stylesheet; anything genuinely new goes into `globals.css` under an `.lf-help*` prefix.

### 4.1 `HelpProvider` (client)

Mounted twice: in `app/admin/(shell)/layout.tsx` and in `app/kitchen/page.tsx`, because the kitchen sits outside the admin shell. Takes the server-filtered index as a prop.

```tsx
<HelpProvider index={index} screen={screen} role={role}>
  {children}
</HelpProvider>
```

Holds the index in context, owns the open state of the palette and the drawer, registers the global key handler, and fetches and memoises article bodies.

**The kitchen tablet has no staff role. This is the one thing that will break if it is not handled up front.** `currentStaff()` resolves the *admin* cookie (`lib/session.ts:35`). A shared tablet signed in at `/kitchen/login` holds only the kitchen cookie, minted as `{ role: "kitchen", sub: "kitchen" }` with **no `sr` claim** (`api/kitchen/login/route.ts:13`) - so `currentStaff()` returns `null` and there is no role to pass. Only someone who signed in at `/admin/login` with a personal PIN carries both cookies (`api/admin/login/route.ts:47`).

One resolver in `lib/help.ts`, used by the page, the provider and the API alike:

```ts
// Effective role for help filtering. The admin cookie wins. A kitchen-only
// session is treated as the kitchen role - exactly the grant set a shared
// tablet should see. null means signed out: render no provider.
const role: StaffRole | null =
  (await currentStaff())?.role ?? ((await requireRole("kitchen")) ? "kitchen" : null);
```

`/api/admin/help/[id]` must apply the same resolution, or the drawer 404s on every tablet signed in the normal way.

### 4.2 `HelpSpot` (client) — the hotspot

```tsx
<HelpSpot id="menu.sold-out" />
<HelpSpot id="launchflow.reload-config" tone="warn" />
<HelpSpot id="kitchen.accept-eta" placement="corner" label="Why this time matters" />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `HelpSpotId` | required | `"<article-id>.<anchor>"`. A typed union generated by `scripts/gen-help-ids.ts`, so a typo is a build failure rather than a dead marker. |
| `tone` | `"default" \| "warn"` | `"default"` | `warn` renders in `--color-accent-700`, reserved for controls that are destructive or irreversible. |
| `placement` | `"inline" \| "corner"` | `"inline"` | `corner` absolutely positions inside a `position: relative` parent, for cards and table headers. |
| `label` | `string` | the anchor's heading text | Overrides the accessible name. |

Renders a 16px round button carrying "?", with a 44px hit area from padding so it works on the kitchen tablet, plus `aria-haspopup="dialog"`, `aria-expanded` and `aria-label={"Help: " + label}`. Click or Enter opens `HelpSheet` scrolled to that anchor.

**A `HelpSpot` whose article is not in the provider's index renders `null`.** That is the permission sync: the marker beside "Sold out" simply is not there for a role that cannot open `/admin/menu`, without the screen author writing a single conditional.

First-run affordance: an unseen spot pulses once. `fp-pulse` does already exist in `globals.css:28`, but it is a **`@keyframes` name, not a class** - every current use applies it inline (`animation: "fp-pulse 1.4s ease-in-out infinite"`, e.g. `KitchenScreen.tsx:89`) and it animates `box-shadow`, which suits a 16px round button. Reuse those keyframes with a finite count (`fp-pulse 1.4s ease-in-out 2`); do not write a second set. Seen ids live in `localStorage` under `lf-help-seen`, wrapped in try/catch, per browser. No database.

### 4.3 `HelpSheet` (client) — the in-place passage

A right-hand drawer on desktop (420px, fixed, focus-trapped, `Esc` closes, focus returns to the spot), a bottom sheet under 700px, and full-screen on `/kitchen`. Shows the passage from the anchor to the next heading of the same level, then:

- **Read the full article →** deep-links to `/admin/help/<id>#<anchor>`
- **Related** — up to three, by shared screens
- On a runbook passage, a **Do this now** button linking to the control it describes

### 4.4 `HelpPalette` (client) — the shortcut

Centred overlay with a search input and up to eight results, each showing title, summary and a `kind` pill. Same scorer as the help page. `↑`/`↓` moves, `Enter` opens the drawer without leaving the screen, `Cmd`/`Ctrl`+`Enter` navigates to the full article, `Esc` closes.

| Key | Action |
| --- | --- |
| `?` (`Shift`+`/`) | Open the palette |
| `Esc` | Close the palette or the drawer |
| `/` | Focus the search box, on `/admin/help` only |

The handler ignores the key when the event target is an `input`, `textarea`, `select` or `[contenteditable]`, or when a modifier other than Shift is held. `Cmd`/`Ctrl`+`K` is deliberately not used: it is the browser's own address-bar shortcut on several platforms, and this is a screen staff sit in all evening.

### 4.5 `HelpSearch` (client) — the help centre search box

The same scorer, rendered inline on `/admin/help`. Results group into `Runbooks` / `Guides` / `Reference`. Matching heading anchors appear as sub-results, so a search for "sold out" lands on the section rather than the top of a 1,200-word article. An empty query shows the default index. Zero results show the three most-used runbooks and the shop's phone number from config.

### 4.6 `DeniedNotice` (client)

`requireScreen()` in `lib/session.ts:49` already redirects a refused person to `?denied=<screen>` - and **nothing reads that parameter today** (one grep hit in the whole repo, and it is the write) so the person is bounced silently with no explanation. This component reads it and renders one line at the top of the landing screen: *"You do not have access to Menu & pricing. Ask a manager, or read about staff roles."* with a link to `/admin/help/staff-roles`. Name the screen with `SCREEN_LABEL[screen]` so the sentence reads "Menu & pricing", not `menu`.

**Mount it in two places, not one.** `requireScreen` sends a refused person to `landingFor(role)`, and for both `kitchen` and `driver` that is `/kitchen`, which sits outside the admin shell. Mounting only in `app/admin/(shell)/layout.tsx` would leave the two roles most likely to be refused still bouncing silently. Mount it in the shell layout **and** on the kitchen page, same as `HelpProvider`.

Two hours' work that removes the most confusing behaviour in the back office.

### 4.7 `HelpArticle` (server)

Renders `renderHelpMarkdown(body)` into `lf-prose`, with heading anchor links, a "Screens this covers" row of buttons linking to those screens, the `updated` line, and — for runbooks — a rule-topped "If it is still wrong" escalation block.

### 4.8 Supporting files

| File | Purpose |
| --- | --- |
| `apps/web/src/lib/help.ts` | Server-side load, filter, index |
| `apps/web/src/lib/help-search.ts` | Isomorphic scorer (§6) |
| `apps/web/src/lib/help-spots.ts` | `Record<Screen, HelpSpotId[]>` — the registry the test checks against the JSX |
| `apps/web/src/lib/help-ids.ts` | **Generated.** `export type HelpSpotId = "menu.sold-out" \| …` |
| `scripts/gen-help-ids.ts` | Regenerates the above from `content/help/` |
| `scripts/tests/help.test.ts` | §7 |

---

## 5. Content: every screen, its topics, its hotspots

`SCREENS` holds sixteen guarded areas today. Fifteen of them appear in the sidebar `NAV` array (`app/admin/(shell)/layout.tsx:12`) - and note that **Kitchen queue is one of those fifteen**, a sidebar entry pointing out to `/kitchen`. The sixteenth is `launchflow`, deliberately absent from the sidebar because it needs the agency key. Phase 0 adds a seventeenth, `help`; the `getting-around` article carries `screens: [help]` so it is covered rather than exempted from the test in §7.2.

Every screen gets an article. Topics below are the `##` headings, and each is a deep-link target. Hotspots name the control the marker sits beside.

### Dashboard — `/admin` · article `dashboard`

| Topic (anchor) | Covers |
| --- | --- |
| `todays-takings` | What the four tiles count, and that cancelled, rejected and unpaid orders are excluded from the money figures |
| `live-in-the-kitchen` | Counts every open order including ones nobody has accepted, so it is a workload figure, not a "being cooked" figure |
| `the-open-dot` | Reads `locations[0]` only. Farm Pizza's config has **one** branch (Grays), so today the dot is simply correct - write it as a limit that bites the day a second branch is added, not as a fault the owner is living with now |
| `recent-orders` | The order number opens the customer's own tracking page, which needs no login — do not forward that link |
| `what-this-screen-cannot-do` | No date picker, no comparison with last week, no per-shop or delivery/collection split, no best sellers |

Hotspots: `dashboard.todays-takings` (beside the takings tile) · `dashboard.the-open-dot` (beside the status dot) · `dashboard.recent-orders` (beside the recent orders table heading).

### Kitchen queue — `/kitchen` · article `kitchen-queue`

| Topic | Covers |
| --- | --- |
| `the-four-columns` | New → In the oven → Ready → Out for delivery, and the five-second refresh |
| `accepting-an-order` | The ETA dropdown (10–90 minutes), what the customer is told, and that the default is a fixed prep time with **no queue awareness** — the fortieth order of the night is promised the same wait as the first |
| `rejecting-an-order` | The five reasons (Too busy, Item unavailable, Outside delivery area, Closing soon, Other); a card order already paid is refunded in full automatically; there is no undo |
| `the-beep` | Sound needs one tap on **Enable sound** after every page load, and nags every 20 seconds while anything is unaccepted |
| `pausing-from-here` | 15 min / 30 min / 1 hour / Rest of day. **The reason is hard-coded to "Busy" here and there is nowhere to type one** (`KitchenScreen.tsx:99`); a custom message for customers has to be set on Hours & pause. "Rest of day" is 240 minutes - four hours - so a pause at 5pm lifts itself at 9pm |
| `nobody-is-alerted-but-this-screen` | Kitchen SMS, kitchen email and printer webhook are all empty in this shop's config, so if this tab is closed or the tablet sleeps **nothing tells anyone an order arrived** |
| `one-queue-for-every-branch` | The board does not filter by branch. Farm Pizza runs **one** branch (Grays), so today this changes nothing - do not write it as though tickets from two shops were already mixing on the pass |
| `what-you-cannot-do-here` | No editing a ticket, no cancel button, no re-print |

Hotspots: `kitchen-queue.accepting-an-order` (beside the ETA dropdown) · `kitchen-queue.rejecting-an-order` `tone="warn"` (beside Reject) · `kitchen-queue.the-beep` (beside Enable sound) · `kitchen-queue.pausing-from-here` (beside the Pause select).

### Orders — `/admin/orders` · article `orders-history`

| Topic | Covers |
| --- | --- |
| `finding-an-order` | Search runs across customer name, phone and delivery postcode |
| `phone-search-gotcha` | Phone matching does not normalise formatting: `07700 900 201` and `+447700900201` will not find each other, so try both |
| `the-csv-export` | 17 columns, capped at 5,000 rows with **no warning** when a wider date range is silently truncated |
| `this-screen-is-read-only` | No order detail page, no amending, no note, no partial refund, no resending a receipt |
| `the-order-link-is-public` | The order number opens the customer-facing tracker, which needs no login and shows name, phone and address |

Hotspots: `orders-history.finding-an-order` (beside the search box) · `orders-history.the-csv-export` (beside Export CSV) · `orders-history.the-order-link-is-public` `tone="warn"` (beside the order-number column header).

### Dispatch — `/admin/dispatch` · article `dispatch-and-drivers`

| Topic | Covers |
| --- | --- |
| `assigning-a-driver` | What it does: marks them on delivery, stores the order against them, sets a return clock |
| `what-assigning-does-not-do` | It does not touch the order, does not tell the driver, and produces no job sheet — someone still has to hand over the food and mark it out for delivery on the kitchen screen |
| `the-map-is-not-a-map` | A drawn grid with pins placed by list position. There is no GPS anywhere in this system |
| `back-at-30-minutes` | Always now plus 30 minutes, regardless of distance |
| `ready-to-go-includes-unfinished-food` | The list also shows orders still preparing |
| `drivers-come-from-config` | They cannot be added, renamed or removed here; today's four are sample entries with placeholder numbers |

Hotspots: `dispatch-and-drivers.what-assigning-does-not-do` (beside the assign dropdown) · `dispatch-and-drivers.the-map-is-not-a-map` (corner of the map panel) · `dispatch-and-drivers.ready-to-go-includes-unfinished-food` (beside the panel heading).

### Menu & pricing — `/admin/menu` · article `menu-and-pricing`

| Topic | Covers |
| --- | --- |
| `putting-a-price-up` | One size at a time, each with its own Save; stored in pence; the site updates immediately |
| `sold-out` | The toggle, that it applies to **every branch**, that nothing decrements it as stock sells, and that it stays on until someone remembers to switch it back |
| `hiding-vs-sold-out` | Hide removes the item from the menu; sold out leaves it visible with a tag |
| `renaming-and-descriptions` | Name and description save together |
| `reordering` | Up and down within a category |
| `adding-a-new-item` | You cannot. Products, categories, sizes, option groups, allergens and photos live in `config/farm-pizza/menu.json` and need LaunchFlow and a re-seed |
| `photos` | No upload screen; 46 of 68 items have a photo, the rest show an initials tile |
| `two-people-at-once` | The sold-out toggle reads then writes without a transaction, so two people tapping the same button at the same moment can cancel each other out |

Hotspots: `menu-and-pricing.sold-out` (beside the first Sold out toggle) · `menu-and-pricing.putting-a-price-up` (beside a price field) · `menu-and-pricing.adding-a-new-item` (beside the category heading).

### Deals — `/admin/deals` · article `deals`

| Topic | Covers |
| --- | --- |
| `repricing-a-deal` | Price, Active and Featured are the only three fields |
| `what-is-in-a-deal` | Slots, allowed products and allowed sizes are config — LaunchFlow and a re-seed |
| `featured-on-home` | No limit, so every deal can be featured at once |
| `no-day-restrictions-here` | The engine supports day-of-week and collection-only rules but this form cannot set them, and the day check uses the server's clock rather than shop time, which matters for Grays trading to 02:00 and 03:00 |

Hotspots: `deals.what-is-in-a-deal` (beside the slot summary) · `deals.featured-on-home` (beside the Featured tick).

### Promotions — `/admin/promos` · article `promo-codes`

| Topic | Covers |
| --- | --- |
| `creating-a-code` | Percent, fixed or free delivery; minimum spend; maximum uses; end date; delivery or collection only; first order only |
| `editing-re-enables-a-code` | **The form hard-codes active on save**, so re-saving a disabled code switches it back on. It is also the only way to edit, and there is no delete — only disable |
| `no-start-date` | A code cannot be prepared in advance; it is live the moment it is saved |
| `retyping-every-field` | Table rows do not pre-fill the form, and typing an existing code overwrites its rules with no warning |
| `percent-never-touches-delivery` | Even a 100% code leaves the delivery fee payable |
| `why-a-code-can-look-valid-then-fail` | The basket does not know who the customer is, so a first-order-only code appears to work all the way to Pay for a returning customer |
| `thanks-codes-in-the-list` | Personal referral rewards are ordinary promo rows and pile up here — never send one in a campaign |

Hotspots: `promo-codes.editing-re-enables-a-code` `tone="warn"` (beside Create / update) · `promo-codes.percent-never-touches-delivery` (beside the value field) · `promo-codes.thanks-codes-in-the-list` (beside the code column header).

### Inventory — `/admin/inventory` · article `inventory`

| Topic | Covers |
| --- | --- |
| `what-this-screen-is` | A shopping list. Nothing decrements as food is sold — the numbers only change when LaunchFlow re-seeds |
| `reorder-does-not-order` | It sets a flag; it does not message the supplier |
| `you-cannot-clear-on-order` | There is no button to book a delivery in, so a flagged line stays flagged |
| `stock-lines-come-from-config` | All 16 are sample data; adding, editing or removing one needs LaunchFlow |
| `use-sold-out-instead` | When you genuinely run out, the customer-facing fix is the Sold out toggle on Menu & pricing, not this screen |

Hotspots: `inventory.what-this-screen-is` (corner of the counters row) · `inventory.reorder-does-not-order` `tone="warn"` (beside Reorder everything below par).

### Customers — `/admin/customers` · article `customers`

| Topic | Covers |
| --- | --- |
| `finding-a-customer` | Name, email or phone; the 200 most recent, with no paging |
| `the-segments` | What each of the nine means and when to use it |
| `two-numbers-that-disagree` | The count beside a segment counts opted-in customers; the table below shows everyone — by design |
| `read-only` | No correcting a name, merging duplicates, adding a note, blocking a nuisance customer, or opting someone out on their behalf |
| `opting-someone-out-by-hand` | You cannot from here. The only routes are the checkout tick box and the customer texting STOP |
| `one-phone-one-customer` | A household sharing a mobile becomes one record with merged history |

Hotspots: `customers.the-segments` (beside the segment chips) · `customers.two-numbers-that-disagree` (beside a segment count) · `customers.opting-someone-out-by-hand` (beside the Marketing column header).

### Campaigns — `/admin/campaigns` · article `campaigns`

| Topic | Covers |
| --- | --- |
| `sending-a-one-off` | Channel, segment, offer code, and the merge fields `{name}` `{shop}` `{code}` |
| `there-is-no-undo` | Send fires immediately — no confirmation, no test send, no preview, no schedule, no cancel. One click can text 2,000 people |
| `the-code-warning` | Why the screen sometimes says a code cannot work for this audience, and why not to ignore it |
| `what-it-costs` | 4p per recipient, hard-coded, counted per message rather than per 160-character segment, so a long message costs more than the screen says |
| `a-big-send-can-time-out` | The send loop runs inline, so a few hundred recipients can outlive the request and leave the counters at zero with messages already gone |
| `email-has-no-unsubscribe` | SMS carries "Reply STOP"; marketing email carries nothing, which is a legal problem — do not use the email channel for marketing until it is fixed |

Hotspots: `campaigns.there-is-no-undo` `tone="warn"` (beside Send) · `campaigns.what-it-costs` (beside the cost estimate) · `campaigns.email-has-no-unsubscribe` `tone="warn"` (beside the channel selector).

### Marketing — `/admin/marketing` · article `marketing-automations`

| Topic | Covers |
| --- | --- |
| `what-an-automation-is` | Trigger, days threshold, cooldown, per-run cap, offer code |
| `nothing-runs-unless-a-schedule-was-set-up` | The runner is an endpoint an external scheduler must call. If that was never set up, rules only fire when someone presses Send now |
| `send-now` | Fires immediately, works on paused rules, no confirmation |
| `editing-makes-a-copy` | Saving under a changed name creates a second automation; there is no delete, only pause |
| `the-birthday-rule-never-fires` | No birthday is collected anywhere in the system |
| `reading-the-money` | Earned is the whole order total, not margin; spent is 4p per message; net ignores the cost of the food |
| `commission-saved-is-an-estimate` | A flat 14% of this month's direct revenue, including orders you would have taken by phone anyway |
| `campaigns-show-under-automations` | A known defect in the breakdown table; the per-campaign figures on the Campaigns screen are correct |

Hotspots: `marketing-automations.send-now` `tone="warn"` (beside each Send now) · `marketing-automations.nothing-runs-unless-a-schedule-was-set-up` (corner of the automations table) · `marketing-automations.commission-saved-is-an-estimate` (beside the commission tile).

### Reviews — `/admin/reviews` · article `reviews`

| Topic | Covers |
| --- | --- |
| `where-these-come-from` | Seeded samples only. There is no customer review form and no Google import, so this list will not grow on its own |
| `a-reply-goes-nowhere` | It is stored locally. Google never sees it and the customer is not told |
| `you-cannot-edit-a-reply` | The box only appears while the reply is empty |
| `the-average-is-of-50` | Both the average and the star breakdown are computed from the rows loaded on the page |
| `review-request-texts-do-go-out` | 45 minutes after completion, to the Google Maps link in config — but the replies never come back here |

Hotspots: `reviews.a-reply-goes-nowhere` `tone="warn"` (beside the reply box) · `reviews.where-these-come-from` (corner of the list).

### Staff — `/admin/staff` · article `staff-roles`

| Topic | Covers |
| --- | --- |
| `the-five-roles` | Manager, Shift lead, Kitchen, Driver, Front of house, and exactly which screens each opens — rendered from the same matrix the system enforces |
| `changing-someones-role` | The dropdown and Save |
| `adding-a-starter-or-removing-a-leaver` | You cannot. Staff and PINs are config and need LaunchFlow |
| `pins` | A PIN is only ever written when a person is first created and cannot be changed by re-seeding. **The sample PINs 1111–8888 are committed in the repository and must be replaced before launch** |
| `hours-this-week-is-decorative` | A static seeded number. Clock on and off does not change it, has no timestamps, and is not a timesheet |
| `do-not-demote-yourself` | Nothing stops a manager removing their own access |

Hotspots: `staff-roles.the-five-roles` (corner of the permission matrix) · `staff-roles.pins` `tone="warn"` (beside the staff list heading) · `staff-roles.hours-this-week-is-decorative` (beside the hours column header).

### Hours & pause — `/admin/hours` · article `hours-and-pause`

| Topic | Covers |
| --- | --- |
| `changing-opening-times` | One range per day; blank means closed; closing after midnight is fine |
| `you-cannot-split-a-day` | Shutting between lunch and dinner cannot be expressed here |
| `a-typo-saves-as-closed` | A time that fails the format check is dropped silently rather than reported, so always re-read the grid after saving |
| `pausing` | 15 / 30 / 60 minutes or today, with a reason shown to customers |
| `what-a-pause-does-not-do` | It does not cancel orders already in, and customers can still book pre-order slots |
| `nothing-reminds-you-a-pause-is-on` | Only this screen's pill and the kitchen header show it |
| `bank-holidays` | There are no one-off closure dates — edit the day and put it back afterwards |

Hotspots: `hours-and-pause.pausing` (beside the pause control) · `hours-and-pause.a-typo-saves-as-closed` `tone="warn"` (beside Save hours) · `hours-and-pause.you-cannot-split-a-day` (beside the day grid heading).

### Delivery zones — `/admin/zones` · article `delivery-zones`

| Topic | Covers |
| --- | --- |
| `the-districts-you-deliver-to` | Comma-separated outward codes; a letters-only entry such as `RM` covers the whole area |
| `charge-bands` | Name, districts, fee, minimum, extra minutes; a district band always beats a broader area band; a £0.00 minimum inherits the shop's |
| `postcodes-not-distance` | No radius, no drive-time, no drawn map — a house at the far edge of a district pays the same as one next door to the shop |
| `remove-has-no-confirmation` | It deletes immediately, with no undo |
| `bands-can-be-wiped-by-a-redeploy` | Bands live in the database and the seeder recreates them from config on every restart. Tell LaunchFlow about any band you add so it is written into config |
| `the-shop-address-is-in-this-form` | Address and phone are edited here, confusingly, inside the delivery section |

Hotspots: `delivery-zones.charge-bands` (beside the bands heading) · `delivery-zones.remove-has-no-confirmation` `tone="warn"` (beside Remove) · `delivery-zones.bands-can-be-wiped-by-a-redeploy` `tone="warn"` (beside Save band).

### LaunchFlow — `/admin/launchflow` · article `launchflow-panel` · `requires: [agency]`

| Topic | Covers |
| --- | --- |
| `what-this-page-checks` | Seed state and config hash, record counts, Stripe charges and payouts, webhook secret, Twilio and Resend, kitchen notification channels, live domain checks |
| `reload-config-is-destructive` | It re-runs the full seed: stock on-hand and par reset to sample numbers, drivers reset, and staff roles, hours and on-shift flags reset to whatever is committed. Any role change made on the Staff screen is silently undone. No confirmation, no dry run |
| `reload-does-not-remove` | It runs without `--reset`, so a product deleted from config stays live; only the CLI deactivates it |
| `test-kitchen-notifications` | Returns "skipped" for all three channels on this tenant, because all three are empty |
| `dry-run-mode` | The one place that tells you texts and emails are being logged rather than sent |

Hotspots: `launchflow-panel.reload-config-is-destructive` `tone="warn"` (beside Reload config) · `launchflow-panel.dry-run-mode` (beside the Twilio and Resend status rows).

### Universal articles

| id | Covers |
| --- | --- |
| `signing-in` | The one password box: agency key, the shop password (treated as manager), or a personal 4–8 digit PIN. A kitchen-capable PIN also unlocks the tablet. Sessions last 12 hours (admin) and 30 days (kitchen), and marking someone inactive does not end a session already issued |
| `getting-around` | The sidebar, the kitchen badge, the help shortcut, and what the "?" markers are. **Carries `screens: [help]`** - the one article covering the `help` screen Phase 0 adds, so §7.2's "every screen has an article" test needs no exclusion |
| `what-this-system-does-not-do` | One honest page: no stock control, no live driver tracking, no partial refunds, no order editing, no adding menu items, no bulk price change, no one-off closure dates, no email unsubscribe. Linked from the zero-results state so a fruitless search still ends in an answer |
| `who-to-ring` | Escalation. Taken from tenant `vars` where set, otherwise the shop phone from config |

---

## 6. "What to do if…" runbooks

Every runbook uses the same five blocks, in this order:

1. **You will know because** — the symptom in the shop's words
2. **Do this now** — numbered steps, each naming the screen and the exact control
3. **What the system does and does not do** — the honest bit
4. **If it is still wrong** — who to ring, with what information
5. **Afterwards** — the thing people forget to switch back

Runbooks carry `kind: runbook`, an empty `screens` array where every role should see them, and `roles` where they should not. They are pinned to the top of `/admin/help` and to the front of search results.

### 1. `card-payments-down` — the card machine is down

**Two different things share that phrase, and the fix is different.**

*Your own card terminal in the shop* has nothing to do with this system. The website keeps taking card orders as normal. Take counter payments in cash, and carry on.

*Card payment on the website is failing* — customers ring saying the payment will not go through:

1. Try it yourself: put an item in a basket on the storefront and get as far as the pay step. If the card box does not appear at all, card payment is switched off, not broken.
2. Ring LaunchFlow. This is not something the shop can fix from the back office.
3. Meanwhile: keep taking orders **by phone** and put them through your own till. Do not tell customers the shop is shut.
4. If the phone cannot keep up, pause ordering - but do it from **Hours & pause, not the kitchen header**. The kitchen Pause… dropdown always sends the reason "Busy" and gives you nowhere to type. On Hours & pause you choose the length and type the reason customers actually read: *"Card payments are down - please ring us on {phone}"*.

**What the system does and does not do.** Card, Apple Pay and Google Pay run through Stripe, and card numbers never touch this site. Card only appears when Stripe keys are set on the server. Cash is offered where the config allows it — for this shop cash is **collection only**, and you cannot switch cash-on-delivery on yourself; it is a config change. `/admin/launchflow` shows whether Stripe is connected and whether charges and payouts are enabled, but only LaunchFlow can open it.

**If it is still wrong:** ring LaunchFlow with the time it started and one order number that failed.

**Afterwards:** clear the pause. Nothing reminds you it is on.

### 2. `order-came-through-wrong` — an order came through wrong

1. Ring the customer first, from the ticket. The phone number on the kitchen ticket is a tap-to-call link.
2. **If you have not started cooking it and they want to change it:** reject the order on the kitchen screen with the reason *Other*, and ask them to place it again. If they paid by card, rejecting refunds them in full, automatically.
3. **If it is already in the oven:** agree with the customer what you are doing — remake it, add the missing item on the delivery, or refund the difference. Then follow `refund-a-customer` if money has to go back.
4. Note what happened. You can find the order again later on Orders by name, phone or postcode.

**What the system does and does not do.** There is **no way to edit an order** once it is placed: not the items, not the address, not the total. There is no "add a note to this order" in the back office. Reject is the only clean exit, and only before you accept. A part-refund cannot be done from any screen here.

**If it is still wrong:** ring LaunchFlow only if the order looks wrong on the ticket in a way the customer did not choose — that is a bug, and they need the order number.

### 3. `driver-off-radar` — a driver has gone off-radar

1. Ring the driver. Their number is on the Dispatch list.
2. Check the order on the kitchen screen: is it still sitting in **Ready**, or was it marked out for delivery? That tells you whether it actually left.
3. Ring the customer. Tell them where you are up to before they ring you.
4. If you need to send someone else: on Dispatch, set the missing driver back to available, then assign the free driver to that order.
5. When the food is delivered, mark it **Done** on the kitchen screen so the customer's tracking page stops saying "on its way".

**What the system does and does not do.** There is **no GPS and no live tracking of any kind**. The map on Dispatch is a drawing — the pins are placed by position in the list and mean nothing. "Back at" is always now plus 30 minutes, whatever the distance. Assigning a driver does not tell the driver anything and does not move the order. Nothing stops you assigning a driver who is already out.

**If it is still wrong:** this is a people problem, not a software one. Follow your own procedure.

**Afterwards:** set the driver's status correctly on Dispatch, or the next assignment will be wrong.

### 4. `tickets-and-printing` — the printer stopped

**Read this first: you are almost certainly not printing.** No receipt printer is connected to this system for this shop — the printer webhook is empty in the config. The kitchen tablet screen **is** the ticket. If a printer stopped, it is either your own hardware doing its own job, or nothing was ever set up.

If the *screen* is your problem:

1. Wake the tablet. Check the tab is still on `/kitchen`.
2. Check the top of the screen says **Sound on**. If it says *Enable sound*, tap it. Sound switches itself off after every page reload.
3. Reload the page. The board polls every five seconds; a stale screen means a stale connection.
4. Check the wifi.
5. If the tablet has died, sign in on any other device or phone with your PIN and work from there.

**What the system does and does not do.** New orders appear on this screen and **nowhere else** — no text to the kitchen, no email, no printer. If this tab is closed, nobody is told an order arrived. There is no re-print and no print view.

**If it is still wrong:** ring LaunchFlow. Getting a kitchen alert text or email switched on is a config change and should be done before the next busy night.

**Afterwards:** keep the tablet plugged in with sleep disabled.

### 5. `stop-taking-orders` — we need to stop taking orders right now

1. On the kitchen screen header, open the **Pause…** dropdown and choose 15 min, 30 min, 1 hour or Rest of day. That is the fastest route and it works on the tablet. Two things to know before you use it: customers are shown the reason **"Busy"** and you cannot change it from here, and **"Rest of day" is four hours**, not until closing - it lifts itself.
2. If you want customers to read something other than "Busy", or you need longer than four hours, use the back office instead: Hours & pause, choose the length, type the reason, then Apply.
3. To start taking orders again, press **Resume** - it sits in the same place you paused from, on the kitchen header or on Hours & pause.

**What the system does and does not do.** A pause stops new orders arriving straight away and shows a reason to customers - yours if you paused from Hours & pause, otherwise the fixed word "Busy". It does **not** cancel orders already in - check the board and finish them. Customers can still book a **pre-order slot** for later while you are paused. For anything longer than today, edit the day's opening times on Hours & pause instead.

**If it is still wrong:** if orders keep arriving after you paused, ring LaunchFlow with the time you paused and an order number that came in afterwards.

**Afterwards:** **nothing reminds you a pause is on.** Only the pill on Hours & pause and the kitchen header show it. If you edited opening hours instead, put them back.

### 6. `refund-a-customer` — a customer wants a refund

1. **Did they pay by card and has the food not been started?** Reject the order on the kitchen screen with a reason. That refunds them in full, automatically, and texts them. This is the only refund the back office can do by itself.
2. **Did they pay cash?** Refund from the till. Nothing to do in the system.
3. **Anything else — card, food already made, or part of an order:** it has to be done in Stripe by whoever holds the Stripe login. Give them the order number, the amount and the reason.

**What the system does and does not do.** There is **no refund button anywhere** in the back office, and **no partial refunds at all**. Cancelling an order never refunds it, even though cancelling is allowed. The only automatic refund is rejecting an order that has already been paid for by card.

**If it is still wrong:** ring LaunchFlow if a refund you issued in Stripe is not showing against the order.

**Afterwards:** the order stays in the history as rejected. There is nowhere to record why, so write it in your own book.

### 7. `order-never-arrived` — a customer says they never got their food

1. Find the order: Orders, and search their **phone number, name, or postcode**. If the phone number does not match, try it without spaces and with `+44` — the search does not tidy up formatting.
2. Open the order and check the status and the address that was typed.
3. If it says out for delivery, ring the driver (Dispatch). If it says ready, the food never left — that is the answer.
4. Check the address carefully. Addresses are typed free-hand with no lookup, so a wrong house number goes straight through.
5. Decide with the customer: remake it, or refund it (`refund-a-customer`).

**What the system does and does not do.** There is no proof of delivery, no driver location and no photo. **There is also no order history you can read.** Every status change is written to an event log in the database, but no screen anywhere shows it - not the back office, which has no order detail page at all, and not the customer's tracking page - and even if it did, it records only a coarse actor (`kitchen`, `admin`, `system`) and never which member of staff pressed the button. Work it out from the current status, the address that was typed, and asking the people who were on.

**If it is still wrong:** ring LaunchFlow only if the order is not in the list at all but the customer has a payment on their statement.

### 8. `too-busy-to-keep-up` — we are too busy to keep up

1. **Buy time first:** pause for 15 or 30 minutes from the kitchen header. That is better than accepting orders you cannot cook.
2. **Then tell the truth on the ETA.** When you accept an order, change the minutes in the dropdown before tapping Accept — it goes up to 90 minutes. That number is what the customer is told and it is the only lever you have.
3. **Take pressure off the kitchen:** mark the slowest items **Sold out** on Menu & pricing.
4. **Do not send a campaign or turn on an automation tonight.**
5. When you catch up, Resume on Hours & pause.

**What the system does and does not do.** The estimated time is a fixed number of minutes from your settings plus any extra for a far-out delivery band. It has **no idea how busy you are** — the fortieth order of the night is promised the same wait as the first unless you change it on Accept. Nothing queues, throttles or spaces orders out.

**Afterwards:** switch the sold-out items back on. **Nothing clears them overnight**, and they will still be off the menu tomorrow lunchtime.

### 9. `messages-not-going-out` — customers say they got no text

**You will know because** a customer says they had no confirmation, or nobody is replying to codes you sent.

1. Ask one customer directly whether they received anything at all.
2. If nobody is getting texts, ring LaunchFlow and ask them to check the SMS credentials on `/admin/launchflow`.
3. Until it is fixed, ring customers for anything that matters — a rejected order especially.

**What the system does and does not do.** When SMS is not configured the system **records the message as sent** - successful in the order's event log and in your marketing figures - while nothing actually leaves the building. Worse, that event log is not shown on any screen, so the marketing figures are the only place the phantom send is visible to you at all. `/admin/launchflow` is the only screen that says so, and only LaunchFlow can open it. This affects order updates, login codes for customer accounts, review requests, referral rewards and campaigns.

**If it is still wrong:** ring LaunchFlow with a customer's number and the time of the order.

**Afterwards:** any marketing spend recorded while it was broken is wrong — do not trust that week's figures.

### 10. `code-did-not-work` — a customer says their discount code did not work

1. Ask what the screen said. The message is specific and is usually the answer: *"Spend £15.00 to use this code"*, *"This code has expired"*, *"This code is for first orders only"*.
2. Check the code on Promotions: is it still enabled, is it within its end date, is it under its maximum uses, and is it set to delivery-only or collection-only?
3. If the customer has ordered before and the code is **first order only**, it was never going to work — it just does not say so until they press Pay.
4. If they saw *"That code was issued to someone else"* and it is their own referral thank-you code, it will work when they submit the order. It is a display fault, not a refusal.

**What the system does and does not do.** One code per order — codes do not stack. A percentage never comes off the delivery fee. Codes are checked on the server on every order, so nothing gets past them.

**Afterwards:** if you agreed to honour a discount that the system refused, you have to apply it as cash off at the counter — there is no override.

### 11. `changes-reverting` — I changed something and it has come back

**You will know because** a price you put up is back to the old one, an opening time reset, or a delivery band you added has vanished — usually after the site has been updated.

1. Make the change again on the screen it belongs to.
2. **Ring LaunchFlow and tell them exactly what you changed.** They have to write it into your shop's config file, or it will revert again on the next update.

**What the system does and does not do.** The site rebuilds its menu, prices, opening hours and delivery bands from your shop's config file every time the software restarts. Anything you change in the back office that also lives in that file — **prices, product names and descriptions, sold-out flags, opening hours, delivery bands, staff roles, stock levels and driver status** — is overwritten. Promo codes, orders and customers are never touched.

**Afterwards:** treat the back office as safe for day-to-day trading and always tell LaunchFlow about permanent changes.

### 12. `run-out-of-something` — we have run out of an ingredient

1. Menu & pricing, find the item, tap **Sold out**. It disappears from the customer's basket straight away.
2. If a whole group is affected — no dough, no chicken — do each item. There is no group toggle.
3. For toppings and extras, the option pills under each group have their own sold-out toggles.

**What the system does and does not do.** Sold out is a manual switch that applies to **every branch**. Nothing counts stock down as orders come in, and nothing clears the flag overnight. The Inventory screen is only a shopping list; it does not affect what customers can order.

**Afterwards:** switch everything back on when the delivery arrives. This is the single most common way a shop loses money on this system.

---

## 7. Data model and tests

### 7.1 Data model

**None in version one.** Articles are files, filtering is computed per request, and "seen" hotspots live in `localStorage`. No migration, no Prisma change, nothing to back up.

Optional later (one migration, phase 6):

```prisma
model HelpFeedback {
  id        String   @id @default(cuid())
  clientId  String
  articleId String
  anchor    String?
  helpful   Boolean
  note      String?  // max 500 chars
  role      String
  createdAt DateTime @default(now())
  @@index([clientId, articleId])
}
```

That exists only to answer "which runbook did people open and then still ring us about". Do not build it before there is real usage.

### 7.2 `scripts/tests/help.test.ts`

Runs under the existing `pnpm test` (`tsx --test scripts/tests/*.test.ts`), which CI already executes.

| Assertion | Why |
| --- | --- |
| Every id in `SCREENS` has at least one article naming it in `screens` - including the `help` screen Phase 0 adds, which `getting-around` covers | No screen ships without help, and adding a screen fails the build until someone writes for it |
| Every `screens` entry is a valid `Screen`, every `roles` entry a valid `StaffRole` | Catches a rename in `permissions.ts` |
| `can(role, "help")` is true for all five roles | Nobody is locked out of help |
| `landingFor(role)` is never `/admin/help` | Guards against prepending help to `GRANTS` |
| Every `HelpSpotId` resolves to an existing article and an existing heading anchor | No dead markers |
| Every `<HelpSpot id="…">` found in the `/admin` and `/kitchen` page sources appears in `help-spots.ts`, and vice versa | The registry stays honest |
| For every screen, every spot on it resolves for at least one role that can open that screen | No spot only a manager can use on a kitchen-only screen |
| `id` matches the filename; `summary` ≤ 120 chars; `keywords.length >= 6` | Content quality floor |
| No unresolved `{token}` after substitution | Catches typos in tenant vars |
| `content/help/` and `apps/web/src/lib/help-ids.ts` are in step | Same drift problem the generated JSON schemas already have; here CI fails instead of quietly going stale |
| Every runbook contains all five required headings | Format is the point of a runbook |
| Every tenant override id exists in the baseline | Catches a renamed article leaving an orphan override |

### 7.3 Search scoring — `lib/help-search.ts`

Isomorphic, no dependency, roughly 80 lines.

- Normalise: lowercase, strip punctuation, collapse whitespace.
- Fields and weights: title 8, keywords 6, summary 4, headings 3, body 1.
- Per query term, per field, take the best of: exact token match (full weight), token prefix match (×0.7), subsequence within a token with a gap penalty (×0.4 max).
- Every term must hit something (AND); scores sum across terms.
- `kind: runbook` gets ×1.25 when the query contains a problem word (`not`, `no`, `broken`, `down`, `stopped`, `wrong`, `cannot`, `help`, `stuck`, `late`, `missing`).
- Ties break on shorter title.
- Results below 15% of the top score are dropped, so eight results never means eight bad ones.

Search runs over the role-filtered index only. Fewer than 50 articles means no debounce and no worker are needed — it is a synchronous filter on keystroke.

### 7.4 Accessibility and the tablet

- Drawer and palette are `role="dialog"` with `aria-modal`, focus-trapped, `Esc` closes, focus returns to the trigger.
- Hotspot buttons are real `<button>`s with a 44px hit area, reachable in tab order, never `title`-only.
- Results list is a `listbox` with `aria-activedescendant` for arrow-key navigation.
- Everything works without JavaScript at `/admin/help` and `/admin/help/[article]` — those are server-rendered pages. Only search, the palette and the drawer need JS.
- On `/kitchen` the sheet is full-screen with 18px body text; a tablet at arm's length is the design target, not a laptop.
- The existing CI Lighthouse run gates `/` and `/menu` only, with performance and SEO as errors at 0.9 and accessibility as a **warning** at 0.9 (`lighthouserc.json`). Adding `/admin/help` to it is not a one-line change, and there are two reasons why. It sits behind the middleware auth gate, so an unauthenticated Lighthouse run follows the redirect and audits `/admin/login` instead - CI already seeds a real database, so it can mint an admin cookie from `ADMIN_PASSWORD` and pass it through Lighthouse `extraHeaders`. And the single global `assert.assertions` block cannot hold one page to a stricter bar than the rest, so a per-URL accessibility threshold needs `assertMatrix`. Budget that properly or leave the gate out: an accessibility gate that silently audits the login page is worse than no gate at all.

---

## 8. Build order

Each phase ships something usable on its own. Estimates assume one developer.

### Phase 0 — plumbing (half a day)

- Add `"help"` to `SCREENS`, `SCREEN_LABEL`, and the **end** of each role array in `GRANTS`. There are **four** arrays, not five: managers are granted implicitly (`GRANTS` is typed `Record<Exclude<StaffRole, "manager">, Screen[]>`), which is also why `can("manager", "help")` passes for free.
- Build `DeniedNotice` and mount it in the admin shell **and** on `/kitchen` (§4.6).
- Add `content/` to the Docker copy list **and** give it a resolver - `CONTENT_DIR`, else `<configRoot()>/../content` (§2.1).

**Done when:** every role can reach `/admin/help` (even though it 404s), and a denied person sees a sentence instead of a silent bounce.

### Phase 1 — content pipeline (1–2 days)

- `packages/config/src/help.ts`: frontmatter parser, override merge, substitution, heading extraction.
- `apps/web/src/lib/help.ts`: role and feature filtering, index.
- `renderHelpMarkdown` with heading anchors in `lib/markdown.ts`.
- `scripts/tests/help.test.ts` with the assertions in §7.2 that do not need components.
- Write three articles to prove the pipeline: `signing-in`, `kitchen-queue`, `menu-and-pricing`.

**Done when:** `pnpm test` passes and the loader returns different article sets for a manager and a driver.

### Phase 2 — the help centre (2 days)

- `/admin/help` and `/admin/help/[article]`.
- `lib/help-search.ts` and `HelpSearch`.
- Rail-footer and header links.

**Done when:** the ten searches in §2.5 each land on the right article, verified by a test over the scorer.

### Phase 3 — hotspots (2 days)

- `HelpProvider`, `HelpSpot`, `HelpSheet`, `HelpPalette`.
- `help-spots.ts` registry, `gen-help-ids.ts`, generated `help-ids.ts`, CI drift check.
- `/api/admin/help/[id]`.
- Place hotspots on Menu & pricing, Hours & pause and the kitchen queue first — the three screens staff touch every shift.

**Done when:** `?` opens the palette, a spot opens the drawer at the right anchor, a driver who signed in at `/admin/login` with their own PIN sees the kitchen spots on `/kitchen` and none of the others, and a tablet signed in at `/kitchen/login` with the shared PIN falls back to the kitchen role rather than showing no help at all (§4.1).

### Phase 4 — runbooks (2 days)

- All twelve runbooks from §6.
- Runbooks band at the top of `/admin/help`.
- Full-screen sheet treatment on `/kitchen`.
- Runbook heading-format test.

**Done when:** someone who has never used the back office can pause ordering, mark an item sold out and reject an order from the runbook alone.

### Phase 5 — the rest of the screens (2–3 days)

- The remaining **fourteen** screen articles and their hotspots from §5 (Phase 1 writes two of the sixteen: `kitchen-queue` and `menu-and-pricing`).
- The remaining **three** universal articles (Phase 1 writes `signing-in`).
- Every assertion in §7.2 live, including the JSX-versus-registry check.
- `/admin/help` added to `lighthouserc.json`.

**Done when:** the "every screen has an article" test passes with no exclusions.

### Phase 6 — tenant authoring and polish (1–2 days)

- Tenant override loading proven with a real `config/farm-pizza/help/` folder: `who-to-ring` and a `kitchen-queue.append.md` naming the actual tablet and the actual manager.
- A short authoring guide in `content/help/README.md` — how to add an article, what the frontmatter fields mean, and the keyword rule.
- Optional `HelpFeedback` table and the thumbs control.

**Done when:** a new tenant can be given shop-specific help without a code change.

**Total: roughly 10-12 working days.** Phases 0-4 are the useful half; if it has to stop somewhere, stop after phase 4 with the fourteen remaining screen articles as a backlog.

---

## 9. Out of scope

- A customer-facing help centre or FAQ. Different audience, different content, different route tree.
- Video or screenshots. Screenshots go stale within a sprint and there is no process here to keep them current.
- Search across orders, customers or menu items from the palette. Tempting, but it turns a help feature into a command bar and doubles the permission surface.
- Translation. The platform is English-only throughout, including every hard-coded SMS body.
- Editing help from inside the app. Articles are files in git, reviewed like code.
- Any change to the defects the help describes. This spec documents behaviour as it is today; fixing the promo re-enable bug or the campaign `kind` defect is separate work, and each fix means an edit to the article that explains it.
