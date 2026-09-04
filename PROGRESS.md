# Modernist rebuild — progress

Converting the prototypes in `docs/design_handoff_farm_pizza/` into the live app.
Source of truth: the `.dc.html` files (where they and `README.md` disagree, the HTML wins).

## Deliberate deviations from the handoff

These are decisions, not omissions. Each one is a case where following the handoff
literally would have made the product worse for this client.

| Handoff says | What we did | Why |
| --- | --- | --- |
| Seed the DB from the README data (Grays / Chelmsford / Colchester, invented menu) | Kept the **real** Farm Pizza data — Basildon & Grays, verified phone, address, postcodes and the actual 16-product menu | The README's seed data is illustrative. Overwriting verified trading details of a live business with fictional ones would be a regression. Design from the mockups, data from reality. |
| `<link>` the Google Fonts stylesheet | Archivo via `next/font` (self-hosted, same family and weights) | A render-blocking font request would cost the Lighthouse 100 the storefront currently holds. Tokens are unchanged. |
| "No Tailwind" | Modernist CSS ported verbatim and imported **after** Tailwind; converted screens use only design-system classes | The repo has 20+ existing screens on Tailwind. Ripping it out before the rebuild lands would break every unconverted page. Tailwind gets removed once the last screen is converted. |
| Routes `/track/[orderNo]`, `/build`, `/rewards`, `/shops` | Not yet created | Existing app uses `/order/[id]`. Nav links to unbuilt routes are held back rather than shipped as 404s. |

## Foundation

- [x] Handoff copied to `docs/design_handoff_farm_pizza/`
- [x] `styles.css` ported verbatim to `apps/web/src/app/modernist.css` — every token, value and class name unchanged
- [x] Archivo 400/600/800 wired through `next/font`
- [x] Page-level constants the DS does not carry (`.fp-wrap`, `.fp-kicker`, `.fp-rule`, `.fp-photo`, `.fp-grid`, `.fp-cell`, `fp-pulse`)
- [x] Nav rebuilt to the prototype: flush-left brand, links, order-mode `.seg`, basket as the primary accent action
- [ ] Closed banner + order-context bar
- [ ] Toast (`Added X · View basket`)
- [ ] Footer converted off Tailwind

## Storefront — 12 screens

- [x] `#home` — Home A "Ruled grid" (hero, numerals, ruled menu grid, deals list, red closing banner)
- [ ] `#home-poster` — Home B "Red poster"
- [ ] `#home-order` — Home C "Order-first"
- [ ] `#menu`
- [ ] `#builder`
- [ ] `#product`
- [ ] `#cart`
- [ ] `#checkout`
- [ ] `#tracker`
- [ ] `#deals`
- [ ] `#rewards`
- [ ] `#stores`
- [ ] `#account`
- [ ] `#orders`

## Back office — 11 screens

- [ ] `/admin/dashboard`
- [ ] `/admin/kitchen`
- [ ] `/admin/orders`
- [ ] `/admin/menu`
- [ ] `/admin/inventory`
- [ ] `/admin/promos`
- [ ] `/admin/customers`
- [ ] `/admin/dispatch`
- [ ] `/admin/staff`
- [ ] `/admin/settings`
- [ ] `/admin/reviews`
- [ ] Sidebar filtered by role (Manager / Shift lead / Kitchen)

## Phase 2 — make it real

Much of this already works and predates the redesign: Stripe (success, decline and refund
all verified end to end), the kitchen status machine, SMS on placed/accepted/ready,
pre-order slots, promo codes, server-side repricing.

- [ ] Live kitchen queue / tracker over SSE (currently request-response)
- [ ] Kitchen usable on a wall tablet (44px targets, offline queue + retry)
- [ ] Settings gate the storefront (hours, pause, radius, fees)
- [ ] Crust Club points on paid orders
- [ ] Reviews from order receipts
- [ ] Dispatch + driver ETA
- [ ] Table booking with a 15-minute hold

## Phase 3 — multi-tenant

Not started. The repo is already config-driven per client (`config/<slug>/`), which is a
head start on tenant theming — the Modernist tokens are the theming surface.

## Fidelity checklist (applies to every screen)

- [ ] Zero border-radius anywhere
- [ ] 2px section rules, 1px row rules, visible grid on menu tiles
- [ ] Archivo only; headings 800 / −0.02em
- [ ] Flush-left labels, including inside full-width buttons
- [ ] Photography black and white via `.grayscale`
- [ ] Red reserved for primary actions, specified numerals, one red field per page
- [ ] Copy verbatim, UK spelling, £ with two decimals
- [ ] Compared against the prototype side by side at 1280px
