# Pizza Party: a second tenant, and a white-label app

**Date:** 2026-09-07
**Status:** design approved, not yet planned
**Scope:** onboard Pizza Party (162 Dock Road) as the platform's second shop, and turn the existing Farm Pizza app into a per-shop build of one codebase.

---

## 1. Why this is cheap

Almost all of it already exists.

The web platform was built white-label from the start: one codebase, one deployment per shop, everything shop-specific in `config/<slug>/`. `pnpm new-client` scaffolds a tenant and the README documents onboarding as four steps. Adding Pizza Party's website requires **no code changes** — it is menu data, artwork, config and a Coolify service.

The app is nearly as good. `farm-pizza-app` already fetches the shop's name, logo, primary colour, hero and banner from `GET /api/config/mobile` at runtime, so most branding is already server-driven. Only what EAS needs at *build* time is hardcoded — and that is nine small touch points, listed in §4.

What is genuinely new: nothing architectural. This spec is mostly a sequencing and data-entry document, plus one contained refactor.

## 2. Decisions

Settled during brainstorming, recorded so the plan does not relitigate them.

| Decision | Choice | Why |
|---|---|---|
| App distribution | One codebase, **one store listing per shop** | Matches the web model. Each shop gets its own icon, name and listing — which is also the thing that sells the platform to the next operator. |
| Order of work | **Pizza Party site first**, then the app | The site is days of data entry; the app is a refactor. The friend feels progress immediately, and the app refactor then has two real tenants to prove itself against. |
| Look and feel | **Same theme, rethemed by config** | Their logo, colours, photography, copy and menu — same layout and components. Identity comes from colour, name and pictures. Every future fix reaches both shops. |
| App repo location | **Stays its own repo**, becomes white-label | The EAS project, iOS credentials, ASC app id `6809105512` and TestFlight history are attached to that repo's Expo slug. Moving it into the monorepo risks all of that, and Expo Metro over pnpm workspaces is a known source of pain, for a gain the runtime config endpoint already delivers. |
| Payments | Reuse the **Stripe sandbox** credentials; cash and card | Real keys when the owner provides them. See the go-live blocker in §7. |
| Domain | **Their own**, `pizzapartyonline.co.uk` | Build on a staging subdomain, cut DNS over at launch. See §3.4. |

## 3. Part one — Pizza Party as a tenant

### 3.1 What we know about the shop

Verified 2026-09-07 across their own site, the Foodhub marketplace and their Uber Eats store. Full detail in [pizza-party-menu-source.md](../../pizza-party-menu-source.md).

- **Pizza Party**, 162 Dock Road, **Tilbury, Essex RM18 7BS** — Tilbury, not Grays.
- Phone **01375 400001**.
- Hours: **Sun 15:00–22:30, Mon–Sat 15:00–23:00**. Evening-only, which matters for the availability pill and for scheduling automations.
- **4.7 from 355 reviews** — worth capturing, because the platform's review-request engine needs `contact.reviewUrl` set or it stays dormant.
- Delivery 45 min, pickup 15 min. Both fulfilment methods offered. No alcohol, so the app's age rating stays low.
- Sizes: 10", 12", 15".

**Prices must come from their own domain, not the Foodhub marketplace.** foodhub.co.uk lists the same items roughly 4% dearer (Big Family Deal £34.30 there against £32.99 on their own site). Seeding marketplace prices would quietly raise every price in the new shop.

### 3.2 The menu

Eleven categories. Comparable in size to Farm Pizza's 68 products, so this is a known quantity rather than an unknown.

| Category | Items |
|---|---|
| Special Offers | Any 2 Pizza Offer, Any 3 Pizzas Offer, Pizza Party Special Deals |
| Pizzas | 27 named |
| Burgers | 3 |
| Wraps | 3 |
| Pasta | collapsed on their site — needs expanding |
| Grilled Chicken Leg Quarters | 7 |
| Sides, Dips, Kids Meals, Desserts | collapsed — need expanding |
| Drinks | Cans, Bottles |

Named deals: Set Deal, Big Family Deal (£32.99), Party Deal For 4 (£23.99), Pizza Party Deal, Boneless Box, Box Mix. All expressible with the existing `MenuDealSchema` / `DealSlotSchema`.

The full item list with descriptions is captured in [pizza-party-menu-source.md](../../pizza-party-menu-source.md). **Prices are the gap** — only five are confirmed. Their own site loads each category through a client-side API that rejects unauthenticated calls, and the Uber Eats store has been closed since December 2024 so it shows items without prices. The cheap route is to ask the owner for Foodhub's operator menu export or a printed menu: one message, and authoritative rather than inferred. `scripts/import-real-menu.py` is the precedent for turning whatever arrives into `menu.json`.

### 3.3 The one real gap: half-and-half

Pizza Party sells a **Half And Half Pizza**. The menu schema has no concept of it — `packages/config/src/schema.ts` and `apps/web/src/lib/pricing.ts` contain nothing for splitting a pizza, and neither does `config/_schema/menu.schema.json`.

**Resolution: model it, do not build it.** A "Half And Half" product with two modifier groups — one per half — priced as a normal product. No code, no pricing changes, no divergence between web and app. If the owner later wants true half-and-half pricing (the dearer half wins, which is the usual rule), that is a separate piece of work with a real pricing change behind it, and it should be costed on its own.

Deals need no such workaround: `MenuDealSchema` and `DealSlotSchema` already express "any 2 from category X", so all three of their offers map directly.

### 3.4 Deployment

A Coolify service of its own with `CLIENT_SLUG=pizza-party` and its own managed Postgres. Separate database, separate domain, separate Stripe account, separate customer list — the two shops share code and nothing else.

The domain needs care. If `pizzapartyonline.co.uk` still points at Foodhub while they are trading on it, we cannot take it. Build on a staging subdomain, let the owner see it, and cut DNS over on a chosen day once they are ready to leave Foodhub. That staging URL is also what the app's preview build points at.

Server headroom is no longer a concern: a 100GB volume now holds Docker (`/mnt/docker-data`, with `Docker Root Dir` genuinely moved and both mounts in `/etc/fstab`). 85GB free against a ~17GB transient deploy and perhaps 5GB steady state per shop.

## 4. Part two — the app goes white-label

### 4.1 The tenant layer

A `tenants/<slug>.json` file per shop, selected at build time by an `APP_TENANT` environment variable, holding only what EAS and the bundler need before the app can call the server: display name, Expo slug, iOS bundle identifier, Android package, URL scheme, splash and notification colour, icon paths and API URL.

Everything else keeps coming from `/api/config/mobile` at runtime, as it already does.

### 4.2 The nine touch points

| File | Hardcoded today | Becomes |
|---|---|---|
| `app.json` | name, slug, bundle id, scheme, splash colour, adaptive icon | `app.config.ts` reading the tenant file |
| `eas.json` | one API URL in three profiles, one submit block | per-shop build and submit profiles |
| `src/theme/tokens.ts` | full Modernist palette, accent `#C82323` | accent ramp derived from the tenant's primary; neutrals stay shared |
| `assets/images/` | one icon and splash set | per-tenant folders |
| `src/app/(tabs)/account.tsx` | `"Farm Pizza"` heading, share copy, siteUrl fallback | `config.shop.name`, already served |
| `src/app/order/[id].tsx` | `"My Farm Pizza order #…"` | `config.shop.name` |
| `src/app/checkout.tsx` | `farmpizza://` return scheme | tenant file |
| `src/app/intro.tsx` | `products/farm-pizza-classic.jpg` | tenant file |
| `src/lib/api.ts`, `src/lib/push.ts` | base URL fallback, notification colour | tenant file |

No screen, basket, checkout, auth or push logic changes. The refactor is confined to configuration and eight string sites.

### 4.3 Proving the refactor

Rebuild **Farm Pizza** from the white-label codebase first and confirm it is byte-for-byte the same app in behaviour — same bundle id, same Expo slug, same ASC app, TestFlight lineage intact. Only once that is proven does Pizza Party get a build. A refactor that changes two things at once cannot tell you which one broke.

### 4.4 Pizza Party's app

New bundle id, new App Store Connect app under the same LaunchFlow UK team (`64GY32R9Y2`), new Play listing, TestFlight, then release.

**Release is not upload.** An EAS submit puts a build on TestFlight; it does not reach a tester's phone until the release step runs. This has already caught us once.

## 5. Sequence

1. **Pizza Party config and menu** — scaffold, read the Foodhub menu, write `menu.json`, gather artwork, set ops and delivery zones. No code.
2. **Staging deploy** — Coolify service, Postgres, seed, staging subdomain, owner reviews.
3. **Go-live** — real Stripe keys, real staff PINs, DNS cutover off Foodhub.
4. **App refactor** — tenant layer, nine touch points, Farm Pizza rebuilt and verified unchanged.
5. **Farm Pizza actually released** — see §7.
6. **Pizza Party app** — build, submit, TestFlight, release.

Steps 1–3 and step 4 are independent and could overlap if there is appetite; steps 5 and 6 are strictly ordered.

## 6. Needed from the owner

Blocking step 3 or later, not step 1:

- Confirmed address and postcode; delivery postcode districts, fees, minimums, opening hours.
- Logo, brand colour, any photography they own.
- Google review URL, for the review-request engine.
- Live Stripe account.
- Decision on whether Play uses its own service account or keeps borrowing the Grays Park Masjid one.

## 7. Risks

**Test Stripe keys reaching production.** `stripeEnabled()` will run a shop on sandbox keys perfectly happily, and every order will look paid while no money moves. This is a go-live blocker on the checklist, not a nice-to-have.

**Farm Pizza's app has never been released.** It sits on TestFlight. Refactoring a codebase that has not been validated end to end means a later fault cannot be attributed — was it the refactor, or was it always broken? Getting one real release out of the current build first removes that ambiguity cheaply.

**Naming.** The platform repo is called `PizzaParty` but serves the `farm-pizza` tenant, and the new client is called Pizza Party. Renaming the repo to `launchflow-takeaway` before adding the tenant costs minutes now and prevents a category of confusion permanently.

**Menu drift.** Once seeded, the database owns the menu and config no longer does — re-seeding a trading shop is destructive. Get the menu right before go-live, not after.

## 8. Out of scope

- True half-and-half pricing (see §3.3).
- Any second front-end theme.
- Multi-tenancy within a single deployment — the one-shop-per-deployment model stays.
- Moving the app into the monorepo.
- Loyalty for Pizza Party unless they ask; Farm Pizza has it disabled.
