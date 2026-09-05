# Claude Design prompt pack — Farm Pizza takeaway platform

Every screen that exists in this codebase, written as a prompt you can paste into Claude
Design to get a high-fidelity design back. The content in each prompt is the real Farm
Pizza data from `config/farm-pizza/client.json`, `menu.json` and `ops.json` — not
placeholder text — so what comes back can be compared against what is actually built.

## How to use this file

1. Paste **Block A** (the design-system preamble) first, every single time. Claude Design
   has no memory of the last screen you asked for; if you skip the preamble you will get a
   rounded-corner card layout with drop shadows and it will not match anything.
2. Then paste **one** screen prompt from section 2 or 3. One screen per request. Asking
   for six screens at once gets you six thumbnails, not six designs.
3. Read section 4 before you start improvising additions to a prompt.

Three things to keep straight while you work:

- **The live config has one branch, Grays.** `client.json` carries a single location —
  7 Derby Road, Grays RM17 6QD, 01375 383877. Basildon is part of the business but is not
  in the config yet. Where a screen lists branches, the prompts ask for a two-row layout
  (Grays live, Basildon as a second branch) so the design survives the second shop being
  added, and each prompt says so.
- **The brand colour in config (`#C8322B`) is not the design-system accent (`#ec3013`).**
  The system accent is what every component actually uses. Design to `#ec3013`.
- **Not every screen is on the new design yet.** These are still on the older card
  styling and are being redrawn, so what comes back will not match them one for one:
  storefront — the town landing page, category pages, the deal builder shell, allergens,
  contact, privacy, terms, the product card, the sticky basket bar, and the 404 and error
  pages; back office — Menu & pricing, Promotions, Hours & pause, Orders, Deals and the
  LaunchFlow console. Each prompt below says so where it matters. Treat those prompts as
  the target, not as a picture of today.

---

## 1. Block A — the design-system preamble

Paste this above every screen prompt, unchanged.

```
DESIGN SYSTEM — MODERNIST (binding, do not reinterpret)

You are designing one screen of Farm Pizza, an independent pizza takeaway in Grays,
Essex (a second shop in Basildon is planned). The site already runs on a fixed design
system called Modernist. Every screen must obey it exactly. Where your instinct and the
system disagree, the system wins.

TYPEFACE
- Archivo only. Weights 400, 600, 800. No second typeface anywhere.
- Headings: Archivo 800, letter-spacing -0.02em, line-height 1.05-1.12.
  h1 42px, h2 32px, h3 25px, h4 20px, h5 16px, h6 13px.
  h6 is a label style: uppercase, letter-spacing 0.08em.
- Body: 15px / line-height 1.55, weight 400. Small print 12-13px. Captions 11px.
- Money, order numbers, postcodes and reference codes may be set in a monospace stack
  (ui-monospace / Menlo) at 10-13px. Nothing else is monospace.

COLOUR (use these hex values, do not invent new ones)
- Ground #f3f2f2. Surface (inset panels, selected rows, photo backing) #eae9e9.
- Ink #201e1d. Muted text = ink at 55%.
- Accent #ec3013 — used for tags, rules, markers, the radio dot, headline numerals and
  small red text. Accent hover #dd2b0f.
- IMPORTANT: filled controls do NOT use #ec3013. #ec3013 on the ground gives 3.76:1,
  below AA, so the build fills primary buttons and the selected segmented option with the
  deep step #ae1800 (hover #7c1405, pressed #4d170e), text #f3f2f2. Draw them that deep
  red, not the bright one, or the design will not match the product.
- Accent tints: 100 #fff2ef, 200 #ffe0d9, 300 #ffc4b8, 400 #ff9783, 800 #7c1405,
  900 #4d170e.
- Neutral ramp: 100 #f8f4f4, 200 #eae7e7, 300 #d7d3d3, 400 #bab6b6, 500 #9b9797,
  600 #7d7979, 700 #605d5d, 800 #444141, 900 #2d2b2b.
- Divider = ink at 40%.
- Red is spent sparingly: primary buttons, one or two small emphases, and at most one
  poster-style solid-red field per page. It is never a background wash for a section.

SHAPE AND STRUCTURE
- Zero border radius on everything. Buttons, inputs, tags, photos, panels, toggles.
  The radio dot is the only circle in the entire system.
- Rules, not cards. Major sections are separated by a 2px full-bleed ink-at-40% rule.
  Rows inside a list are separated by a 1px rule. Nothing floats.
- Tiles sit in a visible modular grid: 2px borders on every cell, no gaps between cells,
  no outer shadow. Hover fills the cell with surface #eae9e9.
- Labels are flush left inside full-width buttons; inline buttons centre their own label.
  Only numeric cells are right-aligned. No page content is centred.
- Generous whitespace: 40-64px of vertical padding between major sections, 32px page
  gutters, 24-56px between columns. The density comes from the rules, not from cramming.

COMPONENTS
- .btn: Archivo 800 14px, padding 8px 14px, radius 0, label centred by default.
  Primary = #ae1800 fill, text #f3f2f2. Secondary = 1px divider border, transparent fill.
  Ghost = #ae1800 text, no border. Block = full width, label flush left.
- .tag: 11px, padding 3px 10px. Accent tag = bg #fff2ef, text #7c1405.
  Neutral tag = bg #f8f4f4, text #444141. Outline tag = 1px accent border, accent text.
- .input: min-height 36px, padding 6px 10px, 14px text, surface fill, 1px divider border,
  accent caret. Label above at 12px, ink 70%, 5px gap.
- Segmented control: 1px divider border, options separated by 1px, 7px/12px padding at
  13px; the selected option is a #ae1800 fill with ground-coloured text.
- Radio rows: 16px circle, 1.5px divider border; selected = accent fill with a 4px inset
  ground ring. Multi-select uses square toggle chips, not checkboxes.
- Focus ring: 2px solid #ec3013, offset 2px, on every interactive element.
  Disabled: 45% opacity. Links are underlined (nav and footer links underline on hover).
- Arrows are typed characters (→), not icons.

PHOTOGRAPHY
- Flat-lay, top-down, single dish, shot on a plain mid-tone grey surface. Strong
  directional light, visible shadow, real texture (char blisters, flour, cheese pull).
- No props, no wooden boards, no scattered herbs, no hands, no restaurant interiors.
- One camera angle held across every food image; drinks are the exception and are shot
  three-quarter/straight-on.
- Images are full-bleed inside their grid cell with no border of their own — the cell's
  2px rule is the frame. Product tiles are 4:3. The site can flip all photography to
  grayscale with one switch, so the composition must read with colour removed.
- 22 of the 68 products have no photograph. Where a photo is missing, design a monogram
  tile: surface-coloured cell, a 2px neutral-300 inset border, the product's two initials
  in Archivo 800 at large size in neutral-300, and a small 10px monospace caption in the
  bottom-left corner. This is a designed state, not a broken image.

LAYOUT AND RESPONSIVE BEHAVIOUR (this matters — the original prototypes had no mobile
design at all and it caused real problems)
- Desktop-first. Content column max-width 1200px, 32px side gutters.
- Produce TWO artboards for every screen: desktop at 1200px wide, and mobile at 390px
  wide. Both are required. The mobile one is not an afterthought — most takeaway orders
  come from a phone.
- Named breakpoints and their behaviour:
  - Below 1000px: 4-up grids become 3-up; every two-column split (hero, product page,
    basket + summary, checkout + summary, menu rail + grid) stacks to one column;
    sticky sidebars and sticky product photos stop being sticky; 4-across stat rows
    become 2x2.
  - Below 700px: page gutters drop to 16px; grids become 2-up; the footer stacks to one
    column; paired form fields become one per row; the 5-step tracker becomes a 2-up
    grid; list rows reflow so the price sits right-aligned on its own line.
  - Below 440px: grids become a single column.
- The header has its own breakpoint at 760px, where it becomes three rows.
  On mobile it keeps the logo, the delivery/collection switch and the basket
  button; the nav links wrap to their own row. Anything with a basket in it also carries
  a sticky bottom bar: item count, total, and a full-width primary button.
- Tables never scroll horizontally on a phone. Convert each row to a stacked ruled block
  with the label above the value.

STATES
Every screen must be drawn in its populated state plus whichever of these apply:
empty (nothing to show yet, with a plain sentence saying so and one action),
loading (skeleton rules and blocks in neutral-200 — never a spinner over content),
error (a plain ink sentence in a 2px-bordered block, with the retry action),
disabled (45% opacity with the reason stated next to it, not a tooltip).
Write real error wording. "Something went wrong" is not acceptable copy.

VOICE
British English. Plain, short, no exclamation marks, no "delicious", no "crafted",
no emoji. Prices always as £8.39 with two decimals. Times as "35 min" or "19:45".
```

---

## 2. Storefront screen prompts

### S1 — Global shell: header, footer, sticky basket bar, toast

```
SCREEN: Global shell (appears on every storefront page)

PURPOSE: One frame every customer page sits in. It has to carry the brand, the order
mode, and the basket without ever pushing the food off the screen.

CONTENT
- Sticky header, 2px bottom rule, ground background:
  the shop's own logo — a 56x56 square raster mark (60x60 below 760px), NOT a drawn
  wordmark; leave it as a placed image and do not redesign it — then nav links
  Menu / Deals / Shops / Account, then a two-option segmented control
  "Delivery | Collection", then a basket button (primary, #ae1800 fill) showing
  "Basket · 3 · £34.28".
  There is deliberately no "Build your own" link and no "Crust Club" link — those screens
  do not exist yet. Do not add them.
- Footer, three columns under a 2px top rule:
  column 1 — FARM PIZZA as an Archivo 800 18px wordmark, 7 Derby Road, Grays RM17 6QD,
  and 01375 383877 as a tap-to-call link; column 2 — ORDER: Menu, Deals, Shops,
  My account, Grays delivery; column 3 — INFO: Contact & opening hours, Allergens,
  Privacy, Terms. Column heads are 12px uppercase at 0.08em in neutral-700.
  Then a 1px rule and a bottom row, 12px neutral-700, with
  "© 2026 Farm Pizza. Prices include VAT." flush left and "Powered by LaunchFlow" flush
  right.
- Sticky bottom bar (appears once the basket has anything in it; hidden on /basket,
  /checkout and the order tracker): a full-width primary button carrying "3" and
  "View basket" flush left and "Checkout · £34.28" flush right.
  (Today this bar is still on the older styling — a rounded count pill and a drop
  shadow. Redraw it to the system: square count block, no shadow, zero radius.)
- Toast: appears bottom-centre on desktop, above the sticky bar on mobile. 2px ink
  border, ground fill, no radius, no shadow. Copy: "Added Potato Wedges" with a
  "View basket" link beside it.
  (Today the built toast is inverted — ink fill, ground text, a large drop shadow.
  The version above is the correction; draw the correction.)

STATES
- Empty basket: the basket button reads just "Basket" and the sticky bar is absent.
- Shop closed: a full-width accent-filled strip directly under the header reading
  "We're closed now. Opens 11:00 tomorrow — you can still order for later."
- Loading: the basket count is a 40x14 neutral-200 block, nothing jumps when it resolves.

MOBILE (390px)
The header breaks at 760px into three rows: logo and basket button on row one, nav links
on row two, the delivery/collection switch full width on row three. Header stays sticky;
total header height must not exceed about 120px. Footer stacks to one column.
```

### S2 — Home page (`/`)

```
SCREEN: Home page (/)

PURPOSE: Prove in one screen that this is a real pizza shop with real food, and get the
customer into the menu.

CONTENT (in this order)
1. Split hero, 7fr / 5fr. Left: a small uppercase kicker "GRAYS", then the h1
   "Real pizza. / From a real farm." set very large in Archivo 800 with a hard line
   break, then the line "Home of the 20 inch pizza. Fresh, handmade, delivered.", then
   two buttons: primary "See the menu", ghost "Tonight's deals →".
   Right: one square flat-lay photograph of a whole pizza.
2. 2px rule.
3. A four-across statistics row, each cell an Archivo 800 accent numeral at 44px over a
   12px uppercase neutral-700 label. The real four, verbatim:
   "35 min / AVERAGE DELIVERY TIME" · "£8.39 / A ORIGINAL, ALWAYS" (the value is the
   cheapest size of the first featured pizza) · "0 / FROZEN INGREDIENTS ON SITE" ·
   "Open / TAKING ORDERS RIGHT NOW", the fourth being the live state, which flips to
   "Pre-order / ORDER AHEAD FOR LATER" when shut. The build shows no closing time here —
   if you add one, mark it as a proposed change.
4. 2px rule.
5. "TONIGHT'S MENU" kicker, h2 "4 pizzas. No filler." (the number is the count of
   featured products, and Farm Pizza has exactly four), a "Full menu →" link on the right,
   then a 4-column modular grid of those four featured products with 2px cell borders.
   Each cell: 4:3 photo; a row with the name in Archivo 800 17px flush left and the price
   in Archivo 800 17px flush right; a one-line description; an 11px line
   "5 sizes from 7" Small"; then two buttons — primary "Add", secondary "Customise".
   The four real items, all "£8.39": Original (Cheese & tomato), Pepperoni Lover,
   Farm Pizza Special, Meat Machine. Do not pad the row to six.
6. "DEALS THIS WEEK" kicker, then FOUR deal rows in a 120px / 1fr / 2fr / auto grid,
   2px rules above and below each — the first four deals in menu order:
   Meal for 1 £15.39 "Any 10" pizza, four pieces of garlic bread and a can of soft
   drink." / Meal for 2 £29.69 "Two 10" pizzas, onion rings, six hot wings, garlic bread
   and a 1.5L bottle." / Family Meal 1 £29.69 "Any 15" pizza, four pieces of garlic bread,
   onion rings, potato wedges and a bottle of drink." / Family Meal 3 £37.39 "Any three
   10" pizzas, four pieces of garlic bread, six BBQ wings and a bottle of drink."
   The price is Archivo 800 32px in accent. Each row ends with a secondary
   "Add the deal" button.
7. A solid accent-red poster band, full bleed: h2 at 64px "Order tonight. / Eat tonight."
   with a ground-coloured primary button "Start an order →". This is the one red field.

STATES
- Closed: tile 4 shows the pre-order state and the red band's copy becomes
  "Closed now. Book a time for tomorrow →".
- Loading: photo cells are neutral-200 blocks, headline text is live immediately.
- Missing photo: monogram tile as described in the system preamble.

MOBILE (390px)
Hero stacks — photo under the copy, not above it. Stat row becomes 2x2. Featured grid
becomes 2-up at 700px and single column at 440px. Deal rows become two-line blocks:
name and price on line one, description across the full width below, button full width.
The 64px poster headline drops to about 40px so it does not break mid-word.
```

### S3 — Menu browser (`/menu`)

```
SCREEN: Menu browser (/menu)

PURPOSE: The main ordering screen. 68 products in 7 categories, searchable, with
one-tap add for anything that has no required choice.

CONTENT
- Two-column layout, 200px rail + grid, 48px gap. There is no page kicker and no lead
  paragraph — the h1 does the work.
  Left rail, sticky (top offset 104px): the kicker "MENU", then the category list as
  ruled rows (2px rules), the name in Archivo 800 18px flush left and the count in 12px
  neutral-700 flush right — Pizzas 30, Starters 5, Sides 9, Chicken 7, Pasta 2,
  Desserts 5, Drinks 10. The active category is NOT filled: its label turns #ae1800 and
  everything else stays ink. Under the list, a 12px neutral-700 line
  "V vegetarian · VG vegan. Allergen information is available on request." and a
  full-width secondary block button "Allergen sheet →".
  Right column: a header row with the h1 flush left at 44px and the search input (max
  280px, placeholder "Search the menu") flush right, then a 3-column modular grid of
  product cells with 2px borders.
- The h1 is the selected category's name — "Pizzas", "Drinks" — and becomes
  "Search: chicken" while a query is typed. It is never the word "Menu" unless nothing
  is selected.
- Product cell: 4:3 flat-lay photo; a row with the name in Archivo 800 17px flush left
  and the price in Archivo 800 17px flush right, shown plain as "£8.39" with no "from";
  a one-line description; then a row of diet tags where they apply (V, VG, SPICY as
  neutral tags) followed by an 11px size note — "5 sizes from 7" Small" for a pizza, or
  just "Regular" for a single-size item. Then the buttons:
  an item with a required choice gets one primary "Choose options" (every pizza);
  an item with none gets primary "Add" AND secondary "Details" (Potato Wedges £4.68,
  Coca-Cola £1.65, Chocolate Fudge Cake £3.84).
- A sold-out cell: photo at 45% opacity, an OUTLINE "Sold out" tag where the buttons
  would be, and no button at all.

STATES
- Populated: show at least nine cells, mixing photographed items and two monogram tiles.
- Search active: the query "chicken" in the box, the h1 reading "Search: chicken", and
  results drawn from every category, not just Chicken. (There is no "Clear search" link
  today — if you draw one, it is a proposed addition.)
- Empty search, real copy: "Nothing matches "aubergine". Try a topping, or clear the
  search." There is no button beside it today.
- Loading: nine neutral-200 cells with a 12px text bar under each.
- Closed shop: an accent strip above the grid — "We're closed. Add what you want and
  book a delivery time at checkout."

MOBILE (390px)
Below 1000px the two-column split stacks and the rail stops being sticky; move it above
the grid as a horizontally scrolling row of category chips (no visible scrollbar), with
the search box full width above it. Grid goes 3-up at 1000px, 2-up at 700px and single
column at 440px. The "Add" button is full width in the cell.
```

### S4 — Category page (`/menu/[category]`)

```
SCREEN: Single category page, e.g. /menu/pizzas

PURPOSE: A search-engine landing page for one category that also works as a menu. It is
reached from search results and breadcrumbs, not from the main menu screen.

NOTE: this page is still on the older card styling in the build. What you are drawing is
the conversion, not a picture of today.

CONTENT
- Breadcrumb rule: Home → Menu → Pizzas (typed arrows, 12px, ink 55%).
- h1 "Pizzas", then the category description "Every pizza in five sizes, up to the 20
  inch. All our recipes are flexible — customise any of them."
- A 3-column modular grid of all 30 pizzas, same cell design as the menu browser:
  Original, The Favourite, Hawaiian, Pepperoni Lover, Country Chicken, Seafood, Farm
  Chicken, Vegetarian, Hot Vegetarian, Farm Pizza Classic, Meat Combo, BBQ Meat Combo,
  Hot & Spicy, BBQ Chicken, American Hot, Chicken Hot, Out of this World, Mexican Hot,
  Hotter Than Hot, BBQ Special, Chinese Special, Farm Pizza Special, Italian Meat Feast,
  Italian Meatball, Pepperoni Special, Tex BBQ, Meat Machine, Italian Chicken, Mega Ball,
  Half & Half. All "from £8.39", all "Choose options".
- Below the grid, a 2px rule and a short block of plain copy about the category, then
  links to the other six categories as a ruled list.

STATES
- Populated (30 cells, at least eight of them monogram tiles — most pizzas are
  photographed but not all).
- Empty category: "Nothing in this section at the moment." with a "Back to the menu"
  button.
- Loading: 12 skeleton cells.

MOBILE (390px)
Breadcrumb wraps rather than truncating. Grid 2-up then single column. Category link list
becomes full-width ruled rows with a trailing →.
```

### S5 — Product page (`/menu/[category]/[product]`)

```
SCREEN: Product page — use the Original pizza (/menu/pizzas/original)

PURPOSE: Size the pizza, pick the base, add extras, see the price move, add it to the
basket without leaving the page.

CONTENT
Two columns, 1fr / 1fr, 56px gap.
LEFT (sticky on desktop, top offset 104px): one large flat-lay photograph of the pizza,
full bleed in its frame, with the real 10px monospace caption beneath:
"product photograph · overhead · b/w".
RIGHT:
- Breadcrumb Home → Menu → Pizzas → Original.
- h1 "Original", description "Cheese & tomato", diet tags "V" and "POPULAR".
- Allergen line, real copy: "**Allergens:** gluten, milk. The full allergen sheet is
  available here and at the counter." — "here" is a link to /allergens. Give it its own
  2px-bordered block; today it is a plain paragraph.
- "SIZE" label, then five ruled radio rows, each with the size name flush left and the
  price right-aligned: 7" Small £8.39 / 10" Medium £13.64 / 13" Large £15.74 (selected) /
  15" X-Large £17.84 / 20" XX-Large £19.94.
- "BASE — choose one" label, three radio rows: Tomato base (selected, +£0.00),
  BBQ base +£0.00, Garlic base +£0.50.
- "EXTRA TOPPINGS — up to 8" label, then square toggle chips in a wrapping row with the
  surcharge inside each chip: Extra cheese +£1.50, Pepperoni +£1.50, Chicken +£1.50,
  Beef +£1.50, Ham +£1.50, Bacon +£1.50, Sausage +£1.50, Meatballs +£1.50,
  Mushrooms +£1.00, Onions +£1.00, Peppers +£1.00, Sweetcorn +£1.00, Pineapple +£1.00,
  Jalapeños +£1.00, Olives +£1.00, Fresh tomato +£1.00. Two are selected.
- "ANYTHING ELSE?" a note field capped at 200 characters — a single-line input today,
  placeholder "e.g. no onions, well done". Draw it as a one-line input at the system's
  36px height. A live "163 left" counter would be a proposed addition; label it as one
  if you draw it.
- A quantity stepper (− 1 +, range 1 to 20) beside a full-width primary button
  "Add to basket · £18.74" — the price updates live and is part of the label.

STATES
- Blocked: a required group unanswered — the Add button at 45% opacity with the plain
  line "Choose a base first" directly beneath it.
- Added: the "Added — View basket →" toast, page unchanged so a second one can be added.
- Sold out: size rows for unavailable sizes shown struck through and disabled; if the
  whole product is out, replace the whole picker with a 2px-bordered block reading
  "Sold out tonight. Try Pepperoni Lover or Farm Pizza Special." and two links.
- No allergen data: the block drops the "Allergens: …" clause and reads only the
  sheet-and-counter line. This affects exactly 10 of the 68 products and all ten are
  drinks — the ten cans, bottles and the milkshake — so draw this state on a drink,
  not on a pizza.
- Loading: photo as a neutral-200 block, radio rows as skeleton rules.

MOBILE (390px)
Single column, photo first, and it must NOT be sticky. Size rows stay full width with the
price right-aligned. Topping chips wrap two per row. The Add button becomes a pinned
bottom bar with the live price in it, sitting above the sticky basket bar.
```

### S6 — Basket (`/basket`)

```
SCREEN: Basket (/basket)

PURPOSE: Show what has been chosen, priced by the server, with the promo box, the
minimum-order rule and a nudge towards a drink.

CONTENT
Two columns, 7fr / 5fr, 56px gap.
LEFT:
- h1 "Your basket", subhead "3 items · Delivery to RM17".
- Ruled line rows (1fr / auto / 80px). Each row: product name in Archivo 800, the chosen
  size and options underneath in 13px ink-55% ("13" Large · BBQ base · Extra cheese,
  Jalapeños"), any kitchen note in accent-700 italic ("Note: well done"), then a quantity
  stepper, then the line total right-aligned in tabular figures. A ghost "Remove" under
  the stepper.
  Rows: Original 13" Large ×1 £18.74 · Meal for 2 (deal) ×1 £29.69 with its four
  contents listed indented beneath · Coca-Cola 330ml ×2 £3.30.
- 2px rule, then the kicker "GOES WELL WITH" and a 4-column modular grid (2px cell
  borders, up to six cells). Each cell carries only a name in 14px semibold, the price
  in semibold flush left, and a secondary "Add" button flush right — there is NO photo
  and no description; the endpoint sends neither, so do not draw them.
  The suggestions can only ever come from Sides, Desserts and Drinks, taken three at a
  time in menu order and capped at six — so with nothing in the basket the six are
  Potato Skins with Cheese £5.49, Potato Skins with Cheese & Bacon £6.59, Potato Wedges
  £4.68, Chocolate Fudge Cake £3.84, Strawberry Cheesecake £3.84, Tennessee Toffee Pie
  £3.84. Garlic Bread is a Starter and can never appear here — do not use it.
RIGHT (sticky panel, 2px ink border, 20px padding):
- "SUMMARY" label. Ruled lines: Subtotal £51.73 / Delivery £1.99 / Discount −£5.17
  (accent) / a 2px rule / Total £48.55 in Archivo 800 at 25px.
- Promo box: an input with the value "COMEBACK15" and a secondary "Apply" button, with
  the confirmed line beneath: "COMEBACK15 applied — 15% off".
- Primary block button "Checkout →" and, beneath it, "Delivery to RM17 · £9.99 minimum".

STATES
- Empty: whole left column replaced by "Nothing in your basket yet." and a primary
  "See the menu" button; the summary panel is not drawn at all.
- Line dropped by the server: a 2px-bordered accent-tinted block at the top of the list —
  "Pepperoni Lover is sold out tonight, so we've taken it out of your basket."
- Under the minimum: total line unchanged, Checkout at 45% opacity, and the line
  "Add £3.12 more to reach the £9.99 minimum for delivery."
- Promo rejected: input keeps the typed code, and beneath it in accent-700 —
  "Spend £15.00 to use this code." (also show variants: "This code has expired." and
  "That code was issued to someone else.")
- Repricing: the summary numbers become neutral-200 blocks for a beat; line rows do not
  move.

MOBILE (390px)
Single column below 1000px, summary panel below the items and not sticky. Each line row
becomes two lines: name and options across the full width, then stepper left and price
right. The "Goes well with" grid follows the standard collapse — 3-up at 1000px, 2-up at
700px, single column at 440px. Checkout also appears in the sticky bottom bar.
```

### S7 — Checkout, details (`/checkout`)

```
SCREEN: Checkout — details step (/checkout)

PURPOSE: One page, four ruled sections, guest ordering allowed, no account required.

CONTENT
Kicker "CHECKOUT", then the real h1: "Four questions, then the oven."

Two columns, 7fr / 5fr. Left is the form, right is a sticky order summary identical in
style to the basket summary (Subtotal £51.73 / Delivery £1.99 / Discount −£5.17 /
Total £48.55, promo box, and a small "3 items — edit basket →" link).

LEFT, four sections each opened by a 2px rule and an uppercase numbered label:
1. "01 HOW" — a two-option segmented control Delivery | Collection.
   Delivery selected: address line 1 "12 Bradleigh Avenue", line 2 (optional), postcode
   "RM17 6QD", and beneath them the quoted line "Delivery £1.99 · £9.99 minimum ·
   about 35 min". Draw a second variant of this line for an RM16 address:
   "Delivery £3.49 · £14.99 minimum · about 50 min (Chafford & West Thurrock)".
   Collection selected: today this is a plain select with a single option,
   "Grays · 7 Derby Road, Grays RM17 6QD". Redraw it as ruled radio rows — Grays,
   7 Derby Road RM17 6QD, open until 02:00, ready in 15 min (selected) — and add a
   second, greyed row for Basildon labelled "Not taking online orders yet" so the layout
   survives a second shop. Basildon is NOT in the config today; the greyed row is there
   to prove the pattern, not to claim a second branch is live.
2. "02 WHEN" — today this is a single select whose first option reads
   "As soon as possible (~35 min)" followed by every 15-minute slot. Redraw it as two
   radio rows — "As soon as possible — about 35 min" and "Choose a time" — the second
   expanding into a day switch (Today | Tomorrow) and a wrapping grid of 15-minute slot
   chips 19:15, 19:30, 19:45 … one selected. Slots only ever cover today and tomorrow.
3. "03 WHO" — name, mobile, email (optional), an order-notes field, and a square tick
   box, unticked by default, with the real wording:
   "Text me occasional deals (opt out any time)"
4. "04 PAY" — radio rows: "Card, Apple Pay or Google Pay" and "Cash on collection".
   Then a primary block button "Pay £48.55 →".

STATES
- Shop closed or paused: the ASAP row is removed entirely and section 02 opens with the
  line "We're closed now — pick a time and we'll have it ready." with the first available
  slot preselected.
- Signed in: name, mobile, email and the last address are prefilled, with a small ghost
  "Not Ada? Use different details" link.
- Validation error: the offending field's border turns accent, with the message directly
  under it — "We don't deliver to SS15 from this shop." / "Enter a UK mobile number."
- Cash not allowed: the "Cash on collection" row disabled at 45% with "Cash is collection
  only" beside it.
- Submitting: the pay button reads "Placing your order…" and is disabled; nothing else
  moves.

MOBILE (390px)
Single column; summary collapses to a two-line strip at the top ("3 items · £48.55" with
a "Show summary" disclosure) and the full summary repeats above the pay button. All
side-by-side field pairs become one per row. Slot chips wrap three per row.
```

### S8 — Checkout, pay step

```
SCREEN: Checkout — payment step (second step of /checkout)

PURPOSE: Take the card payment through Stripe's own element without the design falling
apart around a third-party iframe.

CONTENT
- A narrow single column, 560px max, centred inside the 1200px page.
- Back link "← Back to details", then h1 "Pay £48.55", then a ruled recap:
  Delivery to 12 Bradleigh Avenue, RM17 6QD · As soon as possible · about 35 min.
- Apple Pay and Google Pay as two full-width secondary buttons with a 1px rule and the
  word "or" between them and the card fields.
- The card block: a 2px-bordered panel, 20px padding, containing the labelled fields
  Card number / Expiry / CVC / Postcode. Design them to the system's input style knowing
  they are rendered by Stripe — so the surrounding frame, labels and spacing are ours and
  the field interiors match as closely as a third party allows.
- Primary block button "Pay £48.55" and, under it, 12px ink-55%: "Your card details go
  straight to Stripe. We never see them."

STATES
- Declined: a 2px-bordered accent-tinted block above the card panel — "Your bank declined
  that card. Try another card, or choose cash on collection." with a ghost link back.
- Processing: button reads "Taking payment…", disabled, fields disabled at 45%.
- Stripe unavailable (no keys configured): the whole card block is replaced by a
  2px-bordered block: "Card payment is off at the moment. Choose cash on collection, or
  ring the shop on 01375 383877." with a secondary "Pay cash on collection" button.
- Cash chosen: this screen is skipped — do not design a cash version of it.

MOBILE (390px)
Full-width column at 16px gutters, Apple Pay button first and prominent, pay button
pinned to the bottom of the viewport.
```

### S9 — Order tracker (`/order/[id]`)

```
SCREEN: Live order tracker (/order/<id>)

PURPOSE: Where the customer lands after paying, and what the confirmation text links to.
It updates itself as the kitchen moves the order along.

CONTENT
- Kicker, real format: "ORDER #1043 · DELIVERY · GRAYS".
- h1 at 56px, and it is the ORDER STATUS in the wording the database uses, not the step
  name: "Order received" / "Accepted" / "Being prepared" / "Ready" / "Out for delivery" /
  "Completed". So the headline for a pizza in the oven reads "Being prepared", while the
  step beneath it reads "In the oven" — a real inconsistency. Draw the headline as built
  and flag it; making the two agree is the obvious fix and worth proposing.
- Under it, a 15px line, not a 32px one: "Estimated delivery 19:45" with the time in
  bold ("Ready for collection 19:45" on a collection order). Promoting this line to
  Archivo 800 at 32px is a proposed improvement — it is the thing the customer actually
  came for.
- A 4px progress bar in neutral-300 with an accent fill, then a five-step rule across the
  full width: Received · Accepted · In the oven · On its way · Done (step four reads
  "Ready" on a collection order). Completed steps are ink with a filled square marker;
  the current step is accent and carries a small pulsing emphasis; future steps are
  neutral-400. Under each step, the time it happened (19:02, 19:04, 19:11) or nothing.
- 2px rule, then a two-column block: left, "DELIVERING TO" with the address
  12 Bradleigh Avenue, Grays RM17 6QD and the phone the shop will ring; right,
  "FROM" Farm Pizza Grays, 7 Derby Road, with a tap-to-call 01375 383877 button.
- 2px rule, then the itemised order: each line with quantity, name, size, options,
  kitchen note, and price; deal lines list their contents indented. Then totals —
  Subtotal £51.73, Delivery £1.99, Discount −£5.17, Total £48.55, and a payment tag
  ("PAID BY CARD" neutral tag, or "CASH ON COLLECTION" outline tag).
- A closing line: "Something wrong with this order? Ring us on 01375 383877." There is
  deliberately no cancel or edit control — do not design one.

STATES
- Received, awaiting acceptance: headline "Order received", second line "We'll confirm in
  a couple of minutes."
- Collection variant: step 4 reads "Ready" and the address block becomes
  "COLLECT FROM" with the shop's opening state.
- Rejected: the progress rule disappears and the h1 turns accent-700, reading
  "Rejected — too busy tonight" (the reason is appended to the headline). Wrap that in a
  2px-bordered accent block and add the refund line — "Your card has been refunded in
  full; it takes 3-5 days to show." — which is true: rejecting a paid card order refunds
  it automatically. Items and totals stay below.
- Awaiting payment: h1 "Confirming payment…" with the line "Waiting for your payment to
  confirm. This usually takes a few seconds."
- Completed: headline "Delivered at 19:47", steps all ink, and a secondary
  "Order this again" button appears above the items.
- Connection lost: a small 12px ink-55% line under the headline —
  "Live updates paused. Refresh to check." No modal.

MOBILE (390px)
The five-step rule becomes a 2-up grid (three rows) with the step name and time stacked.
The from/to block stacks. The tap-to-call button is full width. The items list becomes
ruled two-line rows.
```

### S10 — Deals list (`/deals`)

```
SCREEN: Deals and codes (/deals)

PURPOSE: The eight meal deals, and the public list of discount codes.

CONTENT
- Kicker "DEALS & OFFERS", then the real h1 "8 deals. No small print you need a lawyer
  for.", then the lead "Every deal works on delivery and collection unless it says
  otherwise. Prices include VAT. One code per order."
- The deals are a 4-COLUMN MODULAR GRID of cells (2px borders, no gaps, min height about
  300px) — not ruled rows. That row treatment belongs to the home page. Each cell, in
  this order:
  an 11px uppercase accent-700 kicker reading "Most popular" on a featured deal and
  "Every day" on the rest; the price in Archivo 800 at 56px in accent; the deal name in
  Archivo 800 at 22px; the description; a 12px neutral-700 line listing the slot make-up
  ("2 × 10" pizza · 1 × Onion rings · 1 × Hot wings · 1 × Garlic bread · 1 × Bottle of
  drink"); then a primary "Build the deal" button, flush to the start, no arrow.
  All eight, in this order, with the real prices and descriptions:
  Meal for 1 £15.39 — Any 10" pizza, four pieces of garlic bread and a can of soft drink.
  Meal for 2 £29.69 (Most popular) — Two 10" pizzas, onion rings, six hot wings, garlic
  bread and a 1.5L bottle.
  Family Meal 1 £29.69 — Any 15" pizza, four pieces of garlic bread, onion rings, potato
  wedges and a bottle of drink.
  Family Meal 3 £37.39 — Any three 10" pizzas, four pieces of garlic bread, six BBQ wings
  and a bottle of drink.
  Mega Deal £28.59 (Most popular) — Any 20" pizza, BBQ wings, potato wedges and a 1.5L
  bottle.
  Any 3 x 20" Pizzas £51.69 — Three of our biggest pizzas, any toppings.
  Any 2 x 10" Pizzas £24.19 — Two medium pizzas, any toppings.
  Any 3 x 13" Pizzas £40.69 — Three large pizzas, any toppings.
- Then the kicker "CODES" and a ruled list in a 180px / 1fr / auto / auto grid: the code
  in monospace 15px semibold, the rule in plain English, the conditions in 12px
  neutral-700, and a secondary "Apply to basket" button.
  WELCOME10 — 10% off, £15 minimum, first order only.
  FREEDEL — Free delivery, £20 minimum, delivery only.
  COMEBACK15 — 15% off, £12 minimum.
  TUESDAY20 — 20% off, £15 minimum. (Note: despite the name there is no day-of-week rule
  on promo codes at all, so this one works every day. Do not draw a "Tuesdays only" tag.)

STATES
- Empty, real copy: "No deals running right now. Check back soon."
- Code applied: the row's button becomes a neutral "Applied" tag and a toast confirms.
- Code refused: a plain accent-700 line under that row — "Spend £15.00 to use this code."
- Loading: eight skeleton cells.
- The codes list shows every code marked active, including expired ones and the personal
  THANKS-XXXX referral rewards. That is a known problem; do not design it away, but do
  draw a small neutral "PERSONAL" tag on a THANKS row so it can be told apart.

MOBILE (390px)
The deal grid follows the standard collapse — 3-up at 1000px, 2-up at 700px, single
column at 440px. Code rows become code + button on line one, rule text beneath.
```

### S11 — Deal builder (`/deals/[deal]`)

```
SCREEN: Deal builder — use Meal for 2 (/deals/meal-for-2)

PURPOSE: Walk the customer through each slot of a fixed-price bundle, one at a time,
never letting them pick something the deal does not allow.

NOTE: the page shell around the builder is still on the older card styling. You are
drawing the conversion.

CONTENT
Two columns, 7fr / 5fr.
LEFT — the active step:
- Kicker "MEAL FOR 2 · £29.69", h1 "Choose your first 10" pizza", and the counter
  "Step 1 of 6". Meal for 2 has five slots but the pizza slot has a quantity of two, so
  the customer makes six picks — count the picks, not the slots.
- A 3-column modular grid of the allowed products only: all 30 pizzas, locked to
  10" Medium — photo, name, description, and the word "Included". Every product a slot
  allows is included at the deal price; there is no per-product surcharge anywhere in the
  data, so do not draw "+£1.50" on a product tile. Selecting a pizza expands an inline
  options block underneath it — Base radios and Extra topping chips, exactly as on the
  product page — and only those paid extras are charged, shown as
  "+£1.50 on top of the deal".
RIGHT — the checklist panel, sticky, 2px ink border:
- "YOUR DEAL" and six ruled pick rows, each with the pick name, the chosen item or the
  word "Not chosen yet" in ink-55%, and a ghost "Change" on completed rows:
  10" pizza 1 of 2 — Farm Pizza Special · BBQ base
  10" pizza 2 of 2 — Not chosen yet
  Onion rings — Onion Rings (the slot allows one product, so there is nothing to choose)
  Hot wings — Hot Chicken Wings
  Garlic bread — Garlic Bread
  Bottle of drink — Not chosen yet (four allowed: Coca-Cola, Pepsi, 7UP, Tango Orange)
- 2px rule, then Deal price £29.69, Extras +£1.50, Total £31.19 in Archivo 800.
- Pinned bottom bar of the panel: primary block button "Add the deal · £31.19", disabled
  at 45% until every slot is filled, with the line "2 choices left" beneath it.

STATES
- Complete: button live, and the line becomes "Everything chosen".
- A choice gone: an accent-tinted block — "Hot wings are sold out tonight, so this deal
  isn't available. Try Family Meal 3." with a link.
- Restricted deal: a neutral tag beside the title, "COLLECTION ONLY" or "TUESDAYS ONLY",
  and a line explaining it before the customer starts choosing. No Farm Pizza deal is
  restricted today — the day and fulfilment rules exist in the pricing code but no deal
  uses them — so draw this as a pattern for later, not as a live deal.
- Loading: skeleton grid of nine cells; the checklist renders immediately with all rows
  reading "Not chosen yet".

MOBILE (390px)
The checklist moves to the top as a collapsed summary strip ("2 of 5 chosen · £31.19"
with a disclosure), the product grid is 2-up then single column, and the "Add the deal"
button is a pinned bottom bar.
```

### S12 — Account, signed out (`/account`)

```
SCREEN: Account — sign in by text code (/account)

PURPOSE: No password. A six-digit code by text, two steps, on one narrow column.

CONTENT
- A single column capped at 640px, left-aligned inside the page (not centred in a box).
- Kicker "ACCOUNT", the real h1 "Log in", and the real lead
  "We'll text you a one-time code. No password needed."
- Step one: a labelled input "Mobile number", placeholder "07...", and a primary block
  button "Text me a code". A 12px ink-55% line under it —
  "We only use this to send your code and your order updates." — is a proposed addition.
- Step two (draw as a second artboard state): the form swaps to a single labelled input
  "6-digit code", capped at six digits, then a primary block button "Log in" and a plain
  underlined "Use a different number" beneath. Six separate square code boxes (2px
  divider borders, 48px, monospace 24px, no radius) are a PROPOSED improvement on the one
  input — draw them, but say which is which. There is no resend timer today; a
  "Send it again (in 42s)" control would be new.

STATES
- Wrong code: the field takes an accent border. Today the message is the server's, e.g.
  "Wrong code"; the limit is five wrong attempts. "That code isn't right. 3 tries left."
  is a proposed improvement on it.
- Too many requests: three codes per ten minutes is the real limit — "You've asked for
  three codes in ten minutes. Try again at 19:52."
- Expired: codes last ten minutes — "That code has expired. Ask for a new one."
- SMS not configured (outside production only): the code is shown on screen. The real
  wording is a plain line "Dev code: 402913"; wrap it in a neutral-tinted 2px-bordered
  block captioned "Development only — texts are switched off." On a live site with
  Twilio unconfigured nothing is shown and nobody can log in at all.

MOBILE (390px)
Full width at 16px gutters. If you draw the six boxes they shrink to 44px and stay on one
row. The number field uses a numeric keypad. Nothing is centred — note that today's
single code input IS centred, which the system forbids.
```

### S13 — Account, signed in (`/account`)

```
SCREEN: Account — signed in (/account)

PURPOSE: Past orders, reorder in one tap, saved addresses, and the referral code.

CONTENT
- Head: kicker "ACCOUNT", h1 "Hi Ada" (first name only — the page never prints the full
  name), the line "07700 900101 · ada@example.com", and a sign-out button on the right.
  There is no "member since" date anywhere in the build — do not invent one.
- Two columns, 7fr / 5fr.
LEFT — the kicker "PAST ORDERS" and a ruled list. The page loads the last 20 orders and
  draws them all; put five rows on the artboard. Each row:
  "#1043 · 4 Sep 2026" in semibold (a date, no time), a one-line summary
  ("1× Original, 1× Meal for 2, 2× Coca-Cola"), a neutral status tag using the real
  wording — Order received / Accepted / Being prepared / Ready / Out for delivery /
  Completed / Rejected — the total right-aligned in semibold, and two buttons:
  secondary "Details" and "Reorder". Varying the tag style by status, and a line reading
  "Showing your last 20 orders.", are both proposed additions — label them as such.
RIGHT, stacked panels each with a 2px ink border:
1. "REFER A FRIEND" — the real copy: "They get £5.00 off their first order. Once they
   order, you get £5.00 off yours. £15.00 minimum spend on both." Then the code ADA-7K2Q
   in its own 2px-bordered box, monospace 18px at 0.04em — the code is the customer's
   first name plus four characters from an alphabet with no O/0 and no I/1, so it can be
   read out over the phone. Then a primary share button and a secondary copy button.
   Under it: "2 friends joined · £10 earned".
2. "CRUST CLUB" — the panel that exists today is a 2px ink border with the label
   "CRUST CLUB", the balance in accent Archivo 800 at 56px, and the line
   "points earned so far. Points accrue on paid orders." That line is not true: loyalty
   is switched off, nothing accrues, and this panel is still shown to every customer.
   Draw the balance at 0 and replace the line with "Points are switched off at the
   moment." — and say in the caption that this is the honest correction, not what ships
   today. The ten-box stamp card belongs to /rewards; putting one here is a proposed
   change.
3. "SAVED ADDRESSES" — a ruled list, display only: 12 Bradleigh Avenue, Grays RM17 6QD
   and 4 Foxglove Close, Chafford Hundred RM16 6QP. With no addresses saved, the real
   copy is "Addresses are saved automatically when you order." There is no add, edit or
   delete control anywhere on this page — do not draw one.

STATES
- No orders yet: the left column becomes "You haven't ordered yet." with a primary
  "See the menu" button; the referral panel still shows.
- Reorder with changes: an accent-tinted block above the basket link — "We rebuilt your
  basket. Pepperoni Lover is sold out, so it's not in there, and the 13" Large is now
  £15.74."
- Loading: five skeleton order rows.

MOBILE (390px)
Single column below 1000px: orders first, then referral, then Crust Club, then addresses.
Order rows become three lines — number and date, summary, then status tag left and total
right, with the two buttons side by side full width beneath.
```

### S14 — Crust Club rewards (`/rewards`)

```
SCREEN: Crust Club (/rewards) — currently switched off, design it for the day it is on

PURPOSE: The points screen. It exists in code but the shop's config has loyalty disabled,
so today the page returns Not Found. Design both the live screen and the off state.

CONTENT (live state)
- Kicker "CRUST CLUB", h1 "184 points" set very large in Archivo 800, and the line
  "66 points from a free 10" pizza."
- A progress rule: a 2px-bordered full-width bar filled to 73% in accent, with "0" at
  the left end and the real label "250 · free medium pizza" at the right, both 11px.
- A ten-box stamp card: ten equal squares in a single ruled row, 2px borders, seven
  filled with accent and a ground-coloured tick, three empty.
- "HOW IT WORKS" — three ruled lines: 1 point per £1 spent · 250 points = a free 10"
  pizza · Points land when your order is completed.
- "YOUR POINTS" — a ruled history list: Order #1043 +48, Order #1021 +31,
  Order #0998 +52, each with the date right-aligned.
- No "Redeem" button — spending points is not built. Do not design one.

STATES
- Off (what the customer gets today): a plain page with h1 "Not found" and the line
  "This page isn't available." Keep it in the system's type and rules, not a stock 404.
- Zero points: headline "0 points", progress bar empty, the history list replaced by the
  real copy "No points yet. They land the moment an order is paid." (Which is itself
  wrong — points are written when an order is marked completed, not when it is paid. Fix
  the wording to "…the moment an order is completed." and flag it as a correction.)
- Loading: headline number as a neutral-200 block.

MOBILE (390px)
Stamp card wraps to two rows of five. Progress bar full width. History rows become two
lines.
```

### S15 — Shops (`/shops`)

```
SCREEN: Shops (/shops)

PURPOSE: Where the shops are, whether they are open right now, and one tap to ring them.

CONTENT
- Kicker "SHOPS", then the real h1, which counts the shops in the config:
  "One shop in Essex." (it becomes "2 shops in Essex." when Basildon is added). The word
  "Essex" is hard-coded, so do not swap it for anything else.
- The page is a two-column split, NOT stacked blocks: the shop list runs down the left,
  and the map placeholder plus the details-and-hours panel sit in the right column.
  LEFT — one ruled block per shop, 2px rules above and below:
  GRAYS — name in Archivo 800 22px flush left with "£1.99 delivery" in 13px flush right;
  then the address, 7 Derby Road, Grays RM17 6QD; then a row of tags and text —
  an accent tag reading "Open · closes 02:00", a neutral tag "Collection ~15 min", and
  "Delivery ~35 min" as plain neutral-700 text; then two buttons, primary
  "Order from here" and a secondary tap-to-call "01375 383877".
  BASILDON — a second block in a not-yet-live state: name with a neutral "COMING SOON"
  tag, no phone button, and the line "Not taking online orders yet." Basildon is NOT in
  the config today and this block does not render — it is drawn so the layout survives a
  second shop being added. Caption it that way on the artboard.
  RIGHT — the map placeholder above the details panel. The map is deliberately fake:
  a 320px-tall box with a 2px ink border, a drawn 40px grid in neutral-300 on surface,
  a 14px square accent marker per shop with the shop name beside it, and a 10px monospace
  caption in the TOP-left reading "map · grays · placeholder". Do not draw a realistic
  map, roads or a satellite image — it would misrepresent what is built.
  Under the map, a per-shop details panel: the kicker "GRAYS SHOP" over a ruled
  80px / 1fr definition list — Phone 01375 383877 · Address 7 Derby Road, Grays RM17 6QD ·
  Delivery £1.99 · £9.99 minimum — followed by the seven opening-hours rows in the same
  grid: Mon 11:00-02:00, Tue 11:00-02:00, Wed 11:00-02:00, Thu 11:00-02:00,
  Fri 11:00-03:00, Sat 11:00-03:00, Sun 11:00-02:00. Under that, a 12px neutral-700 line
  "Times shown are for Friday 5 September 2026."
- PROPOSED ADDITION, label it as one: an "AREAS WE DELIVER TO" strip of neutral tags —
  RM15, RM16, RM17, RM18, RM19, RM20. The config also carries the district names (Grays,
  Little Thurrock, Chadwell St Mary, Chafford Hundred, West Thurrock, South Stifford,
  North Stifford, Tilbury, Purfleet-on-Thames, Aveley, South Ockendon) but the config
  schema strips that list on load, so those names reach no screen today and cannot be
  drawn as if they do.

STATES
- Closed: the tag becomes a neutral "Closed" — today it carries no next-opening time. A
  "CLOSED — OPENS 11:00" tag and a "Pre-order from Grays →" button are both proposed
  improvements; mark them as such.
- Paused: an accent tag "PAUSED — BACK IN 30 MIN" and the line "Kitchen's at capacity."
  This shop page does not show a paused state today — proposed.
- Loading: tags as neutral-200 blocks; addresses render immediately.

MOBILE (390px)
Everything single column below 1000px: shop list, then the map, then the details and
hours, then the order button full width. The map placeholder becomes a 16:9 band.
Postcode tags wrap.
```

### S16 — Town landing page (`/pizza-delivery-grays`)

```
SCREEN: Town landing page — /pizza-delivery-grays

PURPOSE: The page that has to win "pizza delivery Grays" in Google, and the only place on
the site with a postcode checker.

NOTE: this is the page furthest from the new design — it is still entirely on the older
card styling. You are drawing the conversion. Grays is also the ONLY town page that
exists: the config lists one locality, so /pizza-delivery-basildon does not resolve.

CONTENT
- An open/closed pill, then the h1 "Pizza delivery in Grays" (built as
  "<cuisine> delivery in <locality>"), then the real subhead: "Order online from Farm
  Pizza Grays. £1.99 delivery, £9.99 minimum, about 35 minutes."
  A primary "See the menu" and a ghost "01375 383877 →" are proposed additions — the
  header carries no buttons today.
- POSTCODE CHECKER, in its own 2px-bordered block, given real prominence: label "Check we
  deliver to you", an input (placeholder "RM17 6QD"), a primary "Check" button, and the
  answer area beneath.
  Answer, covered: "Yes — Grays delivers to RM17. £1.99 delivery, £9.99 minimum, about
  35 minutes." with a primary "Start an order".
  Answer, covered at a higher band: "Yes — Chafford & West Thurrock. £3.49 delivery,
  £14.99 minimum, about 50 minutes."
  Answer, not covered: "Sorry, we don't deliver to SS15 yet. Collection from 7 Derby Road
  is always on." with a secondary "Collection instead".
- 2px rule, then two columns: left, three or four short paragraphs of local copy about
  delivering in Grays (written, not lorem); right, a ruled list of the postcodes covered
  with the district names beside them.
- "POPULAR IN GRAYS" — a grid of six products, plus a primary "See the full menu" under
  it. The six are chosen automatically: the four featured pizzas first, then the next two
  by order count. So the first four are always Original £8.39, Pepperoni Lover £8.39,
  Farm Pizza Special £8.39 and Meat Machine £8.39; the last two move with sales. In a
  freshly seeded database they are The Favourite £8.39 and Hawaiian £8.39 — use those,
  and do not put a side or a dessert here unless you note that it depends on sales.
- Opening hours table for Grays with the address beneath, then the FAQ as ruled
  question/answer rows. Use the four real questions from the town's copy file, verbatim:
  "How long does delivery take in Grays?" · "Is there a minimum order?" ·
  "Do you deliver to Lakeside, Tilbury and South Ockendon?" · "How late are you open?"
- Footer strip: the page ends with "Also delivering to:" followed by links to the other
  towns. Farm Pizza has only one town, so this line renders EMPTY today. Draw it with no
  links and treat it as the two-town state only if you caption it as future.

STATES
- Empty checker (default), checking (button reads "Checking…"), covered, higher band,
  not covered, and invalid ("That doesn't look like a UK postcode.").
- Shop closed: subhead becomes "Closed now · opens 11:00" and the primary button becomes
  "Book a time".

MOBILE (390px)
Checker sits directly under the h1 and is full width with the button below the input, not
beside it. Copy and postcode list stack. Popular grid 2-up then single. FAQ rows stack
with the question in Archivo 800 above the answer.
```

### S17 — Allergen sheet (`/allergens`)

```
SCREEN: Allergens (/allergens)

PURPOSE: The legally expected allergen information for all 68 products, in one table
someone can actually read on a phone.

CONTENT
- The real h1 is "Allergen information" — keep it; the nav and footer call the page
  "Allergens". Then a warning in its own 2px-bordered block, ink on surface. (The page is
  still on the older card styling — you are drawing the conversion, and the warning
  block, the category jump row and the closing "Last updated" line below are all proposed
  additions, not things on the page today.)
  "Our kitchen handles all 14 major allergens. We cannot guarantee any item is free from
  traces. If you have a serious allergy, please ring us on 01375 383877 before ordering."
- A category jump row: Pizzas · Starters · Sides · Chicken · Pasta · Desserts · Drinks as
  ruled links.
- One table per category, 1px rules between rows, 2px above each header:
  columns Item / Diet / Allergens. Item name links to the product. Diet shows V, VG or
  nothing as small tags. Allergens are a plain comma list — "gluten, milk" for Original,
  "gluten, milk, egg" for Meat Lasagne, and so on.
- Ten of the 68 products have no allergen data recorded, and all ten are drinks — the
  five cans, the four bottles and the milkshake. Those rows must NOT show a dash: show
  "Not recorded — ask the shop" in accent-700, because a dash reads as "no allergens".
  This is a proposed correction; the build shows a dash today.
- Closing line: "Last updated 4 September 2026."

STATES
- Populated: show at least 12 rows across two categories, and make one of those two
  Drinks so the "Not recorded" rows are truthful — no pizza, starter, side, chicken,
  pasta or dessert item is missing allergen data.
- Loading: skeleton rules.
- There is no filter by allergen and no search — do not design one; it does not exist.

MOBILE (390px)
The table becomes stacked ruled blocks: product name in Archivo 800, then "Diet: V" and
"Allergens: gluten, milk" as labelled lines beneath. No horizontal scrolling.
```

### S18 — Contact (`/contact`)

```
SCREEN: Contact (/contact)

PURPOSE: Ring the shop, find it, and see whether it is open right now. There is no
contact form and no email address on file — the config's email field is empty — so do
not invent either.

NOTE: still on the older card styling. What exists today is thin: the h1, a "Call us"
line with the number, and one block per shop with its address, phone and a seven-day
hours table. Everything below marked PROPOSED is new work, not a redraw.

CONTENT
- The real h1 is "Contact & opening hours". Keep it — it is also the footer link label.
- A large tap-to-call block (PROPOSED): 01375 383877 set in Archivo 800 at 42px as the
  primary action, with "OPEN UNTIL 02:00" as an accent tag beside it. Today this is a
  plain sentence, "Call us: 01375 383877".
- Two columns: left, the address block — Farm Pizza, 7 Derby Road, Grays RM17 6QD, with a
  secondary "Directions →" link (PROPOSED — there is no directions link today); right,
  the full seven-day opening hours table with today highlighted in surface.
- "WE DELIVER TO" (PROPOSED) — the districts as neutral tags, RM15 to RM20. The district
  names are not available to this page; use the codes only.
- A ruled list of common reasons to ring with the honest answer beside each (PROPOSED —
  none of this is on the page today, and every answer below is true of the build):
  "Something wrong with an order" → ring us, we'd rather fix it.
  "Change or cancel an order" → ring us, it can't be done online.
  "Allergy question" → ring before you order.
  "Marketing texts" → reply STOP to any text.
- Second branch: a greyed block for Basildon with "Coming soon". Basildon is not in the
  config, so nothing renders for it today — the block is there to prove the layout.

STATES
- Closed: the tag reads "CLOSED — OPENS 11:00" and a line is added under the phone
  number: "The phone is only answered while we're open."
- Loading: the open/closed tag as a neutral-200 block.

MOBILE (390px)
Phone number becomes a full-width primary button with the number in it. Address and hours
stack. Reason rows become two-line blocks.
```

### S19 — Privacy and Terms (`/privacy`, `/terms`)

```
SCREEN: Legal pages — Privacy (/privacy) and Terms (/terms). Design one template, show
both with their real headings.

PURPOSE: Long-form reading. The only screens on the site that are mostly text, and they
must still look like they belong.

CONTENT
- A two-column layout, 200px rail + 1fr, 48px gap.
  Rail (sticky): a ruled contents list of the section headings, the current one accent.
  Body: max measure about 68 characters, 15px/1.55, h2 at 32px above each section with a
  2px rule above it, h3 at 20px inside.
- Privacy sections: Who we are · What we collect · Why we collect it · Who we share it
  with (Stripe for payments, Twilio for texts) · How long we keep it (six years for order
  records) · Cookies · Your rights · How to contact us.
- Terms sections: Ordering · Delivery and collection · Prices and payment · Cancellations
  and refunds · Allergens · Promotions and codes · Complaints · Governing law.
- Every page ends with the same block: "Farm Pizza, 7 Derby Road, Grays RM17 6QD ·
  01375 383877" and "Last updated 4 September 2026."
- Real detail to include on Privacy: marketing opt-out today is "reply STOP to any text" —
  do not write "manage your preferences in your account", because that control does not
  exist.

STATES
- Populated only. No loading state (these are static). Both pages are still on the older
  card styling, and neither has the contents rail described above — that is the
  conversion you are drawing.

MOBILE (390px)
The contents rail becomes a collapsed "Jump to a section" disclosure above the body.
Body full width at 16px gutters. Headings drop one step in size.
```

### S20 — System states: closed, paused, sold out, 404, error

```
SCREEN: Cross-cutting system states (one artboard, six blocks)

PURPOSE: The site currently has no consistent treatment for "we're shut" and it shows.
Design the six states once so every page can use the same components.

CONTENT — draw each as a labelled block at 1200px wide:
1. CLOSED BANNER — full-width strip under the header, accent fill, ground text, flush
   left: "We're closed now. Opens 11:00 — you can still order for later." with a ghost
   "Book a time →" on the right.
2. PAUSED BANNER — same shape, but surface fill with a 2px accent top rule:
   "Kitchen's at capacity — back in about 30 minutes. Pre-orders are still open."
3. SOLD-OUT TILE — a menu grid cell in its sold-out state: photo at 45% opacity,
   neutral "Sold out" tag, no button, name and price still legible.
4. LINE REMOVED — the basket's message block: 2px border, accent-100 fill,
   "Pepperoni Lover is sold out tonight, so we've taken it out of your basket."
5. 404 — h1 "We couldn't find that page.", one line "It may have been taken off the menu.",
   and three ruled links: See the menu → · Tonight's deals → · Ring the shop 01375 383877.
   Today's page is centred, on the older styling, and reads "Page not found" over "That
   page isn't on the menu." with one "See the menu" button. Replace it, flush left.
6. SERVER ERROR — h1 "Something's broken at our end.", the line "Your order wasn't taken.
   Try again, or ring us on 01375 383877 and we'll take it over the phone.", a primary
   "Try again" button, and a 10px monospace reference "ref: 8f2c1a" bottom-left (that
   reference is real and available — it is the framework's error digest). Today's page is
   centred, headed "Something went wrong", and prints the raw error message to the
   customer. Both of those are what this block is replacing.

MOBILE (390px)
Draw each block a second time at 390px: banners wrap to two lines with the action on its
own line; the 404 and error headings drop to 32px; links become full-width ruled rows.
```

---

## 3. Back-office screen prompts

The back office is used on a laptop and on a wall tablet in the kitchen. Design it
desktop-first at 1200px, then at 1024px landscape for the kitchen, and check it at 390px
because the owner will look at takings on his phone.

Two honest notes before you start. Six back-office screens are still part-way on the
older styling and are being converted — Menu & pricing, Promotions, Hours & pause,
Orders, Deals and the LaunchFlow console — so those prompts describe the target, not
today. And the Hours & pause screen currently uses green and amber status pills, which
the system forbids; the prompts below replace them with accent, outline and neutral tags.

### B1 — Staff sign-in (`/admin/login`, `/kitchen/login`)

```
SCREEN: Back-office sign-in (/admin/login), plus the kitchen tablet variant
(/kitchen/login)

PURPOSE: One field. It accepts three different things — the agency key, the shop's shared
admin password, or a member of staff's own 4-8 digit PIN — and the person typing does not
need to know which is which.

NOTE: both sign-in pages are on the older styling and both are narrow centred columns
today. You are drawing the conversion.

CONTENT
- A 420px column, left-aligned in a plain ground page, no card, no centring box.
- The Farm Pizza wordmark (PROPOSED — today the page just says "Admin"), then h1
  "Sign in", then the line "Enter your PIN, or the shop password."
- One input of type password, min-height 44px, monospace, letter-spaced. Its real label
  is "Password or staff PIN" with the placeholder "Password or PIN"; when the URL marks
  an agency sign-in both become "Agency key".
- Primary block button "Sign in".
- A 12px ink-55% line at the bottom: "Kitchen tablet? Use your own PIN — it opens the
  kitchen screen straight away." (PROPOSED — but true: a PIN whose role includes the
  kitchen mints the kitchen cookie as well.)
- Kitchen variant (/kitchen/login): today it is h1 "Kitchen", the line "Enter the kitchen
  PIN.", one centred numeric field letter-spaced at 0.5em taking up to 8 digits, and a
  block button "Open kitchen". Redraw it as a large numeric keypad — a 3x4 grid of square
  2px-bordered keys sized for a thumb (minimum 72px), a masked display above it, and a
  "Clear" key — and label that as the proposed replacement. Keep the real button wording,
  "Open kitchen". Note the PIN can be 4 to 8 digits, so do not draw exactly four boxes.

STATES
- Wrong: a plain line under the field in accent-700 — "That PIN wasn't recognised." No
  shake, no modal, and never say whether it was the PIN or the password that was wrong.
- Submitting: button reads "Checking…", disabled.
- Signed out by timeout: a neutral-tinted block above the field —
  "You were signed out after 12 hours. Sign in again." (Twelve hours is the real admin
  session length; the kitchen cookie lasts 30 days and a customer session 90 days.)
- Denied a screen (a kitchen PIN opening /admin/menu): a plain page —
  "Your PIN doesn't open Menu & pricing. Ask a manager." with a link to the first screen
  that role can open. Today the person is silently bounced to a screen they can open,
  with no message at all — this page does not exist and is worth designing.

MOBILE (390px)
Full width at 16px gutters, keypad keys at least 64px, submit pinned to the bottom.
```

### B2 — Back-office shell (sidebar and header)

```
SCREEN: Back-office shell — sidebar, header, and the frame every admin screen sits in

PURPOSE: Fifteen screens behind one rail, with the live state of the shop always visible.

CONTENT
- Left rail, 232px, sticky full-height, 2px right rule, ground background, 20px/16px
  padding. At the top: "FARM PIZZA" as a wordmark with "BACK OFFICE" beneath it in 11px
  uppercase accent-700. Then the nav: 1px rules between rows, an 8px neutral-400 square
  bullet before each label. Order exactly as follows, because this is the built order:
  Dashboard · Kitchen queue · Orders · Dispatch · Menu & pricing · Deals · Promotions ·
  Inventory · Customers · Campaigns · Marketing · Reviews · Staff · Hours & pause ·
  Delivery zones. (Note the order: Marketing comes before Reviews in the rail. The
  permission matrix on the Staff screen lists them the other way round — that is a real
  inconsistency in the code, so keep each screen's own order.)
  The active item is an accent-filled row with ground text.
  "Kitchen queue" carries a live count as an accent tag when orders are waiting (show 3).
  The nav block closes with a 2px rule; below it, pushed to the bottom of the rail, sit
  the signed-in person's name in semibold, their role beneath it, then "Open the
  storefront →", "LaunchFlow →" and a sign-out button, all at 12px. Those belong in the
  rail, not in a top bar.
- Screen head: each admin page renders its own header — a kicker, the screen name as h1
  at 32px flush left, whatever that screen's controls are flush right, and a 2px bottom
  rule with 24px beneath it. There is no shared top bar.
- Shop-state pill: a small filled square plus text ("TAKING ORDERS" ink / "PAUSED ·
  22 MIN LEFT" accent / "CLOSED" neutral) linking to Hours & pause. Today this appears on
  the Dashboard and on Hours & pause only. Putting it in every screen head is a PROPOSED
  change and worth making — label it as one.
- Content area: 24px top / 32px side padding, max width 1200px, ground background.
- A role with fewer screens (kitchen: only Kitchen queue; driver: Kitchen queue and
  Dispatch; front of house: Dashboard, Kitchen queue, Orders; shift lead: Dashboard,
  Kitchen queue, Orders, Dispatch, Inventory, Hours & pause, Reviews) sees a short rail —
  draw one of those variants too.

STATES
- Paused: the pill is accent and a 2px-bordered strip appears at the top of the content
  area: "Ordering is paused until 20:15 — 'kitchen at capacity'." with a secondary
  "Resume now".
- Loading a screen: the content area shows ruled skeleton blocks; the rail never flickers.

MOBILE (390px) and TABLET (1024px)
The rail stays 232px right down to 1000px — there is no intermediate narrowing. Below
1000px the whole back office becomes a normal scrolling document: the rail turns into a
sticky horizontal strip of bordered chips that scrolls sideways with no visible
scrollbar, the square bullets disappear, and the name/role/storefront/sign-out block at
the bottom of the rail is hidden entirely. Chips are at least 44px tall. Tables are the
one thing allowed to scroll sideways, inside their own box.
```

### B3 — Dashboard (`/admin`)

```
SCREEN: Dashboard (/admin)

PURPOSE: What have we taken today, and what is still in the kitchen. One glance, from the
office or the phone.

CONTENT
- Screen head: kicker "GRAYS · FRIDAY 5 SEPTEMBER", h1 "Dashboard"; on the right a
  pulsing 8px accent square with "Taking orders" beside it and a secondary
  "Hours & pause" button.
- Four KPI cells in a ruled 4-column grid (2px borders, no gaps): each cell is the value
  in Archivo 800 accent at 40px OVER a 12px uppercase neutral-700 label — value first,
  label second. The four, with their real label wording:
  £1,284.60 / "TODAY · 43 ORDERS" ·
  6 / "LIVE IN THE KITCHEN" ·
  £29.87 / "AVERAGE ORDER, 7 DAYS" ·
  812 / "CUSTOMERS WHO HAVE ORDERED".
  There is no "2 not accepted yet" sub-figure — the live count is one number covering
  every open order including unaccepted ones. Do not invent the breakdown.
- Then the kicker "RECENT ORDERS" and a ten-row table with these exact columns:
  Order (#1043, a link) · Customer (Ada Okafor) · Mode (Delivery / Collection) ·
  Shop (Grays) · Status · Total right-aligned. Status is plain text today, using the real
  wording — Order received / Accepted / Being prepared / Ready / Out for delivery /
  Completed / Rejected. Drawing it as a tag (accent for live, outline for ready, neutral
  for done) is a PROPOSED improvement; say so. Rows are 1px-ruled; hovering fills the row
  with surface.
- A plain line under the table (PROPOSED): "Today and the last 7 days only." — there is
  no date picker and no shop breakdown, so do not draw either.
- One thing worth showing honestly: the order number links to /order/[id], the
  customer-facing tracker, which needs no login at all.

STATES
- Quiet night: KPI values still shown, table replaced by the real copy "No orders yet."
  A ghost "Open the kitchen queue →" beside it is a proposed addition.
- Loading: KPI values as neutral-200 blocks 120x40; table as six skeleton rules.
- Error: a 2px-bordered block where the table would be — "Couldn't load today's orders."
  with a secondary "Try again".

MOBILE (390px)
KPI grid becomes 2x2 then a single column below 440px. The order table becomes stacked
blocks: order number and status tag on line one, customer and mode on line two, total
right-aligned in Archivo 800 on line three.
```

### B4 — Kitchen queue (`/kitchen`)

```
SCREEN: Kitchen queue (/kitchen) — designed for a wall tablet at 1024px landscape first,
then 1200px desktop

PURPOSE: The screen the shop actually works from all night. It has to be readable from
two feet away with flour on the glass.

CONTENT
- Its own header (not the admin rail): kicker "KITCHEN QUEUE" over the h1 "Tickets" on
  the left; on the right, one live state item per shop — a pulsing 8px square (accent
  when open, neutral-500 when paused, neutral-400 when closed) followed by
  "Grays: open" / "Grays: paused until 20:15" / "Grays: closed" — then the pause control,
  an "Enable sound" button and "Sign out". There is no clock on this screen; adding one
  is a proposed change, and it is a good one for a wall tablet.
- The pause control is a select today with exactly these options: Resume · Pause 15 min ·
  Pause 30 min · Pause 1 hour · Pause today. When the shop is already paused it is
  replaced by a secondary "Resume" button. Redraw the select as four chips if you like,
  but keep all four durations — "Pause today" is one of them.
- Under the header, the real standing line: "Oldest ticket first. Accent timers are past
  the 20-minute promise."
- Four ruled columns of equal width, minimum height 520px, 2px borders:
  NEW (2) · IN THE OVEN (3) · READY (1) · OUT FOR DELIVERY (2). Column header is the name
  in Archivo 800 with the count in accent at 22px.
- Ticket: surface fill, 12px padding, a 4px ink left edge that turns accent once the
  order has waited more than 20 minutes. Contents: monospace order number #1043 and the
  elapsed time "8 min" in Archivo 800 16px (accent when late); tags for mode and payment
  (DELIVERY outline, PAID neutral, CASH accent); item lines as "1× Original 13" Large ·
  BBQ base · extra cheese, jalapeños" with the kitchen note underneath in accent-700
  ("Note: well done"); deal lines list their contents indented; then the customer name,
  a tap-to-call phone number, and the delivery address in 12px; then one full-width
  primary button per available next step, using the REAL labels:
  New → "Accept" (which opens the ETA chooser); In the oven → "Cooking" then "Ready";
  Ready → "Out for delivery" or "Collected"; Out for delivery → "Delivered".
  Do not invent "Out of the oven", "Hand to driver" or "Done" — none of those exist.
- Accepting opens an inline block on the ticket, not a modal: a "Ready in" minutes field
  prefilled with the shop's own default — 35 for a delivery, 15 for a collection, plus
  any extra minutes the postcode band adds — and a primary "Accept". If you replace the
  field with chips, the chip set must contain 15 and 35 or the default cannot be shown.
- Rejecting is a select on New tickets offering exactly these five reasons: Too busy ·
  Item unavailable · Outside delivery area · Closing soon · Other. ("Can't reach the
  customer" is not one of them.) Redraw it as a ruled list, and add a warning line when
  the order is paid: "This order was paid by card — rejecting refunds it in full." Today
  it asks for confirmation with a browser dialog; an inline confirm is the fix.

STATES
- Empty column: the real copy "Nothing here." in neutral-500, at the top of the column's
  ticket area.
- All empty: the four columns still drawn, with "Quiet — nothing waiting." across them.
- New order arriving: the ticket carries a brief accent pulse on its left edge; a badge on
  the NEW column header. Sound is off until someone taps "Enable sound" — design the
  unlit state of that button explicitly.
- Stale connection: a 12px line in the header — "Last updated 14 seconds ago."
- Error: a strip under the header — "Couldn't reach the server. Retrying." Tickets stay
  on screen; never blank the board.

MOBILE (390px)
The four columns become one column with the stage as a sticky section header and a
segmented control at the top to switch stage. Ticket buttons at least 48px tall.
```

### B5 — Orders (`/admin/orders`)

```
SCREEN: Orders (/admin/orders)

PURPOSE: Find any past order by name, phone or postcode, and pull the lot into a
spreadsheet.

NOTE: still part-way on the older styling — you are drawing the conversion.

CONTENT
- Toolbar on one ruled line: a search input placeholder "Name, phone, postcode", a status
  select whose first option is "All statuses" followed by every real status (Awaiting
  payment, Order received, Accepted, Being prepared, Ready, Out for delivery, Completed,
  Rejected, Cancelled — not a "Live only" grouping), two date inputs (From / To), a
  secondary "Filter", and a secondary "Export CSV" pushed right.
- Result line: "Showing 50 of 812 orders" in 13px ink-55%.
- Table, 1px rules, 2px header rule, with the real columns and nothing more:
  # (order number, a link) · When (Fri 4 Sep 19:02) · Customer · Type (Delivery /
  Collection) · Shop (Grays) · Status · Total right-aligned in Archivo 800.
  There is NO payment column on this screen and no phone under the customer name — the
  CSV export carries payment, but the table does not. Do not draw a CARD/PAID column.
  Rows hover to surface.
- Pagination as a ruled row at the bottom: "← Previous · Page 1 of 17 · Next →".
- A plain 12px note under the table: "This list is read-only. To change an order, use the
  kitchen queue." — because there is no admin order detail screen, and designing one
  would misrepresent what is built.

STATES
- Empty result: "No orders match that search." with a ghost "Clear filters".
- Loading: eight skeleton rows; the toolbar stays live.
- Export running: the button reads "Preparing CSV…" and is disabled.
- Export capped: a neutral-tinted line — "Exports are capped at 5,000 orders. Narrow the
  dates to get the rest."

MOBILE (390px)
Toolbar stacks: search full width, then status and dates two-up, then the buttons. The
table becomes stacked blocks — order number and status on line one, customer and mode on
line two, placed time and total on line three.
```

### B6 — Dispatch (`/admin/dispatch`)

```
SCREEN: Dispatch and drivers (/admin/dispatch)

PURPOSE: See who is out, who is free, and note who took which delivery. Be honest that
there is no live tracking.

CONTENT
- A map panel across the top: a drawn 2px ruled grid on surface with a square accent
  marker for the shop and two smaller markers for drivers who are out, and a 10px
  monospace caption bottom-left: "Map placeholder — no live driver location". Do not draw
  roads or a realistic map.
- Two columns, 1fr / 1fr.
LEFT — "DRIVERS", a ruled table: Name · Vehicle · Status tag · On order · Back at ·
  action button.
  Marek Nowak · Vauxhall Corsa GY19 KLM · ON DELIVERY (accent) · #1043 · 19:52 ·
  ghost "Mark available"
  Aisha Rahman · Honda PCX LT21 WRX · AVAILABLE (outline) · — · — · ghost "Off shift"
  Danny Fields · Ford Fiesta EA18 TYU · AVAILABLE · — · — · ghost "Off shift"
  Kasia Wójcik · Yamaha NMAX RB22 PLO · OFF SHIFT (neutral) · — · — · ghost "Available"
  A 12px line beneath: "Drivers are set up in the shop's config file."
RIGHT — "READY TO GO", a ruled list of delivery orders: order number, customer, address,
  items summary, total, and "waiting 12 min" in accent past 20 minutes; then a driver
  select and a primary "Assign". Include one order still in preparing, tagged
  "IN THE OVEN" so it is clearly not cooked yet.
- A plain note under the right column: "Assigning records who took it. The order still
  needs marking 'out for delivery' on the kitchen screen, and the driver isn't texted."

STATES
- No drivers on shift: "Nobody is on shift." with a line about setting drivers up.
- Nothing ready: "Nothing waiting for a driver."
- Assigning: the row's button reads "Assigning…"; on success the row moves up into the
  driver table.
- Loading: skeleton rows in both columns.

MOBILE (390px)
Map placeholder becomes a 16:9 band. Both tables become stacked blocks. The assign
control becomes a full-width select plus a full-width button.
```

### B7 — Menu and pricing (`/admin/menu`)

```
SCREEN: Menu & pricing (/admin/menu)

PURPOSE: Change a price, mark something sold out, hide an item, reorder the list — in
seconds, on a phone, mid-service.

CONTENT
- Head note in a 2px-bordered block: "You can edit prices, names, descriptions and
  availability here. Adding or removing a product, category, size or photo is still a
  developer job — it lives in the shop's menu file."
- A category segmented control: Pizzas 30 · Starters 5 · Sides 9 · Chicken 7 · Pasta 2 ·
  Desserts 5 · Drinks 10.
- For the selected category, a ruled product list. Each row: reorder arrows (↑ ↓) in a
  32px column; the name and description as editable inline inputs sharing one "Save" ghost
  button; then a size/price block — for a pizza, five inline £ inputs each 72px wide,
  labelled 7" / 10" / 13" / 15" / 20", showing 8.39, 13.64, 15.74, 17.84, 19.94, each
  with its own small "Save"; then three square toggles with text labels: Sold out ·
  Featured · Hidden.
- Below the products, "OPTIONS" — two blocks: Base (Tomato base, BBQ base, Garlic base
  +£0.50) and Extra toppings (16 chips), each option a square toggle chip that can be
  marked sold out; a sold-out chip is struck through with a neutral fill.
- A 12px line at the bottom. Every save clears the menu cache, so the accurate wording is
  "Changes appear on the site straight away." — not "within a minute".

STATES
- Saving one field: that input's border turns accent and the button reads "Saving…";
  on success a small "Saved 19:41" appears beside it and fades. No page-level banner.
- Save failed: the input keeps the typed value, border accent, and the line "Didn't save —
  try again" beneath it.
- Sold out: the whole row's name goes to 55% and a neutral "SOLD OUT" tag appears next to
  it, but the price inputs stay editable.
- Loading: eight skeleton rows.

MOBILE (390px)
One product per stacked block: name and description full width, prices as a 2-up grid of
labelled inputs, toggles as three full-width ruled rows with the label left and the switch
right. Reorder arrows become two 44px buttons.
```

### B8 — Deals (`/admin/deals`)

```
SCREEN: Deals (/admin/deals)

PURPOSE: Reprice a deal or take it off the site. Nothing else is editable and the screen
must say so.

CONTENT
- Head note in a 2px-bordered block: "Price, active and featured are the only things you
  can change here. What's inside a deal is set in the shop's menu file."
- A ruled list of all eight deals. Each row: the deal name in Archivo 800; the slot
  make-up as plain text beneath in ink-55% ("2 × 10" pizza + onion rings + hot wings +
  garlic bread + a bottle"); a £ price input 90px wide with the value 29.69 and its own
  ghost "Save"; then two square toggles with labels — "Active" and "Featured on home".
  All eight rows, with the real prices: Meal for 1 15.39 · Meal for 2 29.69 (featured) ·
  Family Meal 1 29.69 · Family Meal 3 37.39 · Mega Deal 28.59 (featured) ·
  Any 2 x 10" Pizzas 24.19 · Any 3 x 13" Pizzas 40.69 · Any 3 x 20" Pizzas 51.69.
- A 12px line: "Featured deals show on the home page. There's no limit — tick sparingly."

STATES
- Saved: "Saved 19:41" beside the price input, fading.
- Inactive deal: the whole row at 55% opacity with a neutral "OFF" tag before the name.
- Loading: four skeleton rows.
- Empty: "No deals set up." with the line about the config file.

MOBILE (390px)
Each deal becomes a stacked block: name, contents, then price input and the two toggles as
full-width ruled rows.
```

### B9 — Promotions (`/admin/promos`)

```
SCREEN: Promotions (/admin/promos)

PURPOSE: Create a discount code with rules on it, see how much it has been used, switch
it off.

CONTENT
Two columns, 5fr / 7fr.
LEFT — "CREATE OR UPDATE A CODE", a 2px-bordered form panel:
  Code (uppercased as typed, monospace input) · Type (segmented: % off | £ off | Free
  delivery) · Value (label changes with the type: "Percent off" / "Pounds off" / hidden) ·
  Minimum order £ · Maximum uses · Ends on (date) · Applies to (select: Delivery and
  collection / Delivery only / Collection only) · a square tick "First order only" ·
  primary block "Save code".
  A warning line in accent-700 above the button: "Saving a code that already exists
  overwrites its rules and switches it back on."
RIGHT — the codes table, 1px rules: Code (monospace 14px) · Rule in plain English ·
  Used · Ends · Active toggle (18px square) · ghost "Disable".
  WELCOME10 · 10% off, £15 minimum, first order only · 128 of 500 · — · on
  FREEDEL · Free delivery over £20, delivery only · 64 · 30 Sep · on
  COMEBACK15 · 15% off, £12 minimum · 311 · — · on
  TUESDAY20 · 20% off, £15 minimum · 22 · — · on
  THANKS-7K2Q · £5 off for one named customer, £15 minimum · 0 of 1 · 3 Dec · on
  (that last row is a referral reward — design a small neutral "PERSONAL" tag for it so it
  can be told apart at a glance)
- A 12px line: "Codes can't be deleted, only switched off."

STATES
- Saved: the new row prepends with a brief surface fill.
- Validation: "Enter a code." / "A percentage has to be between 1 and 100." beneath the
  field.
- Used up: the row shows "500 of 500" in accent and a neutral "USED UP" tag.
- Expired: date in accent-700 with an "ENDED" neutral tag; the row stays in the list.
- Empty: "No codes yet." with the form still to the left.

MOBILE (390px)
Form first as full-width stacked fields, then the table as stacked blocks: code and
toggle on line one, rule on line two, usage and end date on line three.
```

### B10 — Inventory (`/admin/inventory`)

```
SCREEN: Inventory (/admin/inventory)

PURPOSE: A shopping list of what is running low. Be honest: nothing decrements as food is
sold, and pressing Reorder does not message the supplier.

CONTENT
- Head note in a 2px-bordered block: "Stock counts don't move as orders come in — this is
  a par-level list you keep by hand. 'Reorder' flags a line; it doesn't message the
  supplier."
- Four KPI cells in a ruled row, LABEL above VALUE on this screen. The real numbers for
  the seeded stock, so use these exactly: OUT OF STOCK 1 (the only accent value) ·
  BELOW PAR 9 · ON ORDER 2 · AT OR ABOVE PAR 38%. ("Below par" counts lines above zero
  but under par, so the one out-of-stock line is not double-counted.)
- One button on the head line: primary "Reorder everything below par", disabled when
  nothing is low. There is no stock-count control anywhere — do not draw one.
- A ruled table of all 16 lines with the real columns: Ingredient · On hand · Par ·
  Level · Supplier · Status tag · action. There is no separate Unit column — the unit
  rides with the number, "48 kg" and "60 kg". The level bar is 120×10px with a surface
  track and no border of its own; the fill is ink at or above par, accent-400 below par,
  and full accent when the line is out.
  00 flour 48/60 kg Marsh Mill · BELOW PAR
  Fior di latte 9/18 kg Marsh Dairy · BELOW PAR
  Mature cheddar 14/12 kg Marsh Dairy · IN STOCK
  Tomato passata 22/30 L Essex Produce · BELOW PAR
  Pepperoni 0/8 kg Thurrock Meats · OUT (accent tag) · ON ORDER
  Ham hock 5/6 kg · Chicken breast 11/10 kg · Chestnut mushrooms 3/7 kg ·
  Red onions 12/8 kg · Peppers 2/6 kg · Sweetcorn 6/5 kg · Olives 4/4 kg ·
  Semolina 7/6 kg · Olive oil 9/12 L · Pizza boxes 10" 240/400 ea Boxpack ·
  Pizza boxes 13" 95/300 ea Boxpack · ON ORDER
  (Suppliers, in order: Marsh Mill, Marsh Dairy, Marsh Dairy, Essex Produce, Thurrock
  Meats, Thurrock Meats, Thurrock Meats, Essex Produce, Essex Produce, Essex Produce,
  Essex Produce, Essex Produce, Marsh Mill, Marsh Mill, Boxpack, Boxpack.)
  Action column: a secondary "Reorder" that becomes a disabled "On order" once pressed.
  Status tags use the real wording: "Out" (accent), "Below par" (outline), "In stock"
  (neutral).

STATES
- All at par: the KPI row still shows, table rows all "IN STOCK", and the bulk button is
  disabled at 45% with "Nothing below par" beside it.
- On order: the row's action is disabled and there is no way to book the delivery in —
  add a 12px line saying so: "Booking a delivery in isn't built yet."
- Loading: skeleton rows.

MOBILE (390px)
KPIs 2x2. Each stock line becomes a block: ingredient name and status tag on line one,
the level bar full width on line two, "9 of 18 kg · Marsh Dairy" on line three, and a
full-width "Reorder" button.
```

### B11 — Customers (`/admin/customers`)

```
SCREEN: Customers (/admin/customers)

PURPOSE: The shop's own customer list — who the regulars are, who has drifted away, and
who can be messaged.

CONTENT
- A search input, real placeholder "Search name, phone or email", and a count line:
  "Showing 200 of 812 customers — narrow the search to see more." The list is capped at
  the 200 most recent with no pagination.
- Nine segment chips in a wrapping row, each with its opted-in headcount as a small
  number. Use the REAL segment names, verbatim — the last two in particular, because
  Farm Pizza does not deliver to a single SS postcode and a "Basildon area (SS)" chip
  would be nonsense on this shop:
  Everyone opted in 412 · Ordered in the last 30 days 188 · Not ordered in 60+ days 143 ·
  Not ordered in 120+ days 96 · Ordered once only 231 · Regulars (5+ orders) 104 ·
  Big spenders (£250+ lifetime) 38 · Grays & Little Thurrock (RM17) 402 ·
  Chafford & West Thurrock (RM16/RM20) 61. The selected chip is an accent fill.
  Beside the row, a ghost "Message this group →" linking to Campaigns.
- A ruled table with the real columns: Name · Phone · Orders (right-aligned) ·
  Spent (right-aligned) · Last order · Marketing (an accent "OPTED IN" tag or nothing).
  There is no email column on this table even though the search box looks at email.
  Ada Okafor · 07700 900101 · 27 · £612.40 · 2 days ago · OPTED IN
  Hannah Bright · 07700 900112 · 41 · £948.10 · yesterday · OPTED IN
  Marcus Webb · 07700 900133 · 9 · £171.05 · 84 days ago
  Priya Shah · 07700 900105 · 18 · £503.60 · 6 days ago · OPTED IN
  Jon Slater · 07700 900147 · 6 · £98.20 · 132 days ago
- A 12px honest note: "The segment counts only include people who can be messaged; the
  table shows everyone, so the two numbers differ." and "This list is read-only — you
  can't edit a customer or opt someone out from here."

STATES
- Empty search: "Nobody matches "webb"." with a ghost "Clear".
- Segment with nobody in it: "Nobody is in this group yet."
- Loading: ten skeleton rows.

MOBILE (390px)
Chips scroll horizontally in one row without a visible scrollbar. Each customer becomes a
block: name and opt-in tag on line one, phone on line two, then three labelled figures
(Orders / Lifetime / Last order) as a 3-up ruled mini-grid.
```

### B12 — Campaigns (`/admin/campaigns`)

```
SCREEN: Campaigns (/admin/campaigns)

PURPOSE: Text or email one group of customers, right now, and see what it earned back.
Sending is instant and irreversible — the design has to slow the finger down.

CONTENT
Two columns, 7fr / 5fr.
LEFT — the composer, a 2px-bordered panel:
  Channel (segmented: SMS 4p each | Email free) · Send to (select of the nine segments,
  showing the live count: "Not ordered in 60+ days — 143 people") · Offer code (select of active
  codes plus "No code (not measurable)") · Subject (email only) · Message (textarea, with
  a live counter "128 characters · 1 text · £5.72 to send" and the merge fields listed
  beneath as monospace chips {name} {shop} {code}).
  A preview block showing the message with the merge fields filled in. Use the real
  win-back body so the merge order is right:
  "Farm Pizza: we miss you Ada! COMEBACK15 gets you 15% off your next order. Order direct
  at farm-pizza.com Reply STOP to opt out". (A live preview does not exist today — this
  is a proposed addition, and a valuable one, because there is also no test send.)
  Then a warning block, 2px accent border, shown when the code cannot work for the
  audience: "WELCOME10 is first-order-only and everyone in this group has ordered before —
  nobody will be able to use it."
  Then the send control: a primary block button "Send to 143 people · £5.72" and, above
  it in accent-700, "This sends immediately. There is no cancel and no test send."
RIGHT — "PAST CAMPAIGNS", a ruled list of the last few: name/segment, date, channel tag,
  Sent / Failed, Orders back, Cost, Earned. E.g. "Lapsed 60+ · 3 Sep · SMS · 143 sent,
  2 failed · 19 orders · £5.72 · £441.30".
  Below it, a segment price list: each of the nine segments with its headcount and the
  cost to text it.

STATES
- Sending: the button becomes "Sending 143 messages…" and the whole composer is disabled;
  a plain progress line "62 of 143 sent" — this can take minutes, so design for it.
- Send finished: a 2px-bordered block at the top — "143 sent, 2 failed. £5.72."
- Send interrupted: "This send was interrupted. Some messages went out — check the
  campaign list before sending again."
- Dry run (no SMS credentials): a neutral-tinted block above the send button —
  "Texting isn't switched on. Messages will be logged, not sent."
- Empty history: "No campaigns yet."

MOBILE (390px)
Composer first, full width, with the send button pinned to the bottom of the viewport and
the recipient count and cost inside its label. Past campaigns become stacked blocks.
```

### B13 — Marketing (`/admin/marketing`)

```
SCREEN: Marketing — automations and money back (/admin/marketing)

PURPOSE: The rules that text customers on their own, and the honest pounds-in,
pounds-out of doing it.

CONTENT
- Four KPI cells in a ruled row: EARNED £4,812.60 · SPENT £186.40 · NET £4,626.20 ·
  COMMISSION SAVED £2,140 (estimate) — the last one carries a small 11px line
  "Estimate: 14% of this month's direct orders."
- "WHERE THE MONEY WENT" — a small ruled table by message kind: Automations · Campaigns ·
  Review requests · Referral rewards, with Sent / Cost / Orders / Earned columns.
  Add a plain 12px caveat line beneath: "One-off campaigns are currently counted in the
  Automations row."
- "AUTOMATIONS" — a ruled list of the five seeded rules. Each row: name in Archivo 800,
  the rule in plain English beneath, then columns Waiting · Sent · Orders · Spend ·
  Earned, then a status toggle (Paused / On) and a secondary "Send 41 now · £1.64".
  Chase an abandoned checkout — 25 minutes after an unpaid checkout, code COMEBACK15
  Win back after 45 days — 45 days since the last order, code COMEBACK15
  Second order nudge — 14 days after a first order, code COMEBACK15
  Thank a new customer — the day after a first order, no code
  Quiet night filler — code FREEDEL
  All five start paused — draw the paused state as the default.
- "NEW AUTOMATION" — a compact form panel: Name · Trigger (select) · Days · Cooldown
  days · Offer code · Max per run · Message · primary "Save (starts paused)".
- "WORD OF MOUTH" — three figures in a ruled row: Codes shared 34 · Friends who ordered
  11 · Rewards paid out £55.
- An honest block at the bottom, 2px border: "Automations only run when something calls
  them on a schedule. If that isn't set up on the server, they only send when you press
  'Send now'."

STATES
- Send now: an inline confirm on the row, not a modal — "Text 41 people for £1.64?" with
  primary "Yes, send" and ghost "Cancel". Never fire straight off the first tap.
- Paused: the row at 100% but with a neutral "PAUSED" tag before the name; the Send now
  button still available.
- A trigger that can never fire (Birthday treat): the row greyed with the line
  "No birthdays are collected, so this never sends."
- Loading: KPI values as neutral-200 blocks, four skeleton automation rows.

MOBILE (390px)
KPIs 2x2. Each automation becomes a block: name and status tag, the rule, then the five
figures as a labelled 2-up mini-grid, then two full-width buttons.
```

### B14 — Reviews (`/admin/reviews`)

```
SCREEN: Reviews (/admin/reviews)

PURPOSE: Read what customers said and draft a reply. Be honest that the reply is stored
here and never reaches Google.

CONTENT
- Left column, 5fr: "RATING" — the average in Archivo 800 at 64px with "from 8 reviews"
  beneath. Work from the eight seeded reviews, so the real figures are: average 4.1, and
  a five-row distribution of 5 ★ 4 · 4 ★ 2 · 3 ★ 1 · 2 ★ 1 · 1 ★ 0, each row a
  2px-bordered bar filled ink with the count right-aligned. They must add up to 8.
  Beneath: "7 waiting for a reply" as an accent tag — only one of the eight has a reply
  saved against it.
- Right column, 7fr: a ruled list of reviews. Each: the customer name in Archivo 800, a
  five-star rule (filled squares, not star glyphs — use small filled squares in accent for
  the score and neutral-300 for the rest), a source tag (GOOGLE outline / DIRECT neutral),
  the date, then the body at 15px.
  Chloe H. · 5 · Google · 1 day ago · "Best pizza in Grays, no contest. Dough is unreal
  and it turned up hot."
  Dan M. · 4 · Direct · 2 days ago · "Really good. Took a bit longer than the estimate on
  a Friday but worth the wait."
  Nadia K. · 5 · Google · 3 days ago · with a reply already saved, shown as an indented
  block with a 2px left rule: "Thanks Nadia, we will pass that on to Marek."
  Ryan T. · 2 · Direct · 4 days ago · "Garlic bread was cold when it arrived. Pizza was
  fine." — unanswered, so it carries the reply box.
  Reply box: a textarea with a 1,000-character counter and a primary "Save reply".
- A 2px-bordered honest block at the top: "Replies are saved here only. They are not
  posted to Google and the customer isn't told."

STATES
- Empty: "No reviews yet. Review request texts go out 45 minutes after an order is
  completed, but replies come back on Google, not here."
- Reply saved: the box is replaced by the indented reply block; there is no edit — add the
  12px line "A saved reply can't be changed."
- Loading: three skeleton review blocks.

MOBILE (390px)
Rating summary sits above the list, full width, with the average and the distribution
side by side. Review blocks are full width; the reply textarea is at least 96px tall with
a full-width save button.
```

### B15 — Staff (`/admin/staff`)

```
SCREEN: Staff and roles (/admin/staff)

PURPOSE: Change what someone is allowed to see, and mark who is on tonight.

CONTENT
Two columns, 7fr / 5fr.
LEFT — "STAFF", a ruled table: Name · Role (a select, saved per person) · Hours this week ·
  On shift tag · action button.
  Ada Okafor · Manager · 41 · ON SHIFT (accent tag) · ghost "Clock off"
  Tom Bennett · Shift lead · 36 · ON SHIFT · ghost "Clock off"
  Giulia Ferrari · Kitchen · 38 · ON SHIFT · ghost "Clock off"
  Sam Whitfield · Kitchen · 22 · ON SHIFT · ghost "Clock off"
  Priya Shah · Front of house · 18 · ON SHIFT · ghost "Clock off"
  Marek Nowak · Driver · 30 · ON SHIFT · ghost "Clock off"
  Aisha Rahman · Driver · 27 · OFF (neutral) · ghost "Clock on"
  Danny Fields · Driver · 24 · OFF · ghost "Clock on"
  A 12px note: "Adding a starter, removing a leaver or changing a PIN is a developer job.
  'Hours this week' is a fixed figure, not a timesheet."
RIGHT — "WHO CAN SEE WHAT", the live permission matrix as a ruled grid: sixteen screen
  rows down the side, in the order the code actually lists them, which is NOT the sidebar
  order — Dashboard, Kitchen queue, Orders, Dispatch, Menu & pricing, Deals, Promotions,
  Inventory, Customers, Campaigns, Reviews, Marketing, Staff, Hours & pause,
  Delivery zones, LaunchFlow (Reviews before Marketing here; the rail has it the other
  way round) — against five role columns (Manager, Shift lead, Kitchen, Driver, Front of
  house). A granted cell is a small filled ACCENT square; a denied cell is empty. Manager
  is granted everything implicitly, so that column is filled all the way down. The real
  grants for the rest: Shift lead — Dashboard, Kitchen queue, Orders, Dispatch,
  Inventory, Hours & pause, Reviews. Kitchen — Kitchen queue only. Driver — Kitchen queue
  and Dispatch. Front of house — Dashboard, Kitchen queue, Orders.
  A 12px note: "This is read-only — the roles themselves are set in code."

STATES
- Saving a role: the select border turns accent and a small "Saved" appears beside it.
- Demoting yourself: a warning line under the select — "This is your own account. Changing
  it may lock you out of this screen."
- Loading: eight skeleton rows; the matrix renders immediately.

MOBILE (390px)
Staff rows become blocks: name and on-shift tag, role select full width, hours, then a
full-width clock button. The matrix becomes one block per role with a ruled list of the
screens that role can open.
```

### B16 — Hours and pause (`/admin/hours`)

```
SCREEN: Opening hours and emergency pause (/admin/hours)

PURPOSE: Stop new orders in one tap when the kitchen is swamped; change the opening times
without ringing anyone.

CONTENT
NOTE: still part-way on the older styling, and its status pill currently uses green and
amber fills, which the system forbids. Replace them with accent / outline / neutral tags.

- Top block, 2px ink border, given real weight: the shop state pill (TAKING ORDERS /
  PAUSED · 22 MIN LEFT / CLOSED), then "PAUSE ORDERING". Today the durations are a select
  reading Resume · Pause 15 min · Pause 30 min · Pause 1 hour · Pause today; redraw them
  as four chips — 15 min · 30 min · 1 hour · Rest of today — a reason input
  ("Reason (shown to customers)", and note this form applies no length limit even though
  the kitchen screen's own pause caps the reason at 80 characters), and a primary
  "Pause ordering". When paused, this block instead shows "Paused until
  20:15 — 'kitchen at capacity'" in Archivo 800 with a secondary "Resume now".
- 2px rule, then "OPENING HOURS — GRAYS": a seven-row grid, one row per day, each with a
  day label, an Open time input and a Close time input (HH:MM), plus a square "Closed"
  tick that empties both. Today's row has a surface fill.
  Mon 11:00-02:00 · Tue 11:00-02:00 · Wed 11:00-02:00 · Thu 11:00-02:00 ·
  Fri 11:00-03:00 · Sat 11:00-03:00 · Sun 11:00-02:00
  A 12px line: "A close time earlier than the open time means the next morning — 11:00 to
  02:00 is correct for a shop that trades past midnight."
- Primary "Save hours" and, beneath it, the honest limits: "One opening and one closing
  per day — a shop that shuts between lunch and dinner can't be set up here. There are no
  bank-holiday dates: change the day, then change it back."
- A second block for Basildon, drawn empty with "Not set up yet".

STATES
- Paused (as above), and a countdown that is visible: "22 minutes left".
- Save failed on a bad time: the offending input takes an accent border with
  "Use 24-hour time, like 17:30" beneath it — the current build silently drops bad times,
  and this is the state that should replace that.
- Saving: button reads "Saving…".
- Loading: skeleton time inputs.

MOBILE (390px)
The pause block is first and full width, chips 2-up, the pause button full width and at
least 48px tall. Each day becomes one row: day label left, the two time inputs side by
side right, the closed tick beneath.
```

### B17 — Delivery zones (`/admin/zones`)

```
SCREEN: Delivery zones, fees and bands (/admin/zones)

PURPOSE: Decide which postcodes get delivered to and charge more for the far ones.

CONTENT
- Per shop, a 2px-bordered block. GRAYS:
  - "DISTRICTS WE DELIVER TO" — a comma-separated text input holding
    "RM15, RM16, RM17, RM18, RM19, RM20" with the districts also shown as neutral tags
    beneath it, and the line "A letters-only entry like RM covers the whole area."
  - A 4-up row of labelled inputs: Standard delivery fee £1.99 · Minimum order £9.99 ·
    Collection ready in 15 min · Delivery in 35 min.
  - Shop address and phone as two more fields, under a small heading "SHOP DETAILS", so
    they read as a separate thing from the delivery rules.
  - "CHARGE BANDS" — a ruled table with editable cells: Name · Districts · Fee ·
    Minimum · Extra minutes · ghost "Remove".
    Grays & Little Thurrock · RM17 · £1.99 · £9.99 · 0
    Chafford & West Thurrock · RM16, RM20 · £3.49 · £14.99 · +15
    Then an "Add a band" row of empty inputs with a secondary "Add".
  - Two plain lines: "A band naming a district beats a wider area band." and "A band left
    at £0.00 minimum uses the shop's minimum."
  - Primary "Save shop settings" (that is the real label). Each band row saves itself,
    with its own secondary "Save" and "Remove".
- A warning block, 2px accent border, at the top of the screen: "Bands saved here are
  overwritten if the shop's config is reloaded. Tell whoever maintains the site when you
  change them."
- A second shop block for Basildon, empty, with "Not set up yet".

STATES
- Remove pressed: an inline confirm on the row — "Remove this band?" with primary
  "Remove" and ghost "Cancel". Today it deletes immediately with no confirmation; the
  design should fix that.
- Validation: "Enter at least one district." / "Use a fee like 3.49."
- Saving: button "Saving…".
- Loading: skeleton inputs.

MOBILE (390px)
The 4-up fee row becomes 2x2. Band rows become stacked blocks with labelled fields, and
"Remove" is a full-width ghost button at the bottom of each block.
```

### B18 — LaunchFlow console (`/admin/launchflow`)

```
SCREEN: LaunchFlow agency console (/admin/launchflow)
(Still on the older styling — you are drawing the conversion.)

PURPOSE: The agency's own screen — is this deployment wired up correctly. The shop owner
never sees it. It should look like the rest of the system but read as an instrument
panel: denser, more monospace, no marketing tone.

CONTENT
- h1 "LaunchFlow · farm-pizza", with a neutral tag "AGENCY ONLY" and the line
  "Signed in with the agency key. Session expires in 4 hours."
- "THIS DEPLOYMENT" — a ruled two-column definition list, values in monospace 13px:
  Client slug farm-pizza · Seeded yes · Config hash 8f2c1a94b3d70e51 ·
  Products 68 · Orders 812 · Customers 812 · Site farm-pizza.com.
- "SERVICES" — a ruled list, each row with a name, a state tag and a plain explanation:
  Stripe — NOT CONFIGURED (accent) — "No account id set. Card payments are off; cash on
  collection is the only route."
  Stripe webhook — MISSING SECRET (accent)
  Twilio (texts) — DRY RUN (accent) — "Messages are logged, not sent. Nobody receives a
  code, an order update or a campaign."
  Resend (email) — DRY RUN
  Kitchen alerts — NONE SET — "No kitchen number, no kitchen email, no printer webhook.
  A new order appears on the kitchen screen and nowhere else."
  Review URL — SET (neutral).
- "DOMAINS" — five rows with a status code each, because the check covers the canonical
  domain, www, and all three legacy domains: farm-pizza.com 200 · www.farm-pizza.com 301 ·
  order.farm-pizza.com 301 · farm-pizza.uk 301 · farmpizzatakeaway.co.uk 301. Plus a 12px
  line "Checked live on page load — slow by design."
- "ACTIONS" — four buttons on one ruled line, using the real labels: secondary
  "Clear menu cache", secondary "Test kitchen notifications", secondary
  "Run review-request job", and "Reload config → DB", which today is an ordinary primary
  button and should be redrawn as the most dangerous thing on the page. Beside that last one, in accent-700: "Overwrites prices, hours, delivery bands,
  stock counts, driver and staff records with the config file. No undo."
- Output area: a 2px-bordered surface block with monospace 12px JSON, scrolling inside its
  own box, never widening the page.

STATES
- Everything healthy: the same rows with neutral "OK" tags — draw this variant too.
- Reload pressed: an inline confirm requiring the slug to be typed —
  "Type farm-pizza to confirm" with an input and a primary "Reload".
- Running: button reads "Running…", output block shows a skeleton.
- Domain unreachable: the row shows "no response" in accent with the line "The domain may
  be down, or this server can't reach it."

MOBILE (390px)
Definition lists become stacked label-over-value rows. The output block scrolls
horizontally inside itself only. Action buttons full width, with the reload button last
and separated by a 2px rule.
```

---

## 4. What not to ask for

Anything in this list fights the system. If a generated screen comes back with one of
them, that is the thing to name in your next message — do not accept it and design around
it.

- **No gradients.** Not in buttons, not in hero backgrounds, not as an overlay on a
  photograph. Every fill in this system is one flat colour.
- **No shadows or elevation.** The system defines shadow tokens but the screens do not use
  them. Depth comes from 2px rules and the surface tone, never from a floating card.
- **No rounded corners.** Zero radius on buttons, inputs, tags, photos, panels, toggles and
  modals. The radio dot is the only circle. A "soft" 4px radius is still wrong.
- **No stock photography.** No smiling families, no chefs tossing dough, no rustic wooden
  boards, no restaurant interiors, no hands reaching for a slice. Food only, flat-lay, on
  plain grey.
- **No icon libraries.** No Font Awesome, no Material icons, no emoji as icons, no
  decorative pictograms next to headings. Arrows are typed characters. Where a status
  marker is needed, use a small filled square.
- **No second typeface**, no script or display face for headings, and no
  ALL-CAPS-EVERYTHING. Uppercase is reserved for 11-13px labels.
- **No cards.** No white rectangle floating on a tinted background with padding and a
  shadow. Content sits in a ruled grid.
- **No coloured status system beyond the accent.** No green ticks, no amber warnings, no
  blue info panels. Status is carried by tag style (accent / outline / neutral) and by
  words.
- **No centred layouts.** Nothing centres except numbers in a numeric cell. Headings,
  labels and button text are flush left, including inside full-width buttons.
- **No animation beyond a state change.** No parallax, no scroll reveals, no counting-up
  numbers, no confetti on order confirmation. A brief accent pulse on a new kitchen ticket
  is the maximum.
- **No spinners over content**, no full-screen loading overlays, no skeleton shimmer
  gradients. Loading is flat neutral-200 blocks in the shape of the content.
- **No modals for routine actions.** Confirmations are inline blocks in the flow. A modal
  is reserved for something irreversible, and even then it is a 2px-bordered block, not a
  dimmed sheet with rounded corners.
- **No invented features.** Do not add a driver map with real roads, a "cancel order"
  button, a points-redemption button, an allergen filter, a Build Your Own screen, star
  ratings on the storefront, or a live chat widget. None of them exist, and a design that
  implies they do creates work rather than saving it.
- **No fake data that contradicts the shop.** Prices, product names, opening hours,
  postcodes and phone numbers are given in each prompt. Do not substitute Margherita for
  Original, or invent a second branch's address.
- **No second branch drawn as if it were live.** Basildon is part of the business but is
  not in the config: there is no Basildon shop record, no Basildon town page, no Basildon
  postcodes and no SS delivery. Where a prompt asks for a second branch it is always in a
  greyed "coming soon" state, and the artboard must be captioned to say the block does
  not render today.
- **No bright-red filled buttons.** #ec3013 fails contrast on the ground and the build
  does not use it as a fill. Primary buttons and the selected segmented option are
  #ae1800. A design that comes back with #ec3013 buttons will not match the site.
- **No dark mode.** The system is a single light theme. Do not produce a dark variant.

---

## 5. Quick reference — the real numbers

Keep this beside you when you edit a prompt.

| Thing | Value |
| --- | --- |
| Shop | Farm Pizza, 7 Derby Road, Grays RM17 6QD, 01375 383877 |
| Accent | #ec3013 for tags, rules, numerals and small red text |
| Filled controls | #ae1800 (primary buttons, selected segment), hover #7c1405, pressed #4d170e |
| Second branch | Basildon — in the business, not yet in the config |
| Hours | Mon-Thu & Sun 11:00-02:00, Fri-Sat 11:00-03:00 (Europe/London) |
| Delivery | £1.99, £9.99 minimum, about 35 min; prep 15 min |
| Band 2 | Chafford & West Thurrock (RM16, RM20) £3.49, £14.99 minimum, +15 min |
| Districts | RM15, RM16, RM17, RM18, RM19, RM20 |
| Menu | 7 categories, 68 products; Pizzas 30, Starters 5, Sides 9, Chicken 7, Pasta 2, Desserts 5, Drinks 10 |
| Featured | 4 products: Original, Pepperoni Lover, Farm Pizza Special, Meat Machine — all from £8.39 |
| Allergens | 10 of 68 have none recorded, and all ten are drinks |
| Pizza sizes | 7" £8.39 · 10" £13.64 · 13" £15.74 · 15" £17.84 · 20" £19.94 |
| Options | Base (Tomato/BBQ free, Garlic +£0.50); Extra toppings, up to 8, £1.00-£1.50 |
| Deals | 8, £15.39 to £51.69; featured: Meal for 2, Mega Deal |
| Codes | WELCOME10, FREEDEL, COMEBACK15, TUESDAY20 |
| Referral | £5 to the friend, £5 back, £15 minimum, 90-day expiry, code shape ADA-7K2Q |
| Loyalty | Off. /rewards returns Not Found |
| Payments | Cash on collection only today; card needs Stripe keys, cash on delivery is off |
| Photos | 46 of 68 products photographed; 22 use the monogram tile |
| Back-office screens | 16. The rail lists 15 (LaunchFlow is a link at the bottom) in the B2 order; the permission matrix lists all 16 with Reviews before Marketing |
| Staff roles | Manager, Shift lead, Kitchen, Driver, Front of house |
| Segments | 9: Everyone opted in · Ordered in the last 30 days · Not ordered in 60+ days · Not ordered in 120+ days · Ordered once only · Regulars (5+ orders) · Big spenders (£250+ lifetime) · Grays & Little Thurrock (RM17) · Chafford & West Thurrock (RM16/RM20) |
| Ops sample data | 16 stock lines (1 out, 9 below par, 2 on order, 38% at par) · 4 drivers · 8 staff · 8 reviews averaging 4.1 · 5 automations, all paused |
| Kitchen | 4 columns; reject reasons Too busy / Item unavailable / Outside delivery area / Closing soon / Other; pause 15 / 30 / 60 min / rest of today; late after 20 min; polls every 5s |
| Breakpoints | 1200 desktop · 1000 · 700 · 440; the storefront header has its own at 760 |
| Still on old styling | Storefront: town page, category pages, deal builder shell, allergens, contact, privacy, terms, product card, sticky bar, 404, error. Back office: Menu & pricing, Promotions, Hours & pause, Orders, Deals, LaunchFlow |
