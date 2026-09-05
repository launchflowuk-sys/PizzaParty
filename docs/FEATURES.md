# What this platform actually does

A capability inventory for the LaunchFlow takeaway platform, written from the code rather
than from the roadmap. It exists so that a sales conversation, a deck and a design brief
can all be built from the same honest list.

Every entry says what the thing does, where it lives, and where it stops. Where a feature
is half-built, switched off or held together by a config file, it says so.

**Live tenant:** Farm Pizza — one shop, 7 Derby Road, Grays RM17 6QD. 7 menu categories,
68 products, 8 meal deals. Delivering to RM15–RM20.

> **Note on shop count.** The config carried two branches (Basildon and Grays) until
> commit `0a8cf53`; it now carries one, Grays. Every claim below about "the shop" means
> that single branch. The platform supports several branches per client — the code loops
> over locations throughout — but nothing in the live config exercises that today.

## Status key

| Marker | Meaning |
| --- | --- |
| **Verified** | Built, and the logic underneath it is covered by passing unit tests |
| **Built** | Built and working, but no automated test covers it |
| **Partial** | Usable, but a named part of it is a placeholder or does nothing |
| **Off** | Code exists, switched off in config, would need more work to be useful |

There are 16 unit tests in total, across two files (`scripts/tests/logic.test.ts`,
`scripts/tests/config.test.ts`). They cover opening hours across midnight, next-opening,
pre-order slot generation, postcode matching, delivery band precedence, UK phone
normalisation, and config/CSV loading. Nothing else in the platform has an automated test.
There are no browser or end-to-end tests at all.

---

# 1. Taking orders

## Menu browsing — **Built**

Loads the live menu from the database and renders a sticky category rail, a search box that
filters the whole menu on name and description, and a three-up photo grid. An item whose
only required choice is nothing at all gets an **Add** button that drops it straight into
the basket with a toast; anything with sizes or a required option group shows **Choose
options** and sends the customer to the product page. Sold-out items show a Sold out tag
and no add button. V / VG / Spicy labels come from the product's tags.

**Where:** `/menu`, plus older per-category pages at `/menu/<category>`.

**Limits.** Search reads the name and description only — it will not find "vegan" or "nut
free", and there is no filter button for vegetarian, vegan or spicy. 46 of the 68 products
have a photo; the other 22 show a two-letter initials tile. The menu is cached for 60
seconds, so a price change or a sold-out toggle can take up to a minute to appear. Nothing
on the menu tells the customer the shop is shut — the only closed indicator is a tile on
the home page and the shops page, and the actual block does not arrive until checkout. The
per-category pages are not linked from the main menu screen and still use the older card
styling.

## Product page: sizes, base, extra toppings — **Built**

Photo, description, diet tags and a per-product allergen line, then the picker: sizes as
ruled radio rows (five sizes on pizzas, small through to 20 inch), single-choice groups
such as Base as radios, multi-choice groups such as Extra toppings as toggle chips showing
their surcharges. Running unit price, a quantity stepper (1–20), a 200-character note for
the kitchen, and an Add button that stays disabled until every required group is answered.
Adding keeps the customer on the page and raises an "Added · View basket" toast.

**Where:** `/menu/<category>/<product>`.

**Limits.** Required choices are pre-selected to the first option (tomato base), so a
customer can add without consciously picking — the ticket says they chose it, and strictly
they did not. Only two option groups exist in the data: Base (three choices, pick exactly
one) and Extra toppings (sixteen choices, pick up to eight). Both apply to the 30 pizzas
only — the other 38 products carry sizes and nothing else. There is no half-and-half, no
remove-a-topping and no build-your-own screen (the nav link for it is deliberately held
back — see *Not built yet*). Kitchen notes are free text, printed as typed, and nothing
checks them against allergens. 10 of the 68 products have no allergen data recorded.

## Meal deal builder — **Built**

Eight configured deals with their fixed price and contents. The builder walks the customer
through each slot in turn ("10-inch pizza, 1 of 2", garlic bread, a can of drink), letting
them pick the product and then its size and options, with a ruled checklist of what is
chosen and what is left, a running total that adds any paid extras on top of the deal
price, and a pinned bottom bar that stays disabled until every slot is filled. The server
re-validates the whole deal on every reprice — allowed products, allowed sizes, sold-out
status, day-of-week and fulfilment restrictions — before it can be paid for.

**Where:** `/deals` and `/deals/<deal>`.

**Limits.** What is inside a deal — the slots, the qualifying products and sizes, the days
it runs — lives in `config/farm-pizza/menu.json` and only reaches the site through a
re-seed; the admin screen can change the price, Active and Featured and nothing else. Every
active deal shows every day: the day-of-week restriction is only enforced at basket
pricing, so a Tuesday-only deal would advertise all week and then fail in the basket. No
deal is day-restricted today, so that is latent rather than live. The day check uses the
web server's clock rather than the shop's Europe/London time, which matters because the
shop trades to 02:00 and 03:00. `DealSlot.extraPerModifier` exists in the database but is
read nowhere — extras inside a deal are always charged on top. The deal detail page shell
is still on the old styling.

## Basket, with server-side repricing — **Built**

The basket lives in the browser but is re-priced on the server every time a line, quantity,
postcode, order mode or promo code changes. The server rebuilds every line from the live
menu — product still exists, not sold out, chosen size exists, option groups satisfy their
minimum and maximum picks — applies the delivery fee and any promo, enforces the minimum
order, and drops anything that no longer resolves with a plain-English message. Prices held
in the browser are a cached copy the server overwrites; a price sent from the client is
never trusted. Checkout stays disabled until the server says the basket is clean.

**Where:** `/basket`, the header basket button, and the sticky bar at the bottom of every
page on a phone.

**Limits.** No automated tests cover the pricing engine at all, even though every pound the
business takes runs through `lib/pricing.ts`. The basket is stored in that browser's local
storage (`lf-basket`), so it does not follow a customer from phone to laptop and is lost if
they clear their browser. Hard caps: 50 lines per basket, 20 of any one item, 200 characters
of item note, 30 modifiers per line — the note is capped by the input itself and rejected
outright by the server above 200, not silently trimmed. There is no stock control: "sold
out" is a manual toggle and nothing decrements as orders come in. One promo code per order.
`ModifierGroup.required` is written into the database by the seeder and read by nothing —
the pricing engine decides what is compulsory from `minSelect` instead, so the two columns
can disagree with no visible effect.

## Basket upsells — **Partial**

A "Goes well with" strip under the basket items showing cheap add-ons that are not already
in the basket and not sold out, each with a price and a link to the product page.

**Where:** `/basket`.

**Limits.** The categories it will ever suggest from are hard-coded in the route:
`drinks, sides, desserts, dips, extras`. Farm Pizza's starters, chicken and pasta can never
be upsold, and a shop that names its drinks category anything else gets no upsells at all
with no error to say so. The picks are simply the first three products of each matching
category in menu order — not best sellers, and not related to what is in the basket,
despite the heading. Maximum six suggestions. The card tries to show a product description
the endpoint never sends, so that line never appears. Suggestions link to the product page
rather than adding in one tap. No admin control over any of it.

## Checkout — **Built**

One page in four ruled sections. **How:** delivery with address and postcode, or
collection. **When:** as soon as possible, or a 15-minute pre-order slot for today or
tomorrow. **Who:** name, mobile, optional email, marketing opt-in tick box. **Pay:** card,
Apple Pay or Google Pay through Stripe's own payment element on a second step, or cash
where the config allows it. Guests can order without an account; a signed-in customer's
name, phone, email and last address are pre-filled. When the shop is closed or paused the
ASAP option disappears and a slot must be chosen.

The server re-validates everything from scratch: re-prices the basket, re-checks the
postcode is delivered to, normalises the mobile to UK international format, refuses
fulfilment methods the shop does not offer, refuses cash where it is not allowed, refuses
ASAP when the shop is closed or paused, and refuses a booked slot in the past. It then
finds or creates the customer by phone number, saves the address to their address book, and
writes the order with a running order number, every line, every option and the original
basket line kept for reorder.

**Where:** `/checkout`.

**Limits — read these before demoing.**

- **The delivery line quotes the wrong fee for the outer band.** The note under the address
  reads `price.location.deliveryFee` / `minOrder`, which are the shop's headline figures
  (£1.99 / £9.99). The summary beside it correctly charges the band. A Chafford Hundred or
  West Thurrock customer (RM16, RM20) therefore reads "£1.99 delivery, £9.99 minimum" while
  being charged £3.49 with a £14.99 minimum. The same line's "about 35 min" ignores the
  band's extra 15 minutes.
- **Card payment is not live.** `payments.stripeAccountId` is empty in the config, and card
  only appears at all if Stripe keys are set in the server environment. Cash on delivery is
  switched off in config, so as things stand the only working payment route is cash on
  collection.
- The address is free text — no Royal Mail lookup, no house-number validation. The only
  checks are that line 1 has at least two characters and the postcode falls in a
  delivered-to district.
- The order row and its items are written one at a time rather than in a single
  transaction, so a crash mid-write can leave an order with items missing.
- Customers are identified by mobile number, so a household sharing one phone becomes one
  customer record with merged history.
- No tip, no saved cards, no cutlery or structured allergy question — just a free-text order
  note capped at 300 characters. Pre-order slots cover today and tomorrow only.
- The checkout only checks a booked time is at least 10 minutes away; it never re-checks
  the slot against opening hours, so a hand-built request could book 4am.

## Card payment and cash — **Built**

For card orders the server creates a Stripe payment for the price it calculated itself,
with a repeat-safe idempotency key so a double-tap cannot create two charges. A signed
Stripe webhook marks the payment succeeded, saves the receipt link and moves the order to
placed. If the webhook is delayed, the tracking page checks with Stripe itself and completes
the order. Failed payments and refunds coming back from Stripe are recorded against the
order. Cash orders skip all of it and go straight to placed, marked awaiting cash. With
Stripe unconfigured, card is refused with a message telling the customer to pay cash or ring
the shop.

**Where:** the pay step on `/checkout`, the receipt link on `/order/<id>`, the PAID/CASH
column on `/kitchen`.

**Limits.** With `stripeAccountId` empty, card money would land in whichever Stripe account
the platform's secret key belongs to, not an account owned by the shop — payouts would be a
manual arrangement until that is filled in. Everything depends on environment variables;
with no `STRIPE_WEBHOOK_SECRET` the webhook rejects every message and orders are only
rescued when the customer lands back on the tracking page. There is no refund button
anywhere and no partial refunds — an automatic full refund happens only when the kitchen
rejects an already-paid order, and cancelling an order never refunds it. Cash orders have no
"cash collected" step in any screen, although the database has a status for it. The webhook
does not check which Stripe account an event came from. `PROGRESS.md` records that Stripe
success, decline and refund were checked by hand; no automated test covers any of it.

## Postcode check and banded delivery charges — **Verified**

A customer types a postcode and is told whether it is delivered to, which shop will cook it,
the actual fee and minimum spend for that postcode, and the estimated time. Matching is on
the outward code: an exact district match wins, and a letters-only prefix like `RM` covers a
whole area. On top of that each shop carries charge bands — named areas with their own fee,
own minimum and extra minutes — and a band naming a district always beats a broader band
that merely contains it. Anywhere no band names falls back to the shop's standard fee. The
quoted price and the price charged at checkout come from the same function, and the extra
minutes feed the delivery time promised when the kitchen accepts.

Farm Pizza's live bands: **Grays & Little Thurrock** (RM17) £1.99 / £9.99 minimum / +0 min;
**Chafford & West Thurrock** (RM16, RM20) £3.49 / £14.99 minimum / +15 min. Everything else
in RM15–RM20 falls back to £1.99 / £9.99.

**Where:** the check box on the town landing page (`/pizza-delivery-grays`); the same rules
run behind `/basket`, `/checkout` and the admin **Delivery zones** screen.

**Limits.** Band precedence, fee and minimum inheritance and outward-code matching are
covered by passing unit tests; the customer-facing form itself is not. The check box appears
**only** on the town landing page — not on the home page, the menu or the header — so most
customers never see it until checkout. Matching is by postcode prefix only: no distance, no
drive time, no drawn map, so a house at the far edge of a district pays the same as one next
door to the shop, and a shop that delivers to half a district cannot say so. If two shops
ever list the same district, the one with the lower sort order silently takes every order
from it.

## Live order tracker — **Built**

After ordering, the customer lands on a tracker showing the status headline, the estimated
delivery or collection time, and a five-step progress rule (Received, Accepted, In the oven,
On its way / Ready, Done) that updates itself without a refresh as the kitchen moves the
order along, closing itself once the order is done, rejected or cancelled. Below it: the
delivery address or collection shop, the itemised order with modifiers, deal contents and
notes, the totals, and whether it is paid or cash. Rejection shows the reason. Texts go out
on placed, accepted, ready, out for delivery and rejected, plus an email receipt if an email
was given.

**Where:** `/order/<id>`, reached after checkout, from the confirmation text, and from the
account order list.

**Limits.** **There is no login check on this page or on the order APIs behind it.** Anyone
holding the link can see the customer's name, phone number and full delivery address, and
can rebuild their basket via the reorder endpoint. The link contains a long random id and
the page is `noindex`, but the link itself is the only lock — a forwarded link is a
forwarded address. The live connection re-queries the database every three seconds per
viewer, so a busy Friday with a few dozen tracking pages open is a few dozen queries a
second; `PROGRESS.md` still lists a true live queue as outstanding. There is no driver map
and no live location — "On its way" is the last step before done. The customer cannot cancel
or change an order; the page shows the shop's phone number. Every text depends on Twilio
credentials being set — without them the message is written to the server log, the send is
recorded as successful, and the customer gets nothing.

## Customer account, SMS login and reorder — **Built**

Login is a six-digit code texted to the customer's mobile — no password. Once in, they see
their name and number, their last 20 orders with items, status and total, buttons to view or
reorder each one, their saved addresses, and the referral panel. Reorder rebuilds the basket
from the stored order, re-checking every line against today's menu and prices and telling
the customer about anything that has changed or gone.

**Where:** `/account`, and the Order again buttons on `/account` and `/order/<id>`.

**Limits.** Login needs Twilio to be live; without it the code is only printed to the server
log (and, outside production, shown on screen), so nobody can log in on a live site with SMS
unconfigured. Limits are 3 codes per 10 minutes, 5 wrong attempts, 10-minute expiry, 90-day
session. History is capped at 20 orders with no paging or date search. Saved addresses are
display-only — there is a delete endpoint but no button calls it, and there is no way to
add, edit or set a default address. The customer cannot change their name or email or delete
their account from the site; the privacy page tells them to contact the shop. The reorder
endpoint is not access-checked. Reorder always prices the rebuilt basket as collection, so a
delivery-only deal is silently dropped from a reorder even when the customer is reordering
for delivery.

## The storefront itself — **Built**

Every page runs inside one shell: sticky header with the shop's real logo, Menu / Deals /
Shops / Account links, a delivery-or-collection switch and a basket button showing count and
total; a footer with address, tap-to-call number, ordering links, town links and info links;
and a sticky bottom checkout bar on phones once the basket has something in it. Brand
colour, secondary colour, logo, hero image, tagline and whether food photography is colour
or black-and-white all come from the shop's config, with the button text colour calculated
for contrast. Layouts collapse at 1000px, 700px and 440px.

**Where:** every storefront page.

**Limits.** The home page copy is written into the code, not config: "Real pizza. From a
real farm.", "Order tonight. Eat tonight." and the "N pizzas. No filler." heading all need a
developer to change. The home page's headline numbers — average delivery time, cheapest
pizza price and the Open / Pre-order tile — are read from the first branch only, which is
correct today with one shop but wrong the moment a second is added. The nav deliberately
omits Build your own and Crust Club because neither screen is finished. The two mobile
breakpoints were added on top of a desktop-only design handoff and were validated by
automated audits, not by a designer. Automated performance and SEO checks run against the
home page and menu only.

## Shops page — **Partial**

The shop with name, address, tap-to-call phone, delivery fee, an Open (with closing time) or
Closed tag worked out live from that shop's hours and timezone, collection and delivery time
estimates, and an Order from here button, alongside a details panel and a full seven-day
opening hours table.

**Where:** `/shops`.

**Limits.** The map is a deliberate placeholder — a drawn CSS grid with evenly spaced
markers in made-up positions. A real map needs a paid map provider key. The heading is
hard-coded "in Essex", so the page cannot be reused for a shop elsewhere without a code
change. The fee and minimum shown are the headline figures, not the banded ones, so an RM16
or RM20 customer reading this page sees £1.99 / £9.99 rather than the £3.49 / £14.99 they
will be charged. Past-midnight hours are handled correctly and are covered by unit tests.

## Allergens, contact and legal pages — **Built**

An allergen page listing every product with its allergens and diet tags in one table, each
row linking to the item, under a warning that the kitchen handles all fourteen major
allergens. A contact page with the shop's phone, address, live open state, full hours and
the postcodes delivered to. Privacy and terms pages written from the shop's config.

**Where:** `/allergens`, `/contact`, `/privacy`, `/terms`.

**Limits.** The allergen table is only as good as the data entered — 10 of 68 products have
no allergens listed and show a dash, which reads as "no allergens" rather than "not
recorded". There is no allergen filter on the menu and no admin screen for allergen data; it
is edited in `menu.json` and re-seeded. The privacy and terms pages are template wording
with the shop's name and phone dropped in — not reviewed by a solicitor, and they commit the
business to things it must actually honour (six-year retention, no advertising trackers,
refund within 24 hours). The privacy page tells customers they can opt out of marketing
"from your account page"; there is no such control on the account page — only replying STOP
to a text works. The email address in config is blank, so the contact page shows a phone
number only.

---

# 2. Running the shop

## Kitchen queue — **Built**

A four-column ticket board — New / In the oven / Ready / Out for delivery — that polls every
five seconds, beeps on a new order and nags every 20 seconds while anything is unaccepted.
Each ticket shows items with sizes, options, deal components and customer notes, payment
state, the customer's phone as a tap-to-call link, the delivery address, and a
minutes-waiting timer that turns accent past 20 minutes. Accepting picks an ETA (defaulted
from the shop's prep or delivery minutes plus any band extra; pre-orders default to the
booked slot) and moves the order on; rejecting takes a reason from a fixed list of five and,
if the order was paid by card, triggers a Stripe refund. Shop pause and sign-out sit on the
same header. Every step writes an order event recording who did it, and texts or emails the
customer.

**Where:** `/kitchen`, linked from the admin sidebar as Kitchen queue.

**Limits — the important one first.** **All three kitchen alerts are empty in the live
config.** `kitchenEmail`, `kitchenSms` and `printerWebhook` are all `""`, so today a new
order appears on this screen and nowhere else. If the tablet is asleep or the tab is closed,
nobody is told. There is no push notification and no separate app. Sound needs a manual
"Enable sound" tap after every page load because of browser autoplay rules. The board polls
rather than pushes, so a ticket can sit up to five seconds before appearing. It is one
shared queue and does not filter by shop, so a second branch's tickets would land in the
same columns. Once past "placed" there is no undo, no way to edit a ticket's items and no
re-print. Cancelling is accepted by the API but there is no cancel button on the screen, and
a cancel never refunds a paid order. The ETA is a fixed number of minutes with no queue or
capacity awareness, so the fortieth order of a Friday night is promised the same wait as the
first. Kitchen API routes authorise on the kitchen or admin cookie, not the role matrix.

## Order lifecycle and customer notifications — **Built**

An order moves through a fixed set of steps — awaiting payment, received, accepted, being
prepared, ready, out for delivery, completed, or rejected / cancelled — and illegal jumps
are refused. Every step is written to an append-only event log with who did it. Each step
can text the customer; the customer also gets an email confirmation; rejecting a paid order
refunds it automatically; and a review-request text goes out 45 minutes after completion.

**Limits.** If Twilio or Resend credentials are missing, sends are logged as dry runs and
recorded in the order timeline as successful — the shop cannot tell a real text from a
skipped one. The shop-alert channels are unset (above). Drivers are not part of the order's
lifecycle at all.

## Order history, search and export — **Built**

A paged list (50 per page) of every order except unpaid baskets, filterable by status and
date range, with a free-text search across customer name, phone and delivery postcode. Each
row shows order number, timestamp, customer and phone, fulfilment and payment method, shop,
status and total. **Export CSV** returns up to 5,000 orders with 17 columns including
payment status, itemised contents, subtotal, delivery fee, discount, promo code and total.

**Where:** `/admin/orders`.

**Limits.** Read-only. There is no back-office order detail page, no way to amend an order,
add a note, issue a partial refund or resend a receipt. The order number links out to the
public customer tracker, which needs no login. The CSV endpoint authorises on the presence
of an admin cookie alone, bypassing the role matrix — a kitchen-only PIN can download every
customer's name, phone, email and postcode even though the Orders screen is hidden from that
role. The 5,000-row cap truncates silently. Phone search does not normalise formatting, so
"07700 900 201" and "+447700900201" will not find each other. Date filtering uses
`createdAt` while the money figures elsewhere use `placedAt`.

## Menu prices and availability — **Built**

Every category and product in sort order with inline editing: name and description saved
together, each size's price edited in pounds and stored as pence, and one-tap toggles for
sold out, featured and hide/show. Up/down arrows reorder a product within its category.
Below, each option group lists its modifiers as pills that toggle sold out. Every save busts
the menu cache so the storefront updates immediately.

**Where:** `/admin/menu`.

**Limits.** Editing only. You cannot add or delete a product, category, size, option group
or option, upload or change a photo, or set allergen information — all of that lives in
`config/farm-pizza/menu.json` and needs a developer re-seed. The screen says so on itself.
Prices are one size at a time with a separate Save button each, so a menu-wide increase is
dozens of clicks; there is no bulk edit, no scheduled price change and no history of who
changed what. The sold-out toggle reads then writes without a transaction, so two people
tapping it at once can cancel each other out. There is no per-shop pricing or per-shop
availability — a sold-out toggle applies to every branch. Sold-out state is permanent until
someone unticks it; nothing clears it overnight.

## Meal deals — **Built**

Lists every configured deal with its slot make-up ("2 × Large pizza + 1 × Side") and lets
the owner set the price in pounds, tick Active, and tick Featured on home.

**Where:** `/admin/deals`.

**Limits.** Price, active and featured are the only three fields. What is in a deal cannot
be changed, added to or removed here, and a new deal cannot be created or an old one
deleted. No day-of-week or time-of-day restriction, no start/end date, no per-shop deal, no
reordering. Featured has no limit, so every deal can be featured at once.

## Opening hours and emergency pause — **Verified**

Per shop, a Monday-to-Sunday grid of one open and one close time each, saved as a single
transaction; blank means closed, and closing after midnight (11:00 to 02:00, as this shop
does) is handled correctly in the shop's own timezone. Separately, a pause control takes the
shop off-line for a set number of minutes with a reason shown to customers, plus Resume.
When the shop is shut or paused, customers are offered pre-order
slots instead — 15-minute steps for today and tomorrow, starting after prep time plus 15
minutes and stopping 15 minutes before close.

**Where:** `/admin/hours`; the pause buttons also sit on the `/kitchen` header; the effect
shows in the header pill and the checkout time picker.

**Limits.** The underlying open/closed, next-opening and slot logic is covered by passing
unit tests; the admin form is not. **One range per day only** — the database and the
storefront can both display a lunch/dinner split, but the form deletes all rows and writes
at most one per day, so a shop that shuts between services cannot express it here. Times
that fail the `HH:MM` check are silently dropped, so a typo saves as "closed" with no error.
There are no bank-holiday or one-off closure dates — Christmas Day means editing the weekly
grid and remembering to put it back. **The two pause controls do not agree with each
other.** `/admin/hours` offers 15, 30, 60 minutes or "Pause today" (1,440 minutes); the
kitchen header offers 15, 30, 60 or "Rest of day" — and "Rest of day" there is a flat **240
minutes**, not the rest of the day. Pause at 19:00 from the kitchen screen and the shop
reopens itself at 23:00 while staff have gone home. The API caps a pause at 1,440 minutes
and the reason at 80 characters; the admin action caps neither. Nothing warns you that a
pause is still on except the pill on this screen and the kitchen header.

## Delivery zones — **Verified**

Per shop: the districts delivered to (comma separated, letters-only entries like `RM`
covering a whole area), the standard delivery fee, minimum order, collection and delivery
times, address and phone. Under that, charge bands for the parts of the patch that cost more
to reach — name, districts, fee, minimum order, extra minutes — added, edited inline and
removed. Every band write is scoped through the location's own client id.

**Where:** `/admin/zones`.

**Limits.** Postcode districts only — no map, no radius, no drive-time, no polygon. Bands
cannot be reordered in the UI even though ties between equally specific area bands are
broken by sort order. Remove deletes immediately with no confirmation and no undo. The
shop's address and phone are edited inside the delivery form, which is a confusing place for
them. There is no per-band delivery cap and no free-delivery-over threshold. **And the sharp
one:** bands edited here are written to the database only, while the seeder deletes and
recreates every band from config on every container start — see *Seeding* below.

## Dispatch and drivers — **Partial**

A driver table (name, vehicle, status, current order number, expected back-at time) with a
one-click toggle between available and off shift, beside a "Ready to go" panel listing
delivery orders that are ready or preparing, each with items, total, minutes waited and a
dropdown to assign a free driver.

**Where:** `/admin/dispatch`.

**Limits.** The map is a drawn placeholder — the grid is CSS, the shop marker is at a fixed
position and driver pins are placed by their index in the list, so they carry no real
location. There is no GPS, no route and no live tracking; the panel labels itself a
placeholder. **Assigning a driver does not touch the order at all:** the order stays "ready"
until someone marks it out for delivery on the kitchen screen, and nothing tells the driver
— no SMS, no app, no job sheet. "Back at" is hard-coded to now + 30 minutes regardless of
distance. The assign action does not check the chosen driver is free, so a posted form can
double-book someone already out. The Ready-to-go list also includes orders still preparing,
so food that is not cooked yet looks dispatchable. Drivers cannot be added, renamed or
removed here — they come from `config/farm-pizza/ops.json` and need a re-seed, and the four
current drivers are sample data with `07700 9002xx` placeholder numbers.

## Inventory — **Partial**

Stock lines with on-hand, par, a level bar, supplier and an Out / Below par / In stock tag,
over four counters. **Reorder** flags one line as on order; **Reorder everything below par**
flags every line under par at once.

**Where:** `/admin/inventory`.

**Limits.** **Nothing anywhere decrements stock when food is sold.** The only writes to a
stock item in the whole codebase are the seed, the on-order flag and a receive function —
on-hand numbers only ever change if a developer re-seeds. The page admits reordering "does
not yet message the supplier"; it just sets a boolean. The receive function exists in the
actions file but no page imports it, so once a line is marked On order there is no way in
the UI to book the delivery in or clear the flag. You cannot add a stock line, change
on-hand, par, unit or supplier, or delete a line — all 16 lines come from `ops.json`, need a
re-seed, and are sample data ("Marsh Mill", "Marsh Dairy"). No cost prices, no wastage, no
supplier contact details, and no link between a stock line and the menu items that use it.

## Dashboard — **Built**

Four live counters — today's takings and order count, orders currently live in the kitchen,
average order value over seven days, and the number of customers who have ever ordered —
over a table of the ten most recent orders. A header dot shows whether the shop is taking
orders, paused or closed, with a shortcut to Hours & pause.

**Where:** `/admin`.

**Limits.** Fixed to today and the last seven days — no date picker, no comparison with last
week, no breakdown by shop or by delivery versus collection, no top-selling items. The
open/closed dot reflects the first branch only. Order numbers link to the public tracker,
which needs no login. Cancelled, rejected and unpaid orders are excluded from the money
figures, but "Live in the kitchen" counts every open status including ones nobody has
accepted.

---

# 3. Marketing

## Promotion codes — **Built**

A code entered in the basket is validated on the server against the shop's promo records:
percentage off, fixed pounds off, or free delivery; with rules for minimum spend, end date,
delivery-only or collection-only, a maximum number of redemptions, first-order-only, and
codes minted for one named customer that nobody else can spend. Any failure gives the
specific reason ("Spend £15.00 to use this code", "This code has expired", "That code was
issued to someone else"). A redemption is counted when the order is placed, and the code is
stored on the order so takings can be attributed. Codes are created and enabled or disabled
from the admin, and a public list of active codes shows on the deals page with a one-tap
Apply to basket.

**Where:** the promo box in `/basket` and the checkout summary; the Codes list on `/deals`;
`/admin/promos`.

**Limits.**

- **Re-saving a code silently re-enables it.** The upsert hard-codes `active: true` on both
  create and update, and the create form is the only way to edit, so there is no way to
  change a code's value without switching a disabled one back on. There is no delete, only
  disable.
- The basket pricing endpoint never sends the customer's phone number, which causes two
  visible problems: a first-order-only code looks valid in the basket to a returning
  customer and is only refused when they press Pay; and a personal reward code shows its
  rightful owner "That code was issued to someone else" all the way through the basket and
  checkout summary, right up until the order is submitted.
- The public Codes list on `/deals` shows every promo marked active with no filter for
  expiry or ownership — so the one-off `THANKS-XXXXX` reward codes minted for individual
  customers by the referral scheme are listed publicly, and so are codes whose end date has
  passed. Nobody else can spend a personal code, but it should not be on display.
- The redemption count is checked at pricing but only incremented when the order is placed,
  so two people paying at the same second can both use the last use of a one-use code.
- No day-of-week rule exists at all, so a code named `TUESDAY20` works every day.
- The admin form has no start date, cannot mint a code for a named customer, allows only one
  fulfilment restriction, and does not pre-fill from the table — editing means retyping every
  field, and typing an existing code overwrites its rules with no warning.
- One code per order, no stacking, no automatic offers, no BOGOF, no restriction by product,
  category, shop or day. Percentage discounts come off the food subtotal only, so even a
  100% code leaves delivery payable.

## Customer list and segments — **Built**

A searchable list of everyone who has ordered — name, email, phone, lifetime orders,
lifetime spend, last order date, marketing opt-in tag — sorted by most recent order. Nine
one-click segments: everyone opted in, ordered in 30 days, lapsed 60+, lapsed 120+,
one-timers, regulars (5+ orders), big spenders (£250+ lifetime), Grays area (RM) and
Basildon area (SS), each with its opted-in headcount and a link through to message that
group.

**Where:** `/admin/customers`; the same segments drive the campaign composer.

**Limits.** Completely read-only — no way to correct a misspelt name or wrong number, merge
two records for the same person, add a note, block a nuisance customer, or opt someone out
on their behalf when they ask in the shop. There is no individual customer page. The list
shows the 200 most recent with no pagination and no export. Every threshold is hard-coded in
source: 30/60/120 days, 5 orders, £250. The two geographic segments are Farm Pizza's own
postcodes baked into a white-label platform — a second tenant inherits segments labelled
"Grays area" and "Basildon area" that mean nothing to them, and the Basildon one now matches
nothing because the SS branch has been removed from config. Both match on the last postcode
used, which is only written on delivery orders, so collection-only customers never appear in
either. The customers screen counts segments with opt-in but without the "has a phone
number" filter the campaign screen uses, so the two screens can show different numbers for
the same segment.

## One-off campaigns — **Built**

Pick a channel (SMS at 4p each, or email), a segment with its live headcount, an offer code
and a message using `{name}` / `{shop}` / `{code}` merge fields, and send immediately. Only
marketing opt-ins with a usable phone or email are included. Every recipient gets a send
record carrying the offer code, so redemptions and revenue attach back to that campaign.
Codes the audience cannot possibly use — a first-order-only code sent to existing customers,
a collection-only code, a high minimum basket — are flagged in plain English before sending.
The last 20 campaigns show sent, failed, redeeming orders, message cost and revenue earned,
and a sidebar prices each segment up front.

**Where:** `/admin/campaigns`.

**Limits.**

- **Campaign sends are mis-filed.** The send rows are created without setting `kind`, and
  the database default is `"automation"`, so on the marketing screen's "Where the money
  went" table every one-off campaign is counted under Automations and the Campaigns row can
  never appear. Per-campaign figures on the campaigns screen itself are correct.
- Send fires immediately with no confirmation dialog, no test-send-to-myself and no
  recipient preview — one click can text 2,000 people.
- It sends synchronously inside a server action, one message at a time, with the sent/failed
  counters written only after the loop finishes. A few hundred recipients will outlive the
  request timeout, leaving a campaign showing 0/0 with the messages already gone.
- The 2,000 cap is silent; a larger segment is quietly truncated.
- With Twilio or Resend credentials missing, sends return success — so the campaign records
  every message as sent and charges 4p each against reported spend even though nothing left
  the building. The agency screen is the only place that says you are in dry-run.
- The 4p per SMS is a hard-coded constant, counted per recipient rather than per 160-character
  segment, so a long message costs Twilio two segments and is reported as one.
- Campaigns ignore the contact cooldown that automations respect, so a campaign can land on
  someone texted yesterday. No scheduling, no drafts, no cancel, no resend, no delete.
- **Marketing emails carry no unsubscribe link of any kind** and there is no email opt-out
  path anywhere in the codebase. Only SMS gets the STOP line. That is a legal problem for
  marketing email in the UK.

## Marketing automations — **Partial**

Rules that fire on their own: win back a lapsed customer (45 days), nudge a one-timer,
thank a new customer, fill a quiet night, and chase an abandoned checkout. Each carries a
days threshold, a do-not-contact cooldown, a per-run cap and an offer code, and new ones
always save paused. Three safety rules are enforced on every audience: the customer must be
opted in and have a phone number, must not have received *any* marketing send — including
review requests and referral texts — inside the cooldown window, and the batch is capped
(hard ceiling 1,000). The table shows how many people are waiting, sent, redeeming orders,
spend and revenue per rule, with Pause / Turn on and a "Send N · £x.xx now" button.

**Where:** `/admin/marketing`. Scheduled runs go through
`GET|POST /api/cron/automations` with a `CRON_SECRET` bearer token.

**Limits.**

- **Nothing in this repository schedules them.** The Coolify runbook tells the operator to
  schedule only `/api/cron/review-requests`. On a live deploy the rules fire only when
  someone presses Send now, unless the operator reads the README and adds a second job. The
  endpoint 401s until `CRON_SECRET` is set.
- The **Birthday treat** trigger appears in the dropdown but its audience query is hard-wired
  to match nothing, and there is no date-of-birth column anywhere. It can never send.
- The save action hard-codes the channel to SMS, so the email option shown in the trigger
  list cannot be reached.
- It upserts on the automation's **name**, so editing means retyping the form with a
  byte-identical name — a typo silently creates a second automation. There is no delete; a
  rule can only be paused.
- Send now fires with no confirmation and works on paused automations, so one click can text
  up to 1,000 people.
- The waiting count runs a query of up to 1,000 customer rows per automation on every page
  load.
- The five seeded automations and their message copy come from `ops.json`. Three of them
  point at `COMEBACK15`, one at `FREEDEL`, and **Thank a new customer ships with no code at
  all**, so its earnings will always read zero.

## Abandoned-checkout recovery — **Built**

Runs off unpaid orders rather than the customer list: orders still awaiting payment, created
between 25 and 110 minutes ago, with no recovery yet requested and an opted-in customer with
a phone. Each gets one SMS with the promo code, and the order is stamped *before* the send so
a mid-send crash cannot cause a second chase. The 110-minute ceiling sits deliberately inside
the two-hour sweep that cancels stale unpaid orders.

**Limits.** The 25-minute delay and 110-minute window are module constants, not settings, and
this path ignores the automation's own days and cooldown fields entirely. It reaches only
customers who ticked the marketing box at checkout, and **that box is unticked by default**,
so most abandoned baskets are never chased. Cash orders never enter the awaiting-payment
state, so only failed card checkouts are recoverable — and card is not live for this tenant.
Unlike every other automation it ignores the shared contact cooldown, though it then blocks
the others for the cooldown period. It always sends SMS regardless of the channel field but
computes cost from that field. And like the other automations, without a cron job it is
effectively manual.

## Attribution and marketing P&L — **Built**

Every message the shop pays for records its promo code and cost. When an order is placed, the
most recent unredeemed send of that same code to that same customer is stamped with the order
id and total, so revenue is measured rather than modelled. That feeds the marketing
dashboard: earned, spent, net, a breakdown by message kind, per-automation sent / orders /
spend / earned, and per-campaign columns. A "commission saved" tile estimates what an
aggregator would have taken on this month's direct orders.

**Where:** `/admin/marketing` and `/admin/campaigns`.

**Limits.** Attribution only works when a message carries an offer code, and both composers
offer a "No code (not measurable)" option. Revenue is credited as the whole order total, not
margin and not incremental value, so a customer who would have ordered anyway counts as pure
marketing revenue; "Net" is revenue minus message cost only — the food still has to be made.
Match is on customer plus code, so a customer texted the same code twice has the older send
credited first. Attribution runs only when an order reaches placed. The "commission saved"
headline applies a hard-coded **14%** to all non-cancelled direct revenue this month
including orders the shop would have taken by phone anyway — it is labelled an estimate on
screen, and it is the largest number on the page. The campaign `kind` defect above corrupts
the per-kind breakdown. Dry-run sending inflates both send counts and spend. The demo-data
script writes around 120 fake sends with a ~14% redemption rate, so a demo database shows
convincing but entirely synthetic marketing figures.

## Refer a friend — **Built**

A complete loop. A logged-in customer gets a readable code of their own ("DAVE-7K2Q", built
from an unambiguous alphabet with no O/0 or I/1 so it survives being read out) minted the
first time they open their account page, with a share panel showing what both sides get, a
Copy button and a native share sheet. The short link `/r/CODE` stores the code in a 30-day
cookie and drops the friend on the menu; the basket then fills the code in automatically. The
friend's discount is priced through exactly the same rules as any promo, so minimums and
error messages behave identically, and self-referral is blocked. The introducer is recorded on
the friend's record on their first order. Once that first order is actually paid for, the
referrer is minted a single-use `THANKS-XXXXX` code bound to them with a 90-day expiry and
texted it.

**Where:** the Refer a friend panel on `/account`; the share link `/r/<code>`; the "Word of
mouth" panel on `/admin/marketing`.

**Live settings:** on, £5 to the friend, £5 back to the referrer, £15 minimum both sides,
reward valid 90 days.

**Limits.** All five settings live in `client.json` with no admin screen — changing them needs
a developer and a re-seed or an agency reload. Codes are minted only when a customer opens
`/account`, which requires an SMS login, so a guest who has ordered five times and never
logged in has no code to share. The referrer's reward arrives by text only, so it depends on
Twilio; with credentials missing the send is logged as a dry run and reported successful, so
the code is created and marked sent while nobody is told. Every minted reward is a normal
active promo row, so they pile up in `/admin/promos` and appear in the offer-code dropdowns on
the campaigns and marketing screens, where picking one would send a code only one named person
can use — and they show in the public codes list on `/deals`. The referrer's own reward reads
"issued to someone else" in their basket until they submit the order. The reward text is
hard-coded English. Customers are identified by phone number, so the same person on a second
number is a new customer and gets paid for; there is no cap on referrals and no other fraud
checks. **Nothing anywhere else on the site mentions the scheme** — no home page banner, no
prompt after ordering, no footer link. The admin panel is three read-only numbers.

## Review requests — **Built**

A cron endpoint finds completed orders older than the configured delay (45 minutes here) that
have not yet been asked, stamps the order first, then texts the customer a link to the shop's
Google Maps review page. Each is logged as a paid send, which puts the true SMS bill in the
marketing breakdown and stops a win-back text landing on the same person the same afternoon.
The same pass also cancels unpaid orders older than two hours.

**Where:** `GET /api/cron/review-requests` with a `CRON_SECRET` bearer token; manual trigger
on `/admin/launchflow`.

**Limits.** It deliberately ignores the marketing opt-in — a customer who has texted STOP
still receives it, and soliciting a Google review is arguably marketing under PECR. That is a
decision the owner should make consciously, and there is no setting to turn it off short of
blanking the review URL in config. The delay and destination URL are config-file values with
no admin screen, and the wording is hard-coded English. Batch is 50 per run, one at a time.
There is no per-customer frequency cap beyond one per order, so three orders in a week means
three requests.

## Reviews screen — **Partial**

Average rating over a 1–5 star distribution chart with an "awaiting a reply" count, beside
the 50 most recent reviews — customer, stars, body, source and date — with an inline reply box
on anything unanswered.

**Where:** `/admin/reviews`.

**Limits.** **Nothing creates a review except the seed.** There is no customer review form on
the storefront and no Google Business import, so the eight reviews on screen are sample data
and the list will never grow on its own. The "Google" source is a text label on a seeded row,
not a connection. A reply is written to the local database and posted nowhere — the customer
is not told and Google never sees it — and once saved it cannot be edited or removed. The
average and star breakdown are computed from the 50 rows loaded on the page, so both become
wrong past 50 reviews. No delete, hide, flag, filter or notification. Review-request texts do
go out, but their replies never come back into this screen.

## SMS opt-out (STOP / START) — **Built**

Twilio posts inbound replies to a webhook that refuses outright when the auth token is unset
and otherwise validates Twilio's request signature with a timing-safe compare before doing
anything. Every inbound message is stored whether or not the number is known. The standard UK
keyword lists are matched, but only on the first word and only when the message is one or two
words, so "stop putting olives on it" is not treated as an opt-out. STOP clears the marketing
flag and records when and how, as evidence; START restores it. Both get a confirmation reply.

**Where:** `POST /api/sms/inbound`, set as the number's inbound webhook in Twilio. The effect
shows as the Marketing column on `/admin/customers`.

**Limits.** **Nothing in the back office reads inbound messages.** Every non-keyword reply —
"where is my order", a complaint, "please stop texting me" — is written to the database and
surfaced nowhere: no inbox screen, no unread badge, no alert. The shop will never know they
arrived. There is also no way for the owner to opt someone out or back in by hand from any
screen; the checkout tick box and an inbound text are the only two paths. Opt-out is SMS-only.
The signed URL is rebuilt from the site URL plus pathname and drops any query string, so a
webhook configured with query parameters would fail signature validation. STOP clears
marketing consent only — order texts and review requests still go out. The keyword matcher,
which most deserves a test, has none.

## Local SEO pages and structured data — **Built**

A landing page per town driven by config, with the shop's live open state and ETA, a postcode
checker, the postcodes covered, hand-written local copy from a markdown file, the six most
popular items, opening hours and links to other towns. Across the site: structured data for
Restaurant, full Menu with every item and per-size price and in-stock status, LocalBusiness
with the postcode areas served, FAQ extracted from the town's markdown, and breadcrumbs; a
sitemap covering every category, product, deal and town page; a robots file keeping basket,
checkout, order and account pages out of search; social share images generated per product;
and 301 redirects from the three legacy domains.

**Where:** `/pizza-delivery-grays` (currently the only town page — `seo.locality` lists Grays
alone), `/sitemap.xml`, `/robots.txt`, `/og`.

**Limits.** Adding a town means editing `client.json` and hand-writing a new markdown copy
file — there is no admin screen, and `grays.md` is the only local copy that exists. Each town
is matched to a branch by name; if no branch matches, the page silently falls back to the
first branch's hours, fees and address. The landing page and its popular-item cards still use
the older card styling. The LocalBusiness listing has a `geo` block in the code but the shop
has no `lat`/`lng` in its config, so **no coordinates are actually published** — Google is
given the street address and postcode prefixes and left to work the rest out. **There is no
Google Analytics or Tag Manager wired in anywhere**, no review stars on the site, and no
rating markup even though reviews are stored. The FAQ markup
only appears if the markdown happens to use `###` question headings. Legacy-domain redirects
always land on the home page, so old deep links lose their destination. The sitemap is
regenerated on every request. Price range is hard-coded `££` and reservations hard-coded
`False`. CI enforces a Lighthouse SEO score of 90 on the home and menu pages only; nothing
validates the structured data itself.

## Loyalty — Crust Club — **Off**

Points accrual is wired end to end: when an order is marked completed, points are calculated
from the food subtotal at a configured rate, written to a per-customer ledger with the order
number as the reason, and added to the balance. A customer-facing page shows the balance, a
progress bar to the next reward, a ten-square stamp card and the points history.

**Where:** `/rewards` — which currently returns Not Found, because `loyalty.enabled` is
`false` in the live config.

**Limits — do not present this as a working loyalty scheme.** Turning it on is a config edit
and a redeploy, not an admin toggle. Even switched on, **redemption is not built at all**:
there is no way to spend points, no reward ladder in the database, and the "250 points for a
free medium" threshold and the ten-stamp card are hard-coded constants in the page file with
a comment saying they are placeholders. Points come from the subtotal, so delivery and
discounts are excluded. There is no back-office screen to view, adjust or write off a
customer's points, and no segment or automation can target points holders. Points would start
accruing the moment the flag flipped, creating a liability the shop cannot discharge. **And
the account page shows a Crust Club points card to every logged-in customer regardless of the
switch**, reading `0` under the words "points earned so far. Points accrue on paid orders" —
a statement that is false twice over today: nothing accrues at all, and when it does it
accrues on *completed* orders, not paid ones. Either flip the switch or take that card off
`/account` before anyone sees it.

---

# 4. Running it as a business

## Multi-branch support — **Built**, but exercised by nothing live

Branches are first-class: each carries its own address, phone, timezone, opening hours,
postcode districts, delivery fee, minimum order, prep and delivery times, and its own charge
bands. Delivery orders are routed to the covering branch automatically from the postcode.
Screens that list branches — shops, contact, hours, zones — loop over them.

**Limits.** **The live config has one branch**, so multi-branch is supported rather than
proven. Known single-branch assumptions in the code: the admin dashboard's open/closed dot
reads the first branch only; the home page's headline delivery time, cheapest price and
open/pre-order tile all read the first branch only; the kitchen board is one shared queue
that does not filter by branch. There is no per-branch menu pricing and no per-branch
sold-out — a sold-out toggle applies everywhere. For delivery the branch is chosen for the
customer; they cannot pick which shop cooks it. If two branches list the same district, the
lower sort order silently takes every order from it. One shared kitchen PIN covers the whole
business.

## Staff sign-in — **Built**

One password/PIN field signs a person in three ways: the LaunchFlow agency key, the shop's
shared admin password (treated as manager), or a 4–8 digit staff PIN matched against a hash
on their staff record, which stamps that person's role into the session cookie. A
kitchen-capable PIN also mints the kitchen cookie so a wall tablet does not need a second
login. All cookies are HMAC-signed and verified with Web Crypto so they work in middleware;
keys are compared in constant time and every login path pauses the same 300ms so a wrong PIN
cannot be told from an unknown one.

**Where:** `/admin/login`, `/kitchen/login`; middleware gates every `/admin` and `/kitchen`
path.

**Limits.** No tests. **The sample staff PINs (1111, 2222, 3333 … 8888) are committed to the
repository** in `ops.json`, and the config's own comment says replace them before launch —
but there is no screen to do it. Changing a PIN means editing config *and* deleting the staff
row first, because the seeder only ever writes a PIN when the person is created. There is no
lockout or rate limit on repeated guesses, only the fixed delay, and a 4-digit PIN is 10,000
tries. The stored hash is a plain `SHA-256(clientId:pin)` — one fixed salt for the whole
shop, no per-person salt and no key stretching — so anyone who ever gets a copy of the staff
table can recover every 4-digit PIN in under a second. Staff and kitchen sessions are
stateless signed cookies with fixed lifetimes set in code (agency 4 hours, admin 12 hours,
kitchen 30 days), so marking a staff member inactive does not end a session already issued;
customer sessions are 90 days and *are* database rows. Any session that predates per-person
sign-in, or carries an unrecognised role, silently falls back to full manager access. Outside
production the signing secret falls back to a known development value.

## Roles and permissions — **Built**

One matrix defines five roles — manager, shift lead, kitchen, driver, front of house —
against sixteen back-office screens, and is applied in three places that cannot disagree:
which links appear in the sidebar, which pages open, and which server actions run. Managers
hold everything implicitly. A denied person is redirected to the first screen their role can
open rather than to a wall or a redirect loop. The live matrix is rendered on the staff screen
from the same function that enforces it, so what is shown is genuinely what is enforced.

Current grants: **shift lead** — dashboard, kitchen, orders, dispatch, inventory, hours,
reviews. **kitchen** — kitchen. **driver** — kitchen, dispatch. **front of house** —
dashboard, kitchen, orders. **manager** — everything.

**Limits.** No automated test covers any of it. **The CSV export endpoint bypasses the
matrix**, checking only that an admin cookie exists, so a kitchen-only PIN can download every
customer's name, phone, email and postcode. The `/kitchen` page has no server-side guard of
its own and relies on the middleware redirect, though its data API does check the cookie. The
kitchen APIs authorise on the kitchen or admin cookie, not the matrix. When a role is refused
a screen the person is bounced silently — the redirect sets a `?denied=` parameter that no
page reads. The five roles and their grants are fixed in code: you cannot add a role or grant
one person an extra screen without a developer, and the role list is hard-coded in two places
that must be kept in step. Managers are granted every new screen by default with nobody
reviewing that. Several action handlers update rows by raw id without re-checking the row
belongs to this shop — harmless while each shop has its own database, dangerous if that ever
changes. No password/PIN change screen, no session list, no forced sign-out, and no audit log
of who changed what in the back office (orders do have a full event log).

## Staff roster — **Partial**

Active staff with name, role, hours this week and an on-shift tag; the role is a dropdown
saved per person, and a Clock on / Clock off button flips their shift state. Beside it, the
live permission matrix.

**Where:** `/admin/staff`.

**Limits.** You cannot add a new starter, remove a leaver, or set or reset anyone's PIN here —
staff come from `ops.json` and a developer re-seed. The eight current staff are sample people
with the sequential placeholder PINs above. "Hours this week" is a static number seeded from
that file; clocking on and off never changes it, so the column is decorative. Clock on/off has
no timestamp, no history and no export, so it is not a timesheet. Nothing stops a manager
demoting themselves and losing access. And **a re-seed resets every staff member's role,
hours and on-shift flag back to the committed config**, silently undoing any role change made
here.

## Agency console — **Built**

A single readout of whether a deployment is correctly wired: which shop slug is loaded,
whether it is seeded and its config hash, live product / order / customer counts, the site
URL, Stripe account status including whether charges and payouts are enabled, whether the
webhook secret and the SMS and email keys are set or running in log-only mode, which kitchen
notification channels are configured, the review URL, and a live HTTP status check on the main
domain, www and every legacy domain. Four buttons: reload config into the database, clear the
menu cache, send test kitchen notifications, and run the review-request job now.

**Where:** `/admin/launchflow`, behind a separate agency key with a 4-hour session. The shop
owner cannot see it.

**Limits.** **Reload config → DB is the dangerous button.** It re-runs the full seed, which
overwrites every stock line's on-hand and par with the sample numbers, resets every driver's
status, resets every staff member's role, hours and on-shift flag, and reverts prices, hours
and delivery bands to config. There is no confirmation dialog and no dry-run. It also runs
without `--reset`, so a product deleted from config stays live on the site; only the CLI can
deactivate it. The domain check fires live HTTPS requests on every page load with a 5-second
timeout each, so the page is slow and fails noisily on restrictive networks. Output is raw
JSON in a `<pre>` block. Test kitchen notifications returns "skipped" for all three channels
on the live config because all three are empty. There is no log viewer, no error history,
nothing surfaces a failed Stripe webhook, and there is no cross-client dashboard — it is one
shop at a time.

---

# 5. Platform and deployment

## Per-shop configuration — **Verified**

One folder per shop (`config/<slug>/`) holds everything shop-specific — name, domain, brand
colours, logo, branches, opening hours, delivery fees and bands, postcode areas, payment
options, SEO wording, referral and loyalty settings, plus the menu and the optional back-office
sample data — validated by a schema on load. Cross-reference checks beyond the schema catch a
product pointing at a category that does not exist, a duplicate size, a product with no price,
a deal slot referencing an unknown product, a duplicate branch id, and a shop offering delivery
with no postcodes set. Each failure is a plain-English message.

**Limits.** **There is no screen for any of it** — changing `client.json` or `menu.json` needs
a developer and a redeploy. The schema silently discards keys it does not recognise:
`client.json` already carries a `deliveryAreas` list (Grays, Chafford Hundred, Tilbury and
eight more) under the branch that is stripped on load and displayed nowhere — the site only
ever shows bare postcode prefixes. The file is parsed once and cached for the life of the
process, so an edit needs a restart or the agency Reload button. Money is pounds in config but
pence in the database, converted only in the seeder.

## CSV menu import — **Verified**

A `products.csv` dropped into the shop's config folder is parsed (proper handling of quotes,
escaped quotes and CRLF) and merged over `menu.json`. One row per size; rows are grouped into
products by slug, sizes collected, categories inferred, and prices accept a £ sign and commas.
Bad rows are reported by line number and any error aborts the whole load.

**Limits.** There is no upload screen — the spreadsheet has to be saved into the repo and
deployed, so it is still a developer job. Only products come from CSV; deals, option groups and
discount codes stay in `menu.json`. A typo in the category column silently creates a new menu
section rather than erroring. The image column expects a photo that already exists in the
assets folder, so photos are a separate manual step. Farm Pizza does not use it — its 68
products live in `menu.json`, and only `products.csv.example` is present.

## Config-to-database seeding — **Verified**, and the sharpest edge in the platform

Reads a shop's config folder and upserts it into Postgres: client, branches, opening hours,
delivery bands, categories, products, sizes, option groups, deals, deal slots and
config-defined discount codes, plus the optional back-office data — stock lines, drivers,
staff (the plain PIN never reaches the database — only its hash), sample reviews and marketing
automations. Records a 16-character hash of the config files so you can tell whether what is
live matches the repo. A
`--reset` flag deactivates menu rows no longer in config; orders are never touched.

**Where:** `pnpm seed <slug>`; automatically on every container start; and the agency Reload
button.

**Limits.** **Seeding runs on every container start** (`SEED_ON_BOOT` defaults to true) and
overwrites prices, product names and descriptions, sold-out flags, opening hours and delivery
bands with the config values. A price changed in `/admin/menu`, hours changed in
`/admin/hours`, or a delivery band added in `/admin/zones` is silently reverted at the next
restart or redeploy. A code comment claims the admin screen writes to both config and the
database; it does not — the admin actions write only to the database. The agency Reload button
seeds without `--reset`, so a product deleted from config stays live. Staff PINs are written
only on creation and never updated, so a PIN cannot be changed by re-seeding. If seeding fails
at boot the container starts anyway with whatever was there before.

## New-client scaffolder — **Built**

`pnpm new-client` asks for (or takes as flags) business name, slug, domain, cuisine,
localities, brand colours, phone, postcode districts, delivery fee and minimum, then writes a
complete config folder: `client.json` with one branch per locality, a placeholder three-item
menu, a markdown copy file per locality with an FAQ stub, a generated SVG wordmark in the brand
colour, and copies of the reference hero and OG art. Prints the next four steps.

**Limits.** No test covers it. Every branch it creates gets the identical postcode list,
identical 16:00–23:00 hours seven days a week, and identical fee and minimum, so a two-branch
shop must be hand-corrected before it can trade. It copies reference assets out of
`config/farm-pizza`: the hero and OG art are copied only if present, but the
`products.csv.example` copy is unguarded, so the script throws if that reference folder is
ever renamed or removed. It writes no delivery bands, no referral block and no photo style,
so those fall back to schema defaults. It
does not validate what it wrote. The generated logo is a text SVG, not a real brand mark.

## Config validation — **Verified**

`pnpm validate-config` loads and cross-checks every client folder without touching the
database, printing a per-shop summary or a list of specific problems and exiting non-zero on
failure. A companion script regenerates the editor JSON schemas from the definitions so editors
autocomplete and flag mistakes. Runs as a CI step on every push and pull request.

**Limits.** The editor schemas are regenerated only when someone remembers to run the script,
so they can drift and quietly stop flagging genuine mistakes. Validation checks structure and
internal consistency only — it cannot tell you a price is wrong, a postcode is not yours or a
photo is missing. It scans folders inside this repo, so a client whose config lives elsewhere is
never checked.

## Database and migrations — **Verified**

A 706-line Prisma schema covering tenant, branches, opening hours, delivery bands, menu, deals,
customers, addresses, one-time codes and sessions, orders with an append-only event log,
payments, discount codes, loyalty ledger, campaigns, stock, drivers, staff, reviews, marketing
automations, message sends and inbound SMS. Seven applied migrations. All money is stored as
integer pence, all times UTC with the branch timezone held per branch. Migrations are applied
automatically at container start, retried up to 30 times while the database boots.

**Limits.** Every table carries a client id so one database could in principle hold several
shops, but the app only ever reads the one named by `CLIENT_SLUG` — real separation comes from
giving each shop its own database, which is what the deployment notes assume. Order numbers use
a single database-wide counter, so shops sharing a database would see interleaved numbers. The
campaign table has a client id but no foreign key. **Nothing in the repo covers backup, restore
or rolling a migration back** — that is entirely on whoever runs the server.

## Brand theming — **Built**

The shop's primary and secondary colours are injected as CSS variables at render time, with a
readable ink colour computed automatically for text on the primary. Logo, hero and social image
are named in config and served off disk from the shop's own assets folder with path traversal
blocked and a one-day cache. A `photoStyle` switch flips all food photography between full
colour and the prototype's desaturated look.

**Limits.** Only two colours are configurable; every other colour in the design is fixed in the
stylesheet, so a shop needing more than a red and a near-black gets the Farm Pizza palette
underneath. The browser theme colour is hard-coded regardless of brand. **There is no image
upload screen anywhere** — replacing a logo or a product photo means committing a file to the
repo and redeploying. Assets are read from disk on every request rather than served as static
build output. The social share image is generated in a fixed layout and cannot be art-directed.

## Deployment — **Built**

A multi-stage Dockerfile builds a Next standalone image running as a non-root user with a
health check; the entrypoint applies migrations then seeds the shop from config before starting
the server. The Coolify notes document the per-client recipe: one Postgres, one service with
`CLIENT_SLUG` as a build arg and env var, the domain plus www plus every legacy domain, the
Stripe webhook, and a cron entry. Middleware 301-redirects www and legacy hosts to the canonical
domain. A compose file runs the same stack locally with remappable host ports. `/api/health`
reports whether the shop is seeded and its config hash.

**Limits.** **CI never builds the Docker image**, so a broken Dockerfile or entrypoint is only
discovered at deploy time. One container equals one shop equals one database, so hosting cost
and upgrade effort scale linearly per shop rather than per platform. The middleware redirects
any host that is not the canonical site URL (localhost excepted), which means the
Coolify-generated preview URL bounces straight to the live domain — **there is no way to preview
a new shop before DNS is switched over**. Legacy domains always land on the home page. If the
boot seed fails the entrypoint logs "seed failed (continuing)" and starts anyway, so the site can
come up with a stale or empty menu. **The two cron jobs must be created by hand per deployment**
— nothing in the repo sets them up, the runbook only mentions the review-request one, and if the
review cron is never wired that feature silently does nothing.

## Automated checks before deploy — **Verified**

CI on every push and pull request spins up Postgres, validates every client config, generates
the database client, type-checks the workspace, lints, runs the unit tests, applies migrations,
seeds Farm Pizza for real, builds the app, then runs Lighthouse mobile against the home and menu
pages and fails the build if performance or SEO drops below 90.

**Limits.** There are two test files, 134 lines and 16 tests. **Nothing tests checkout,
payment, the Stripe webhook, pricing, deals, promos, sign-in, permissions, seeding correctness
or any part of the user interface.** There are no end-to-end or browser tests at all. The Docker
image is never built in CI. Lighthouse gates two pages and only performance and SEO —
accessibility is a warning that cannot fail the build. CI validates `farm-pizza` only.

## Demo data generator — **Built**

Builds a plausible nine-month trading history for a seeded shop — around 850 customers with
regulars, one-timers and a lapsed tail, higher volume in the recent three weeks, orders sitting
live on the pass so the kitchen and dispatch screens have work in them, and a win-back campaign
already run with its revenue attributed. Deterministic, so re-running produces the same shop.
Everything it writes is tagged with an Ofcom fiction-range phone number so `--wipe` removes
exactly what it made.

**Limits.** No test covers it, and it writes directly to whatever `DATABASE_URL` points at — the
only protection against running it on a live shop is the warning in its own header. Customer
names, street names and postcodes are hard-coded to Grays and Basildon, so a demo for a shop
anywhere else shows Essex addresses. The volumes are hard-coded. Wipe identifies its rows purely
by the reserved phone prefix, so a row whose phone number was later edited would be left behind.

---

# Not built yet

Genuine gaps. If someone asks for one of these in a sales conversation, the answer is "not
today".

**Ordering**

1. **Build your own pizza.** No screen exists. The nav link is deliberately held back.
2. **Half-and-half, and removing toppings.** Only add-a-topping exists, on pizzas only.
3. **Table booking.** Listed on the roadmap, not started.
4. **Tips, saved cards, cutlery and structured allergy questions at checkout.** None exist.
5. **Address lookup.** The delivery address is free text — no Royal Mail or postcode-to-address
   service.
6. **A closed-shop banner on the storefront.** The block does not appear until checkout.
   `PROGRESS.md` records this as outstanding.
7. **Customer cancellation or amendment.** The tracker shows the shop's phone number.
8. **Delivery tracking on a map.** "On its way" is the last step; there is no driver location.

**Money and payments**

9. **A refund button.** Refunds happen only automatically when the kitchen rejects a paid
    order. No partial refunds, and cancelling never refunds.
10. **Card payments for this tenant.** The Stripe account id is blank and cash on delivery is
    off, so cash on collection is the only working route as configured.
11. **A cash-collected step.** The database has the status; no screen sets it.

**Running the shop**

12. **Stock that moves.** Nothing decrements as food is sold; on-hand only changes on a re-seed,
    and receiving stock has no button.
13. **Supplier ordering.** Reorder sets a flag and messages nobody.
14. **Real dispatch.** Assigning a driver does not change the order or notify the driver. No GPS,
    no route, no proof of delivery.
15. **A real map, anywhere.** Both the shops page and the dispatch panel draw CSS placeholders.
16. **Split opening hours.** One open and one close per day; a shop that shuts between services
    cannot be set up.
17. **Holiday and one-off closure dates.** Christmas means editing the weekly grid and putting it
    back.
18. **A back-office order detail page.** Orders are read-only — no notes, no amendments, no
    resend.
19. **Adding menu items, categories, sizes, options, photos or allergen data from the admin.**
    All of it needs a developer and a re-seed.
20. **Capacity-aware quoted times.** The ETA is a fixed number of minutes regardless of how busy
    the kitchen is.

**Marketing**

21. **Loyalty redemption.** Points can accrue but cannot be spent; the scheme is switched off and
    the rewards page 404s.
22. **Email unsubscribe.** Marketing emails carry no unsubscribe link and there is no email
    opt-out path in the codebase. SMS-only STOP.
23. **An inbox for inbound texts.** Replies are stored and shown nowhere.
24. **Opting a customer in or out by hand.** No control on any screen.
25. **Real reviews.** No customer review form, no Google import, and replies are posted nowhere.
26. **Campaign scheduling, drafts, test sends and previews.** Send now is the only option.
27. **Birthday automations.** The trigger is in the dropdown and can never fire — no date of
    birth is collected.
28. **A scheduler for the automations.** Without an externally configured cron job they run only
    when someone presses Send now.
29. **Analytics.** No Google Analytics, Tag Manager or any other tracking is wired in anywhere.
30. **Promotion of the referral scheme.** It works, but nothing outside the account page mentions
    it.
31. **Automatic offers, stacking, BOGOF, and product- or day-restricted codes.** One code per
    order, no automatic discounts.

**Platform**

32. **A settings screen for the config.** Brand, referral figures, loyalty rates, notification
    channels, review delay and payment options are all config-file values needing a redeploy.
33. **Image upload.** Logos and product photos are committed files.
34. **A PIN or password change screen.** Sample PINs are committed to the repo and can only be
    changed by editing config and deleting the staff row.
35. **Protection against the boot re-seed.** Admin edits to prices, hours and delivery bands are
    reverted on the next restart.
36. **A preview URL for a new shop.** Middleware redirects any non-canonical host to the live
    domain.
37. **Backup, restore and migration rollback.** Nothing in the repo covers them.
38. **Tests for anything that handles money.** Pricing, deals, promos, checkout, payment and the
    webhook have no automated coverage.
39. **End-to-end or browser tests.** None exist.
40. **A cross-client agency dashboard.** The agency console is one shop at a time.
