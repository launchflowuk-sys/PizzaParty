# Prompt for Claude Code — turn the prototypes into a sellable product

Copy the `design_handoff_farm_pizza/` folder into your repo (e.g. `docs/design_handoff_farm_pizza/`), open Claude Code in the repo root, and paste everything below the line.

---

You are building **a white-label online-ordering platform for independent pizza shops** — a product I will sell to many shops. The customer storefront and the back office are already fully designed as working HTML prototypes in `docs/design_handoff_farm_pizza/`. Your job is to turn them into production software that looks and behaves **exactly** like the prototypes, then make it multi-tenant so each shop gets its own branded copy.

## Read first, in this order
1. `docs/design_handoff_farm_pizza/README.md` — full spec: every screen, layout, copy, interaction, state model and seed data.
2. `docs/design_handoff_farm_pizza/_ds/modernist-*/readme.md` + `styles.css` — the design system. Port `styles.css` as the global stylesheet, keeping every CSS custom property and class name identical. Tokens (`--color-*`, `--font-*`, `--space-*`, `--radius-*`) are the theming surface for tenants.
3. `docs/design_handoff_farm_pizza/Farm Pizza.dc.html` and `Farm Pizza Admin.dc.html` — the reference prototypes. Markup is between `<x-dc>` and `</x-dc>`; behaviour and seed data are in `class Component` inside the `data-dc-script` tag. Inline styles, copy and data there are the source of truth — copy verbatim, do not redesign. Open them in a browser to compare.

## Stack
Next.js (App Router, TypeScript) · PostgreSQL via Prisma · Auth.js (email/phone OTP for customers, email+password + roles for staff) · Stripe (Payment Intents + Apple/Google Pay) · Server-Sent Events or WebSockets for the live kitchen queue, tracker and dispatch · plain CSS on the ported `styles.css` (no Tailwind, no UI library) · Archivo from Google Fonts · Vercel + managed Postgres for deployment · Playwright for tests.

## Phase 1 — exact recreation (single tenant: Farm Pizza)
Storefront routes: `/`, `/menu`, `/build`, `/product/[slug]`, `/basket`, `/checkout`, `/track/[orderNo]`, `/deals`, `/rewards`, `/shops`, `/account`, `/orders`. Home supports `?home=grid|poster|order` (default grid).
Back office routes: `/admin/dashboard`, `/admin/kitchen`, `/admin/orders`, `/admin/menu`, `/admin/inventory`, `/admin/promos`, `/admin/customers`, `/admin/dispatch`, `/admin/staff`, `/admin/settings`, `/admin/reviews`; sidebar filtered by role (Manager / Shift lead / Kitchen) as specified.
Data layer: seed the database from the README data (menu, sizes, crusts, toppings, deals, codes, stores, orders, inventory, promos, customers, drivers, staff, permissions, hours, reviews). Implement the pricing, delivery-fee, promo-code and kitchen-status-machine rules exactly as written, with unit tests.
Fidelity rules (non-negotiable): zero border-radius; 2px section rules, 1px row rules; visible grid on menu tiles; Archivo only, headings 800 / −0.02em; flush-left labels including inside full-width buttons; black-and-white photos via `.grayscale`; red only for primary actions, specified numerals and the one red field per page; copy verbatim, UK spelling, £ with two decimals.
After each screen, compare your build with the prototype side by side at 1280px and fix every visual difference before moving on.

## Phase 2 — make it real
- Checkout charges through Stripe; orders are created server-side; the tracker and kitchen queue update live from order events, not timers.
- Kitchen queue works on a wall tablet (touch targets ≥ 44px, no hover-only affordances) and keeps working if the connection drops (queue + retry).
- Store hours, pause switch, delivery radius, fees and modes in Settings actually gate the storefront.
- Crust Club points accrue on paid orders; stamps and redemptions follow the README rules.
- Reviews arrive from order receipts (email/SMS link) and optionally Google; replies post back.
- Dispatch assigns drivers and texts the customer (Twilio); the tracker shows driver ETA.
- Table booking writes real reservations with a 15-minute hold.
- Accessibility: keyboard-operable everything, the design system's 2px accent focus ring, WCAG AA contrast (small red text uses `--color-accent-700`).

## Phase 3 — productise for many shops
- Multi-tenant: every record carries `tenantId`; tenants resolve by custom domain or `{slug}.yourplatform.co.uk`; row-level isolation enforced in the data layer.
- Tenant theme = the design-system tokens (accent colour, ground, ink, font family, logo, radius) stored per tenant and injected as CSS variables; layout and components never change. Farm Pizza is the default theme.
- Tenant onboarding wizard in `/admin/setup`: shop details, hours, menu import (CSV), Stripe Connect onboarding, domain.
- Platform owner console at `/platform`: tenants, subscription plans (Stripe Billing), usage, feature flags.
- Multi-store per tenant is already in the design (store switcher); keep it.
- GDPR: data export/delete per customer, cookie-free analytics (Plausible or self-hosted).

## Working method
Work phase by phase; do not start Phase 2 until Phase 1 matches the prototypes screen by screen. Keep a `PROGRESS.md` with a checklist of the 23 screens and the phase tasks, ticking as you go. Finish each phase by listing anything you could not match exactly and why.
