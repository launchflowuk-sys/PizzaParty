# Handoff: Farm Pizza — storefront + back office

## Overview
Farm Pizza is a three-shop pizza business in Essex (Grays, Chelmsford, Colchester) competing with the big chains on clarity: one order bar (mode · postcode · time), real prices with the size shown, a builder with a live total, a tracker that shows the oven. This package contains two working HTML prototypes — the customer **storefront** (12 screens) and the **back office** (11 screens) — plus an overview page, the design system stylesheet and the seed data they run on.

Market: UK, £, prices include VAT. Desktop-first (1200px content column). Ordering modes: Delivery, Collection, Dine-in table order, Table booking.

## About the design files
The `.dc.html` files in this bundle are **design references written in HTML** — prototypes that show the intended look and behaviour. They are not production code to ship. The task is to **recreate these designs exactly in the target codebase's environment** (React/Next, Vue, SwiftUI, etc.) using its own component patterns — or, if no codebase exists yet, to choose the most appropriate stack (recommended: Next.js + React, plain CSS custom properties, no UI kit) and implement them there. Where this README and the HTML disagree, the HTML wins: open it in a browser and measure.

Open `Farm Pizza Overview.dc.html` first — it links to every screen. Files open directly in a browser (they load `support.js`, `image-slot.js` and `_ds/…/styles.css` from this folder). Screens are addressable by URL hash (see Routes).

## Fidelity
**High-fidelity.** Colours, type, spacing, rules, copy and interactions are final. Recreate pixel-perfectly. All values come from the Modernist design system tokens in `_ds/modernist-…/styles.css` — never hard-code a colour, font or radius that a token already carries.

---

## Design system — Modernist (binding)
Read `_ds/modernist-869e83af-daff-45b7-a47a-e8582a2e3e2d/readme.md` and `styles.css`. Summary of the rules the designs obey:

- **One typeface**: Archivo (Google Fonts, weights 400 / 600 / 800). Headings weight 800, `letter-spacing:-0.02em`, `line-height ≈1.05`. Body 15px/1.55.
- **Ground** `#f3f2f2`, **surface** `#eae9e9`, **ink** `#201e1d`, **accent** `#ec3013`. Divider is ink at 40% (`color-mix(in srgb,#201e1d 40%,transparent)`).
- **Zero radius everywhere.** No rounded corners, not even on inputs, tags or buttons.
- **Rules, not cards**: major sections are separated by **2px** dividers; rows inside a list by **1px**. Menu tiles sit in a visible modular grid (2px borders on every cell), never as floating cards.
- **Flush-left labels**, including inside wide buttons (`justify-content:flex-start`). Nothing centred except numeric cells.
- **Photography is black and white** (`filter:grayscale(1) contrast(1.08)` via `.grayscale`). Never tint an image.
- **Red is spent sparingly**: primary button, small emphasis, one poster-style red field per page (the storefront's closing banner / Home B hero). Small red text uses `--color-accent-700` (#ae1800) for contrast.
- **States**: hover tints from the accent ramp (`.btn-primary:hover` → `#dd2b0f`, `:active` → `#ae1800`); focus ring `2px solid #ec3013, offset 2px`; disabled 45% opacity; `::selection` accent at 30%.
- Icons: Lucide, inline SVG on currentColor (the prototypes use almost none — arrows are typed `→`).

### Tokens (from styles.css)
Colours: `--color-bg #f3f2f2`, `--color-surface #eae9e9`, `--color-text #201e1d`, `--color-accent #ec3013`.
Neutral ramp 100→900: `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b`.
Accent ramp 100→900: `#fff2ef #ffe0d9 #ffc4b8 #ff9783 #ff563c #dd2b0f #ae1800 #7c1405 #4d170e`.
Spacing: `--space-1 4px, -2 8px, -3 12px, -4 16px, -6 24px, -8 32px`. Radius: all 0. Shadows: `sm 0 1px 2px rgba(45,43,43,.14)`, `md 0 3px 10px rgba(45,43,43,.16)`, `lg 0 12px 32px rgba(45,43,43,.22)`.

### Design-system components used (class → spec)
- `.btn` inline-flex, gap 6px, Archivo 800 14px, padding 8px 14.4px, 1px transparent border, radius 0. `.btn-primary` accent fill, text `#f3f2f2`. `.btn-secondary` 1px divider border, hover ink 7%. `.btn-ghost` accent text, padding-inline 4px. `.btn-block` full width, flex-start.
- `.tag` 11px, padding 3px 10px. `.tag-accent` bg `#fff2ef` text `#7c1405`; `.tag-neutral` bg `#f8f4f4` text `#444141`; `.tag-outline` 1px accent border, accent text.
- `.input` min-height 36px, padding 6px 10px, 14px, surface bg, 1px divider border, accent caret; `:focus-visible` accent border. `.field > label` 12px, ink 70%, 5px below.
- `.seg` inline-flex, 1px divider border; `.seg-opt` padding 7px 12px, 13px; adjacent options separated by 1px; checked option = accent fill with ground text.
- `.radio` inline-flex gap 8px 14px; `.dot` 16px circle 1.5px divider border; checked = accent fill with 4px inset ground ring. (Radios are the one circular element in the system.)
- `.nav` flex, gap 16px, padding 12px 16px, 2px divider bottom; `.nav-brand` Archivo 800 18px, `margin-right:auto`; links 14px inherit, hover/`aria-current="page"` accent.
- `.table` 14px; `th` 11px uppercase 0.08em tracking, ink 60%, 2px bottom rule; `td` padding 8px, 1px bottom rule; row hover ink 4%.

### Page-level constants used in the prototypes (not in the DS)
- Content column `max-width:1200px; margin:0 auto; padding-inline:32px`.
- Kicker: `12px, uppercase, letter-spacing .08em, color #ae1800`.
- Page h1: `Archivo 800 44px / 1.05 / -0.02em`. Hero display: 76px (Home A), 112px/0.96/-0.03em (Home B), 34px (Home C panel). Big numerals: 40–96px in accent.
- Image placeholder (until real photos exist): `repeating-linear-gradient(-45deg, #eae9e9 0 10px, #d7d3d3 10px 11px)` with a 10px `ui-monospace` caption like `photo · margherita · b/w`. Map placeholder: same idea with a 40px grid (`repeating-linear-gradient(0deg/90deg, transparent 0 39px, #d7d3d3 39px 40px)` on surface) and 14px square pins (ink for shops, accent for the live/selected one).
- Pulse animation (live markers): `@keyframes fp-pulse {0%,100%{box-shadow:0 0 0 0 #ffc4b8} 50%{box-shadow:0 0 0 6px #ffe0d9}}` 1.4s ease-in-out infinite.
- Toast: fixed, bottom 24px (storefront: centred; admin: right 24px), ink bg, ground text, 12px 16px padding, `--shadow-lg`, auto-hides after 2.6s.
- Square toggles (admin): 16–18px square, 2px accent border, accent fill when on, transparent when off.

---

## Routes
Both apps map one screen per URL hash and listen to `hashchange`; navigation also calls `history.replaceState('#screen')` and scrolls to top.

Storefront: `#home` (+ `#home-grid`, `#home-poster`, `#home-order` force a home direction), `#menu`, `#builder`, `#product`, `#cart`, `#checkout`, `#tracker` (with no live order it seeds a demo order at step 3), `#deals`, `#rewards`, `#stores`, `#account`, `#orders`.

Back office: `#dashboard #kitchen #orders #menu #inventory #promos #customers #dispatch #staff #settings #reviews`.

---

# STOREFRONT — `Farm Pizza.dc.html`

## Global chrome (every screen)
**Nav** (`.nav`, sticky top, ground bg, z 10, padding-inline `max(32px, (100% − 1200px)/2 + 32px)`): brand `FARM PIZZA` (→ home) · Menu · Build your own · Deals · Crust Club · Shops · **mode segmented control** (Delivery | Collection | Dine-in, `.seg`, radios) · account link (`Ada` when signed in, `Sign in` otherwise) · **Basket button** (`.btn-primary`, label `Basket · {count}` + ` · £{total}` when count > 0). All links `white-space:nowrap`. Active screen gets `aria-current="page"`.

**Closed banner** (only when tweak `storeOpen=false`): ink bar, ground text 13px: “We’re closed right now — {Store} opens at 11:00. You can still order ahead for later.”

**Context strip** (menu, builder, product, cart, checkout only): 1px rule below, 13px, 8px red square, text + right-aligned `Change` link (→ stores).
- Delivery: `Delivering to {postcode} · ASAP, {store.wait} · from {store}` (or the chosen time instead of ASAP)
- Collection: `Collecting from {store}, {address} · ready in 15–20 min`
- Dine-in: `Dine-in at {store} · table {n}`

**Added toast**: `Added {item}` + link `View basket · £{total}`.

**Footer**: 2px top rule; 4 columns (2fr 1fr 1fr 1fr, 13px): brand + blurb (“Dough made daily. Tomatoes, herbs and most of the veg from Rainham Hall Farm, Essex. Three shops, one oven each.”), Order links, Shops links, Help links; last line `© 2026 Farm Pizza Ltd · Made in Essex · Prices include VAT`.

## 01 Home — three directions (tweak `homeDirection`)
### A · Ruled grid (default)
1. Hero: grid `minmax(0,7fr) minmax(0,5fr)`, gap 56, padding 72/32/56. Kicker `Grays · Chelmsford · Colchester · open till 23:00`; h1 76px `Real pizza.<br>From a real farm.` (margin-left −0.05em optical); sub 17px/1.65 max 50ch; buttons `See the menu` (primary → menu), `Build your own →` (ghost → builder). Right: 440px-tall grayscale photo slot (`min-width:0; overflow:hidden`).
2. 2px rule. **Stat row** 4 columns: `28 min` Average delivery this week · `£9.50` A Margherita, medium, always · `0` Frozen ingredients on site · `4.8` From 2,140 reviews. Numerals Archivo 800 44px accent; labels 12px uppercase neutral-700.
3. 2px rule. **Tonight’s menu**: kicker + h2 36px `Eight pizzas. No filler.` + `Full menu →`. 4-column tile grid (first 4 pizzas) — see Tile spec.
4. **Deals this week**: ruled rows (2px), grid `120px 1fr 2fr auto`: price (32px accent) · title 20px + terms 12px · description · secondary button (label per deal).
5. **Red close**: accent field, padding 64/32; h2 64px ground `Order by 22:30.<br>Eat by 23:00.`; ghost button with 1px ground border `Start an order →` bottom-right aligned.

### B · Red poster
1. Full-bleed accent hero: grid `1fr 380px`, padding 80/32/64. Left: kicker (ground, 85% opacity) `Tonight · every shop · until 23:00`; h1 112px/0.96 `Two large.<br>£24.<br>Tonight.` Right: 2px ground-bordered panel with `Start your order`, three mode buttons (1px ground border; selected = ground fill + accent text), postcode input and time select rendered transparent with ground border/text, button `Order two large for £24 →` (ground fill, accent text, flush left), link `Or see the whole menu`.
2. `The pizzas` h2 36px + `Sides, drinks and desserts →`; 4-column tile grid of all 8 pizzas.
3. 2px rule; two columns each with a 14px square (accent / ink), h3 24px, copy, link: **Crust Club** (`Join or sign in →`) and **Three shops, one oven each** (`Find your shop →`).

### C · Order-first
Grid `380px 1fr`, gap 56. Left: sticky (top 88) 2px ink-bordered order panel: h1 34px `Order in three clicks.`; fields How (mode seg), Where (postcode), When (select: ASAP · about 30 min, 19:30…20:30), Shop (select of 3 shops with distance); `Start order →` primary block; link `Track a live order`. Right: kicker `Most ordered tonight`, h2 36px `Straight to the good part.`, 4 compact tiles (photo, name 15px, price, `Add`), then each category (Pizzas, Sides, Drinks, Desserts) as an h3 22px and ruled rows `1fr auto auto`: name 600 + desc muted · price · `Add` (+ `Customise` for pizzas).

### Tile spec (menu grid cell)
Cell: `border-right/bottom 2px divider`, grid has `border-top/left 2px` so every cell shows all four rules; padding 16; column flex, gap 10; hover bg surface. Contents: 4:3 striped photo placeholder with mono caption → row: name (Archivo 800 17px) / price (Archivo 800 17px, right) → description 13px neutral-700 (flex 1) → tags (`.tag-neutral`: V, VG, Spicy, VG option) + size note 11px neutral-600 (`Medium 11″ · small from £7.50`) → buttons `Add` (primary; adds a medium hand-stretched) and `Customise` (secondary; pizzas only → product).

## 02 Menu
Grid `200px 1fr`, gap 48. Left sticky rail (top 104): kicker `Menu`; category buttons stacked with 2px rules — Archivo 800 18px, name left, count right (Pizzas 8, Sides 4, Drinks 3, Desserts 2), active in accent; note 12px `V vegetarian · VG vegan. Every pizza can be made on a gluten-free base for £1.50.`; `Build your own →` secondary block. Right: h1 44px = category name (or `Results for “{q}”`), search input max 280px; 3-column tile grid; empty state `Nothing matches “{q}”. Try a topping, or clear the search.` Search matches name, description, category and ignores the category filter.

## 03 Build your own
Grid `1fr 380px`. Left: kicker, h1 `Your pizza, priced as you go.`, sub. Five numbered groups (h3 20px `01  Size` … `05  Toppings`; right-aligned 12px notes “Sets the base price”, “Veg £1.20 · Meat £1.60”):
- Size / Base / Sauce / Cheese: 4-cell ruled grids of `.radio` labels (padding 14) showing label 600 + price 12px (`£7.50` … or `+£1.00` / `Included`).
- Toppings: wrapping chips = `.btn-secondary` (off) / `.btn-primary` (on), label + 12px price at 75% opacity.
Right sticky (top 104) 2px ink-bordered summary: a **square pizza-box preview** (2px ink border, 12px inset surface square, size label Archivo 800 40px, mono `{n} toppings` bottom-left) that animates its side 150→190→230→270px for S/M/L/XL (`transition .25s`); summary rows (72px label column, 1px rules) Size/Base/Sauce/Cheese/Toppings; `TOTAL` kicker + price Archivo 800 40px accent; `Add to basket →` primary block; `Start again` ghost.

Default state: Medium, Hand-stretched, Farm tomato, Mozzarella, toppings Pepperoni + Hot honey (= £12.30).

## 04 Product detail
Grid `minmax(0,1fr) minmax(0,1fr)`, gap 56. Left sticky: square grayscale photo slot + 12px allergen line (`Allergens: gluten, milk[, celery]…`). Right: `← Back to the menu`, kicker = category, h1 = name, description 16px, tags. Pizzas only: **Size** list of `.radio` rows (1px rules, price right: base+delta), **Base** rows (`Included` / `+£1.00` / `+£2.00`), **Extra toppings** chips (same as builder). Bottom bar (2px top rule): quantity stepper built from `.seg` (− / qty / +, 40px cells) + primary button `Add to basket … £{unit×qty}` (space-between, flex 1). Adding goes to the basket.

## 05 Basket
Kicker `Basket`; h1 `{n} items · £{total}` or `Your basket is empty` (empty state copy: “Nothing in here yet. The Margherita is £9.50 and takes 12 minutes.” + `See the menu`, `Deals`). Grid `7fr 5fr`. Lines (2px top rule, 1px between): name 600, detail 13px muted, `Remove` 12px accent-700 text button · qty stepper · line total right (80px). Below: kicker `Goes well with` + 4 compact side tiles (name, desc, price, `Add`). Right sticky 2px ink-bordered summary: context line with red square; Subtotal; fee line (label `Delivery` / `Collection` / `Table service`, value `£2.49` or `Free`); discount line (accent-700, `−£x`, only when > 0); 2px rule; `Total` + Archivo 800 28px; promo input + `Apply`; 12px message; `Go to checkout →` primary block; fee note (`Free delivery on orders over £25. Add £x more.` / `Free delivery — you’re over £25.` / collection & dine-in notes).

## 06 Checkout
Grid `7fr 5fr`. h1 `Four questions, then the oven.` Four ruled sections, each `160px 1fr`: h3 18px `01  How` (mode seg + mode fields), `02  When` (select: As soon as possible / 19:30 … 20:30), `03  Who` (Name, Mobile, Email), `04  Pay` (seg Card | Apple Pay | Cash; card fields 2fr 1fr 1fr; helper copy for the others). Mode fields — Delivery: Address (full width), Town, Postcode, Note for the driver, helper `Delivering from {store} · {wait} · £2.49, free over £25.` Collection: shop select + helper. Dine-in: shop select + table select (4, 7, 12, 15, 21 · outside) + helper “The number is on the red square on your table.” Right sticky summary: `Your order · {store}`; lines `qty× / name+detail / total`; totals; **`Place order` primary block with the total right-aligned**, disabled when the basket is empty; legal line with shop phone. Placing an order clears the basket and opens the tracker.

## 07 Order tracker
Kicker `Order {no} · {Mode} · {Store}`; h1 56px = `Arriving about {eta}.` / `Ready to collect about {eta}.` / `Coming to table {n} about {eta}.` / when finished `Delivered. Enjoy.` etc.; sub `Placed at {time} · {payment} · £{total}`. **Progress bar** 4px neutral-300 track, accent fill width = step/5, `.6s` transition. **Six steps** in a 6-column grid: 14px square marker (done: accent fill · current: ground fill + accent border + pulse · todo: neutral-400 border) + label 600 14px + time 12px (`now` on the current step, `about {eta}` on the last). Steps by mode — Delivery: Order received, Preparing, In the oven, Quality check, Out for delivery, Delivered. Collection: … Ready to collect, Collected. Dine-in: … On its way to your table, Served. Steps advance automatically every 5s in the prototype (replace with real order events). Below, grid `7fr 5fr`: delivery shows a 360px map placeholder (shop pin ink, destination pin accent pulsing, straight route line); collection/dine-in show a 2px-bordered card with the address / table; when step = “Out for delivery” a driver row appears (`Sam is on the way`, `Electric van · EV19 FRM · 4.9 from 812 deliveries`, `Message Sam`). Right: `What’s coming` items + total + `Something wrong?` / `Order again`.

## 08 Deals & offers
h1 `Four deals. No small print you need a lawyer for.` + sub. 4-column ruled grid of deal cells (min-height 300): kicker 11px, price Archivo 800 56px accent, title 22px, description, terms 12px, primary button. Then `Codes` ruled rows `180px 1fr auto auto`: code in mono 15px 600, description, note, `Apply to basket` (applies and opens the basket).

## 09 Rewards — Crust Club
Signed out: h1 56px `A point for every pound. A pizza for every 250.`, sub, `Join Crust Club` primary + `Sign in` secondary.
Signed in: two columns — left: points Archivo 800 96px accent, `points, Ada. {n} more and the next medium is free.`, 4px progress bar (points/250), 12px scale `0` … `250 · free medium pizza`; right: `Stamp card · 7 of 10 · tenth pizza is on us`, 10 square stamps (2px accent border, 7 filled), meta `Tier Grower · Member since March 2025 · Lifetime £612`. Below: `Spend points` ruled rows (name + note · `{cost} pts` · `Redeem` secondary, disabled if unaffordable) and `How it works` 4 numbered rows. Redeeming deducts points and adds a £0.00 line to the basket.

## 10 Shops & table booking
h1 `Three shops in Essex.` + search input. Grid `5fr 7fr`. Left: ruled store rows (selected row surface bg): name 22px + distance, address, tags `Open · closes 23:00` (`.tag-accent`) and `Tables · booking` / `Takeaway only` (`.tag-neutral`) + `Delivery 25–35 min`, buttons `Order from here` (primary; selects store → menu) and `Directions` (ghost). Right: 320px map placeholder with three square pins (selected shop accent) and labels; then two columns: shop details table (Hours, Phone, Address, Eat in) and **Book a table** (Day / Time / People selects + primary block `Book at {Store} →`; disabled `No tables at Colchester`). Confirmation: 2px accent-bordered box `Booked. Ref FB-{n}` · `{Store} · {day} · {time} · table for {n}` · “We hold the table for 15 minutes. Text confirmation sent.” · `Cancel booking` ghost.

## 11 Sign in / account
Signed out: two columns split by a 2px vertical rule. Left: kicker `Sign in`, h1 `Welcome back.`, Email/Password, `Sign in →` primary block, `Forgotten your password?` Right: kicker `New here`, h2 32px `Create an account in one step.`, copy, Mobile field, `Text me a code` secondary block. Any sign-in click signs in as Ada Okafor.
Signed in: h1 `Ada Okafor`; actions `Order history`, `Crust Club · {points} pts`, `Sign out` (ghost). 3-cell ruled grid: **Details** (Name, Mobile, Email, `Save`), **Addresses** (Home `Default` tag — 14 Orsett Road, Grays RM17 5DA; Work — Unit 3, Thurrock Park Way, Tilbury RM18 7HL; `Add an address`), **Payment & preferences** (Visa ending 4421 · 09/28; Apple Pay · Linked; three checkbox rows using `.radio` styling).

## 12 Order history
h1 `Your last four orders` + `Track the live order` secondary. `.table` columns: Order (mono) · Date · Items · Shop · Mode · Total (right, 600) · Status (`.tag-neutral`) · `Reorder` (secondary; re-adds the items and opens the basket). Footnote about receipts.

## Storefront state & logic
```
screen, homeDir, mode ('delivery'|'collection'|'dinein'), storeId, cart[] {key,name,detail,unit,qty},
promoInput, promo, promoMsg, productId, pOpts {size,crust,extras[],qty}, b {size,crust,sauce,cheese,toppings[]},
signedIn, order, step (0–5), postcode, when, pay ('card'|'apple'|'cash'), menuCat, query, booking, bookingForm,
table, addr {line1,city,pc}, contact {name,phone,email}, storesQuery, points (184), added (toast)
```
- **Cart merge key**: `{itemId}:{size}:{crust}[:{extra}…]` for pizzas, `{itemId}` for others, `build:…`, `deal:{id}`, `free:dough`, `reward:{id}`. Same key → increment qty.
- **Pricing**: pizza unit = menu price (medium) + size delta (S −2.00, M 0, L +2.50, XL +5.00) + crust delta (Deep pan +1.00, Stuffed crust +2.00) + extras (veg £1.20, meat £1.60). Builder = size base (7.50 / 9.50 / 11.50 / 13.50) + crust + cheese (Extra mozzarella +1.20, Vegan +1.00) + toppings.
- **Delivery fee** £2.49 when mode = delivery and 0 < subtotal < £25; else free. Collection/dine-in never charge.
- **Promo codes**: `FARM25` 25% off (collection only — otherwise message “FARM25 is for collection orders. Switch to collection to use it.”), `STUDENT20` 20% off, `FREEDOUGH` adds Garlic Dough Balls at £0 if the basket contains a pizza. Unknown: “We don’t recognise that code.” Total = max(0, subtotal − discount + fee).
- **Order**: number `#482xx`, times at +0, +3, +9, +17, +21, +33 minutes; ETA = placed + 33 min. Payment label `Paid by card ending 4421` / `Paid with Apple Pay` / `Paying with cash`.
- **Tweaks** (props): `homeDirection` enum, `signedIn` bool (default true), `storeOpen` bool (default true).

## Seed data — storefront
Menu (id · name · description · medium price · tags):
Pizzas — margherita Margherita “Fior di latte, farm tomato sauce, basil” £9.50 V · farmhand The Farmhand “Pulled ham hock, field mushrooms, mature cheddar” £12.50 · hothoney Hot Honey Pepperoni “Cured pepperoni, chilli honey, mozzarella” £12.00 Spicy · garden Garden Veg “Roast peppers, courgette, red onion, olives” £11.00 V, VG option · bbq BBQ Chicken “Free-range chicken, smoky BBQ, sweetcorn” £12.50 · fourcheese Four Cheese “Cheddar, mozzarella, blue, goat's” £11.50 V · meat Meat Feast “Pepperoni, sausage, ham hock, bacon” £13.50 · mushroom Wild Mushroom “Chestnut and oyster mushrooms, garlic butter, thyme” £12.00 V.
Sides — Garlic Dough Balls “Twelve, with garlic butter” £4.50 V · Rosemary Fries “Skin-on, sea salt” £3.50 VG · Chicken Wings ×8 “Hot honey or smoky BBQ” £6.50 · Farm Salad “Leaves, radish, lemon dressing” £4.00 VG.
Drinks — Cloudy Apple Juice “330ml, pressed in Kent” £2.50 · Cola “330ml can” £1.80 · Sparkling Water “500ml” £1.50 (all VG).
Desserts — Cookie Dough “Warm, with vanilla ice cream” £4.50 V · Apple Crumble “Bramley apples, oat crumble” £4.00 V.
Sizes: Small 9″ · Medium 11″ · Large 13″ · XL 15″. Crusts: Hand-stretched, Thin & crispy, Deep pan, Stuffed crust. Sauces: Farm tomato, Smoky BBQ, Garlic cream, No sauce. Cheeses: Mozzarella, Extra mozzarella, Vegan cheese, No cheese. Toppings (meat £1.60): Pepperoni, Ham hock, Chicken, Bacon, Sausage; (veg £1.20): Mushrooms, Red onion, Peppers, Olives, Sweetcorn, Jalapeños, Spinach, Pineapple, Hot honey.
Deals: Two for Tuesday £20 “Any two medium pizzas.” (Tuesdays only · delivery or collection) · Family Feast £32 “Two large pizzas, two sides and a 1.5L drink.” (Every day · saves about £9) · Lunch Slice £8.50 “Any small pizza and a drink.” (Weekday lunchtimes · collection only) · Two Large £24 “Any two large pizzas, any toppings.” (Every day after 5pm).
Stores: Grays — 42 High Street, Grays RM17 6LU · 0.8 mi · 11:00 – 23:00 · 01375 400 400 · delivery 25–35 min · tables. Chelmsford — 118 Moulsham Street, Chelmsford CM2 0JD · 18 mi · 11:00 – 23:00 · 01245 400 400 · 30–40 min · tables. Colchester — 9 Crouch Street, Colchester CO3 3EN · 39 mi · 11:30 – 22:30 · 01206 400 400 · 30–40 min · takeaway only.
Order history (Ada): #48213 Tue 1 Sep — Hot Honey Pepperoni 13″, Garlic Dough Balls — Grays — Delivery — £19.00 Delivered · #47902 Fri 28 Aug — Margherita 11″, Garden Veg 11″, Cloudy Apple Juice — Grays — Collection — £23.00 Collected · #47555 Sat 22 Aug — Meat Feast 15″, Chicken Wings ×8, Cola, Cola — Chelmsford — Delivery — £28.60 Delivered · #47120 Sun 16 Aug — Four Cheese 11″, Cookie Dough — Grays — Dine-in — £16.00 Served.
Rewards: Free medium pizza 250 pts · Free side 80 pts · Free drink 40 pts. Ada: 184 pts, Grower, 7/10 stamps.

---

# BACK OFFICE — `Farm Pizza Admin.dc.html`

## Global chrome
Grid `232px minmax(0,1fr)`. **Sidebar** (sticky, full height, 2px right rule, padding 20/16): brand `FARM PIZZA` + kicker `Back office`; store select (Grays · High Street / Chelmsford · Moulsham St / Colchester · Crouch St); vertical nav — rows with 1px rules, 9px 6px padding, an 8px square marker (accent on the active row), label, optional `.tag-accent` badge (kitchen = live tickets, inventory = lines below par, dispatch = ready deliveries without a driver, reviews = unanswered); bottom: `Ada Okafor` · `{Role} · on shift since 16:58` · link to the storefront.
**Header**: kicker `{Store} · Friday 4 September · {clock}`, h1 32px = screen title; right: pulsing 8px red square + `Live · {n} in the kitchen · {n} on the road`, secondary button `Pause online orders` / `Resume online orders`.
**Paused banner** (accent field): “Online orders are paused for {Store}. The storefront shows “Back soon”; phone and walk-in orders still come through.” + ground-outlined `Resume`.
Toasts confirm every action (bottom-right).
Screen titles: Tonight at a glance · Kitchen queue · Orders · Menu & pricing · Inventory & stock · Promotions & coupons · Customers · Dispatch & drivers · Staff & roles · Store settings & hours · Reviews & feedback.

Common patterns: **KPI cells** = ruled 4-column grid, label 11px uppercase neutral-700, value Archivo 800 32–40px, delta 12px. **Detail panel** = right column 340px, sticky top 24, 2px ink border, padding 20, 13px. **Selected row** = surface bg. Status tags: New/Preparing/In oven → `.tag-accent`; Ready/Out for delivery → `.tag-outline`; Completed/Refunded → `.tag-neutral`.

## 01 Dashboard
KPI row: Revenue today £2,148 (+12% on last Friday, accent-700) · Orders 137 ({n} in the kitchen now) · Average ticket £15.68 (Sides attach rate 61%) · On time 94% in accent (Avg delivery 28 min · target 30). Grid `7fr 5fr`: **Orders by hour** — 12 bars 11:00–22:00, 180px tall, ink fill (19:00 in accent), outlined bars behind = last Friday; values today [6,14,9,7,5,8,12,19,24,17,10,6], last [5,12,10,6,6,7,11,16,20,18,11,7]. **Channel mix** horizontal bars Web 58 · App 27 · Phone 9 · Table 6. **Top sellers** ruled list (rank, name, sold — from menu data). Right: `Needs attention` 2px-bordered list of alert links (low stock, ready deliveries without driver, unanswered reviews, “Pizza boxes 13″ will run out by Sunday at this rate”, paused state); `Live feed` last 6 orders (mono no · customer · summary · status tag · total); three mini stats On shift 6 · Drivers out {n} · Reviews today 4.7.

## 02 Kitchen queue
Helper line + `Oven at 420°C · 2 decks` tag. Four ruled columns (min-height 520): **New · Preparing · In the oven · Ready**, header = name + count in accent 22px. Tickets: surface bg, padding 12, 4px left edge (ink; **accent when elapsed > 20 min**), mono order no + elapsed `{n} min` (Archivo 800 16px, accent when late), tags mode/channel (+ `.tag-accent` note e.g. `Allergy: celery`), item lines `q× name`, customer 12px, primary block button whose label depends on status: New `Start` → Preparing `Into the oven` → In the oven `Out of the oven` → Ready `Hand to driver` (delivery, moves to Out for delivery) / `Handed over` (collection) / `Sent to table` (dine-in). Oldest first. Empty column: `Nothing here.` Elapsed times tick every 8s; tweak `kitchenAutoAdvance` advances the oldest live ticket each tick.

## 03 Orders
Toolbar: mode seg (All | Delivery | Collection | Dine-in), status select (Every status / Live only / Completed), search (order, name, phone), count `x of y orders tonight`. `.table`: Order · Placed · Customer · Mode · Items · Total · Status; click selects. Detail panel: no (22px) + status tag; Customer, Mode · channel, Placed · elapsed, Driver (`Not yet assigned` / `n/a`), Note (accent-700); item lines; Total 22px; 2×2 buttons: advance (label as kitchen; disabled when completed), `Print ticket`, `Text customer`, `Refund` (→ `Refunded`, disabled after).

## 04 Menu & pricing
Toolbar: category seg (All | Pizzas | Sides | Drinks | Desserts), note “Prices are for a medium 11″. Sizes step −£2 / +£2.50 / +£5.”, `Add item` primary (adds “New pizza” at £12, sold out, and opens it in the editor). `.table`: Item (name + desc) · Category · Price (`£` + 72px inline input, edits live) · Sold today · Margin · Availability (`On sale` `.tag-accent` ↔ `Sold out` `.tag-neutral`, click toggles) · `Edit` ghost. Editor panel: Name, Description (textarea), Category select, Price, photo placeholder “drop to replace”, tags Live on web / Live on app / All shops, `Save changes` primary + `Remove` ghost.

## 05 Inventory & stock
KPI: Out of stock (accent) · Below par · On order · Next delivery `Sat 06:30 · Marsh Dairy`. Helper + `Start stock count` secondary + `Reorder everything below par` primary. `.table`: Ingredient · On hand · Par · Level (120×10px bar, ink; accent when below 50% par) · Supplier · Status (OK neutral / Low, Out accent / Ordered outline) · `Reorder` → `On order` (disabled). Seed: Dough (portions) 140/200 in-house · Fior di latte 6/12 kg Marsh Dairy · Farm tomato sauce 18/20 L Rainham Hall Farm · Pepperoni 2.5/6 kg Cobble Lane Cured · Ham hock 0/4 kg Wicks Manor · Mushrooms 5/6 kg · Hot honey 1.2/3 L in-house · Pizza boxes 13″ 90/300 Essex Packaging · Cola 330ml 210/240 cans Booker · Cookie dough 34/40 portions.

## 06 Promotions & coupons
KPI: Redemptions · 30 days 2,914 · Revenue with a promo £41,860 · Discount given £6,120 (accent). `.table`: Promotion · Code (mono) · Type · value · Runs · Uses · Revenue · Active (18px square toggle). Seed: Two for Tuesday — Bundle £20 Tuesdays 412 £8,240 · Collection 25% off FARM25 Percent 25% 1,188 £16,430 · Student discount STUDENT20 20% 640 £7,900 · Free dough balls FREEDOUGH Free item £4.50 502 £6,410 · Two Large Bundle £24 After 5pm 172 £4,128 · Lunch Slice Bundle £8.50 Mon–Fri 11–3 0 £0 (inactive). Panel **New promotion**: Name, Type seg (Percent | Fixed | Bundle; value label changes: Percent off / Pounds off / Bundle price (£)), Value, Code (optional), Channels chips (Web, App, Phone, In-store; primary when on), Starts/Ends, `Create promotion →` (prepends the row; requires a name).

## 07 Customers
Search + count + `Export CSV`. `.table`: Customer · Contact · Orders · Lifetime · Last order · Crust Club tier tag (Farmer accent / Grower outline / Seedling neutral). Detail panel: name 22px, phone · email, three stats (Orders, Lifetime, Points), Usual order, Address, `Notes for the kitchen` textarea (persists), `Send an offer` primary, `Text` secondary. Seed: Ada Okafor 27 orders £612 Grower 184 pts (note “Allergic to celery — flag on every ticket.”) · Hannah Bright 41 £948 Farmer · Marcus Webb 9 £171 Seedling (“Phones in, never online.”) · Priya Shah 18 £503 Grower · Jon Slater 6 £98 Seedling · Marta Kowalski 33 £702 Farmer · Olu Adeyemi 12 £214 Seedling.

## 08 Dispatch & drivers
Grid `7fr 5fr`. Left: 380px map placeholder (shop = 16px ink square at 46%/52%; each driver on delivery = pulsing accent square + `First name · #order`), then **Drivers** `.table`: Driver · Vehicle · Status (On delivery accent / Available outline / Off shift neutral) · Order · Back at. Right: **Ready to go** bordered list of ready delivery orders with a `Assign driver…` select listing available drivers — assigning moves the order to Out for delivery, marks the driver On delivery and toasts “{driver} assigned to {no} — customer texted.”; **Out for delivery** list with `{driver} · left {n} min after order · ETA {time}` and `Delivered` (frees the driver). Seed drivers: Sam Reid (EV19 FRM · e-van, on delivery #48228, back 19:21) · Priya Nair (Cargo bike, available) · Tom Achebe (EV20 FRM · e-van, available) · Leah Quinn (Cargo bike, off shift).

## 09 Staff & roles
Left: helper `Eight on the books · six on shift tonight` + `Add staff`; `.table`: Name · Role (inline select) · Hours this week · Tonight (On shift accent / Off neutral) · PIN `••••`. Seed: Ada Okafor Manager 38 · Marco Bellini Head pizzaiolo 40 · Jess Whitmore Kitchen 22 · Sam Reid Driver 18 · Priya Nair Driver 16 · Tom Achebe Driver 12 · Leah Quinn Front of house 20 (Off) · Owen Hart Shift lead 35 (Off). Right: **Role permissions** matrix (rows: Refunds, Void orders, Edit menu & prices, Pause online orders, Cash up, View reports, Edit staff & rotas; columns: Manager, Shift lead, Kitchen, Driver, Front of house) of 16px square toggles; Manager column locked on.

## 10 Store settings & hours
Two columns. Left: **Shop** (Trading name, Address, Phone, Manager on duty), **Delivery** (Radius 3 miles, Delivery fee 2.49, Free over 25, Minimum order 12, Quoted wait 25–35, Collection ready in 15), **Order modes** ruled rows with square toggles (Delivery · Within {radius} miles; Collection · Ready in 15 min; Dine-in · Order from the table by QR; Table booking · 14 tables · parties to 8), `Save changes` + pause button. Right: **Opening hours** — 7 rows `toggle · day · open input · – · close input · note` (Mon–Thu 11:00–23:00, Fri–Sat 11:00–23:30 “Late close”, Sun 12:00–22:00; off → inputs disabled, note `Closed`), footnote about online ordering closing 30 min early; **Table booking** (Tables 14, Largest party 8, Hold for 15 min).

## 11 Reviews & feedback
Grid `300px 1fr`. Left sticky: `4.7` Archivo 800 72px accent, `from 2,140 reviews · 96% would order again`, 5-row histogram (5★ 74%, 4★ 15%, 3★ 6%, 2★ 3%, 1★ 2%; ink bars), source lines Google 4.8 · 1,320 / Order receipts 4.6 · 720 / Median reply time 3h 10m. Right: seg (All | Needs reply | Replied) + count. Review blocks (2px rules): five 10px squares (accent border, filled to rating), name 600, `date · channel · order`, `Needs reply` tag right-aligned; text 15px/1.55 max 70ch; existing reply shown with a 2px accent left rule, prefixed `Farm Pizza replied:`; actions `Reply` (opens textarea + `Send reply` / `Cancel`) and `Send £5 voucher`. Seed reviews: Hannah B. 5★ Google #48190 · Dev P. 3★ Receipt #48102 · Marta K. 5★ (replied) · Jon S. 2★ (replied) · Olu A. 4★ — full texts in the HTML.

## Back-office state & logic
```
screen, storeId, now/t0 (clock), toast, paused,
orders[] {no,min,cust,mode,ch,lines[{q,n}],total,status,driver?,note?,refunded}, selOrder, modeFilter, statusFilter, orderQuery,
menu[] {…,available}, menuCat, editId, editDraft, inventory[] {…,ordered}, promos[], np (new-promo form),
customers[], selCust, custQuery, drivers[] {name,vehicle,status,order,back,x,y}, staff[], perms {role:[perm]},
settings {name,addr,phone,radius,fee,freeOver,minOrder,wait,modes[]}, hours[] {day,open,close,on},
reviews[] {…,reply}, reviewFilter, replyingId, replyText
```
Ticket status machine: `new → prep → oven → ready → out (delivery only) → done`; collection/dine-in go `ready → done`. Elapsed = seeded minutes + real minutes since load. Late threshold 20 min.
Tweaks (props): `role` enum Manager / Shift lead (hides Staff, Settings) / Kitchen (Kitchen, Orders, Inventory, Menu only); `kitchenAutoAdvance` bool; `onlineOrdersPaused` bool.
Seed orders (no · min ago · customer · mode · channel · items · total · status): #48231 2 Ada Okafor Delivery Web [Hot Honey Pepperoni 13″, Garlic Dough Balls] £19.00 new (note Allergy: celery) · #48230 4 Marcus Webb Collection Phone [2× Margherita 11″, Rosemary Fries] £22.50 new · #48229 7 Table 12 Dine-in Table [Four Cheese 11″, Farm Salad, 2× Cola] £19.10 prep · #48228 12 Priya Shah Delivery Web [Family Feast] £32.00 out (Sam Reid) · #48227 14 Ben Carter Delivery App [Meat Feast 15″, Chicken Wings ×8] £25.00 oven · #48226 16 Table 4 Dine-in [Wild Mushroom 11″, Cookie Dough] £16.50 ready · #48225 19 Hannah Bright Delivery Web [2× Two Large · Hot Honey + Garden Veg] £24.00 ready · #48224 23 Olu Adeyemi Collection Web [BBQ Chicken 13″] £15.00 ready · #48223 31 Jon Slater Delivery App [Garden Veg 11″, Apple Crumble] £17.49 done (Priya Nair) · #48222 38 Marta Kowalski Collection Web [The Farmhand 13″] £15.00 done.

---

## Interactions summary
- Hover: tiles/rows → surface bg; buttons per DS ramp. Focus: 2px accent ring. Transitions: progress bar `.6s`, pizza-box preview `.25s`; live markers pulse 1.4s.
- No modals are used; detail views are inline right-hand panels.
- Loading/empty states exist for: empty basket, no live order, no search matches, empty kitchen columns, nothing ready to dispatch, no drivers out.
- Validation is minimal by design (prototype): promo code recognition, empty promo name, disabled actions instead of error messages.
- Responsive: desktop only (≥1200px content). Mobile layouts are not designed yet.

## Assets
- Fonts: Archivo 400/600/800 from Google Fonts.
- Photography: none supplied. Every `image-slot` / striped placeholder marks where a black-and-white photograph goes (hero, product, kitchen ticket photo in the menu editor). Real photos must be run through the `.grayscale` filter.
- Icons: Lucide if needed; the prototypes use typographic arrows (`→`, `←`, `−`, `+`, `×`).
- Map tiles: placeholders — replace with a real map (Mapbox/Google) rendered in greyscale.

## Files
- `Farm Pizza Overview.dc.html` — brief, assumptions, screen index (start here).
- `Farm Pizza.dc.html` — storefront, 12 screens, all data and logic inline (template at the top, logic class in the `data-dc-script` tag at the bottom).
- `Farm Pizza Admin.dc.html` — back office, 11 screens, same structure.
- `_ds/modernist-869e83af-daff-45b7-a47a-e8582a2e3e2d/styles.css` + `readme.md` — the design system (tokens + component classes + rules).
- `support.js`, `image-slot.js` — runtime for viewing the prototypes in a browser; not part of the implementation.
- `CLAUDE_CODE_PROMPT.md` — a ready-to-paste prompt for Claude Code.
