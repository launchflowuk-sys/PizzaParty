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
| Checkout draws raw card number / expiry / CVC fields | Stripe PaymentElement instead | Taking a card number into our own DOM puts the site in PCI scope. The prototype's card fields are a mockup; Stripe is the only correct implementation. |
| Desktop-first at 1200px, no mobile design given | Added a responsive layer: desktop is pixel-identical, layouts collapse below 1000px / 700px / 440px | Converted faithfully, the storefront overflowed a 375px phone by 111px and the product screen kept two 127px columns. Most takeaway orders come from a phone. The prototypes contain no mobile design at all, so these breakpoints are invented - worth a designer's eye. |

## Open decision — the primary button fails WCAG AA

`.btn-primary` is accent `#ec3013` filled with ground `#f3f2f2` text: **3.76:1**. AA needs
4.5:1 for normal-size text, and the button's 14px bold does not qualify as "large" (that
needs 18.66px bold). The design system's own readme acknowledges the accent/ground pair is
"tuned to at least 3:1 - enough for icons, large text and interface chrome, not for body
copy" and prescribes `--color-accent-700` for small accent text - but the primary button
inverts that pair and was not covered.

This is why accessibility scores 96 rather than 100; it is inherited from the design
system, not from the conversion. Handoff Phase 2 explicitly requires "WCAG AA contrast",
so the two requirements conflict.

Moving the fill to `--color-accent-700` (#ae1800) gives **6.41:1** and passes, at the cost
of a visibly darker red on every primary button. That is a brand decision, so it has been
left alone pending a call. A second, smaller one: bare links (e.g. the allergen link) are
distinguished by colour alone and want an underline.

## Foundation

- [x] Handoff copied to `docs/design_handoff_farm_pizza/`
- [x] `styles.css` ported verbatim to `apps/web/src/app/modernist.css` — every token, value and class name unchanged
- [x] Archivo 400/600/800 wired through `next/font`
- [x] Page-level constants the DS does not carry (`.fp-wrap`, `.fp-kicker`, `.fp-rule`, `.fp-photo`, `.fp-grid`, `.fp-cell`, `fp-pulse`)
- [x] Nav rebuilt to the prototype: flush-left brand, links, order-mode `.seg`, basket as the primary accent action
- [ ] Closed banner + order-context bar
- [x] Toast (`Added X · View basket`)
- [ ] Footer converted off Tailwind

## Storefront — 12 screens

- [x] `#home` — Home A "Ruled grid" (hero, numerals, ruled menu grid, deals list, red closing banner)
- [ ] `#home-poster` — Home B "Red poster"
- [ ] `#home-order` — Home C "Order-first"
- [x] `#menu` — category rail, live search, 3-up ruled grid
- [ ] `#builder`
- [x] `#product` — sticky photo, ruled size/base radios, topping chips, qty + add bar
- [x] `#cart` — ruled rows, "Goes well with", sticky 2px summary
- [x] `#checkout` — single page, four numbered ruled sections, sticky summary
- [x] `#tracker` — accent progress rule, square step markers, live over SSE
- [x] `#deals` — ruled deal grid with large accent prices, promo-code list
- [x] `#rewards` — built and gated on `loyalty.enabled` (off for this client, so it 404s)
- [x] `#stores` — `/shops`: ruled shop list, map placeholder, hours table
- [x] `#account` — ruled order history, points panel, saved addresses
- [x] `#orders` — merged into `/account`, as the data is the same list

## Back office — 11 screens

- [x] `/admin/dashboard` — ruled accent numerals, themed recent-orders table
- [x] `/admin/kitchen` — four-column ruled ticket board, 44px targets for a wall tablet
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
- [~] Kitchen wall tablet: 44px targets done; offline queue + retry still to do
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
- [x] Photography black and white via `.grayscale`
- [ ] Red reserved for primary actions, specified numerals, one red field per page
- [ ] Copy verbatim, UK spelling, £ with two decimals
- [ ] Compared against the prototype side by side at 1280px
