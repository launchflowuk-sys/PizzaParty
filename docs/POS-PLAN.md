# Pizza Party POS — the plan to beat Foodhub

Written 2026-09-28, before any POS code existed. This is the reference to come
back to: what Foodhub does, where it hurts shop owners, what we build instead,
and in what order.

---

## 1. Where we start

**No POS exists.** Until now the only way to create an order is the customer
checkout (`apps/web/src/app/api/checkout/route.ts`). There is no staff order
entry, no record of an order's source, and `PaymentStatus.cash_collected` is
never set.

What the POS reuses, so it cannot drift from the website:

| Need | Already built | Where |
|---|---|---|
| Prices, deals, toppings, delivery bands, minimums | `priceRequest` → `priceBasket`, fully server-side | `lib/checkout.ts`, `lib/pricing.ts` |
| Kitchen screen, auto-print, notifications | `markPlaced()` fires all of them | `lib/orders.ts` |
| Status lifecycle + audit trail | `transitionOrder()`, `OrderEvent` | `lib/orders.ts` |
| Customer by phone, saved addresses | `Customer @@unique([clientId, phone])`, `Address` | `schema.prisma` |
| Staff PINs, roles, screen grants | `Staff.pinHash`, `permissions.ts`, `requireScreen` | `lib/auth.ts`, `lib/permissions.ts`, `lib/session.ts` |
| Pizza options with min/max | `useSelection`, `OptionPicker` | `components/product/OptionPicker.tsx` |
| Deal slots | `DealBuilder` | `components/deals/DealBuilder.tsx` |
| Address search | Google Places proxy | `app/api/address`, `lib/places.ts` |
| Receipts | `Receipt.tsx`, `/kitchen/print/[order]`, CloudPRNT webhook | `components/print`, `lib/notify.ts` |
| Stripe (direct charges on the shop's connected account) | `getStripe()`, `connectOpts()`, PI webhook → `markPlaced` | `lib/stripe.ts`, `app/api/stripe/webhook` |

---

## 2. What Foodhub / Touch2Success sells

- 15.6" Android tablet, ~£300 ex VAT. Printer, card terminal (PDQ), kiosk and
  kitchen display sold separately. Tiers: EPOS / Pro / Pro Max.
  <https://shop.foodhub.com/products/fh-epos>
- Order types delivery / takeaway / dine-in; table management; bill split.
- Caller ID: a USB box on the phone line pops the saved customer's address.
  <https://shop.foodhub.com/products/takeaway-and-restaurant-caller-id>
- Card payments are **locked to their own processor, Datman**.
- "Bake Line" kitchen view; "Drive2Success" driver dispatch.
- Their own web/app orders reach the till — **Just Eat / Deliveroo do not**;
  owners still run separate tablets.
- No public screen-level docs exist; the layout is the standard UK takeaway
  pattern (categories left, grid middle, basket right, popup modifiers).

## 3. Where it hurts shop owners (Trustpilot)

- **Fees**: sold as "no commission", yet ~4% card fees through Datman, weekly
  rental even on bought hardware, per-order/daily/transfer fees.
- **Money going missing**: missing payouts, unclear reports, nothing to
  reconcile against.
- **Lock-in**: charges after cancelling, £100 fee to cancel before go-live,
  owners cancelling bank cards to stop payments.
- **Old software**: "very old software", three months of menu and station
  printing faults; one allegation of **prices changed without telling the shop**.
- **Hardware / support**: 10 days to replace a printer while still billed;
  30-minute phone queues; callbacks that never come.

Sources: <https://uk.trustpilot.com/review/foodhub.com> (pages 1–4),
<https://www.trustpilot.com/review/www.touch2success.com?page=6>

**The pitch that answers all of it:** one monthly fee, no lock-in, Stripe's
published rates paid straight to the shop's own Stripe account, every penny
visible in the end-of-day report, and every price change logged with who
made it.

---

## 4. How we beat it — the feature list

Every item below is in scope. Phases are only the build order.

### Taking an order (Phase 1)
1. **Full-screen till at `/pos`** — no website chrome, ≥ 60px targets, works on
   any tablet browser installed as a PWA. Staff sign in with their PIN; every
   order records who took it.
2. **Order type bar**: Collection · Delivery · Phone (collection or delivery).
3. **Category rail + item grid**, product photos optional, **bestsellers pinned
   first** (from `Product.ordersCount`), **type-to-search** across the menu.
4. **One-screen pizza builder**: size → base → crust → toppings. Each topping
   chip cycles **whole → left half → right half → off**; price updates live.
   Half-and-half uses the existing first-half / second-half groups.
5. **Deals as one tile** that opens its slots; only allowed items are offered.
6. **Basket**: qty ±, line notes ("well done", "no onion"), remove, order note.
7. **Phone orders**: type the number → name, saved addresses, order count,
   total spend, **staff notes / allergy / blocked flag**, last 5 orders, and
   **Repeat last order** in one tap.
8. **Delivery**: postcode check against zones, fee and minimum applied by the
   same server pricing as the website; address search via Places.
9. **Timing**: ASAP or a scheduled time. Staff may take an order **while online
   ordering is paused or the shop shows closed** (the website still refuses).
10. **Manager discount** (percent or amount, reason required, manager PIN) —
    logged to `OrderEvent`.

### Getting paid (Phase 1 — card reader included from day one)
11. **Stripe Terminal card reader** (WisePOS E or S700, internet readers),
    server-driven: the till sends the amount to the reader, the customer taps,
    the existing Stripe webhook places the order. Payment goes to the shop's own
    connected Stripe account. Tested locally on Stripe's **simulated reader**.
12. **Cash panel**: £5 / £10 / £20 / £50 / Exact + keypad, **change due shown
    big**, marks payment `cash_collected`.
13. **Split payment**: part cash, rest on the reader.
14. **Pay on collection / on delivery** for phone orders, settled later from the
    queue (cash or reader).
15. **Receipt**: auto kitchen ticket as today; customer receipt on demand.

### One queue for everything (Phase 2)
16. **Every order in one place** — website, app, counter, phone — with a source
    badge, in columns New · Cooking · Ready · Out · Done. Ages colour up as they
    get late; new online orders chime.
17. Accept / reject / ETA / status moves from the queue (same rules as kitchen).
18. **Assign driver** from the queue; see who is out with what.
19. **Take payment on an unpaid order** (cash or reader) from the queue.
20. **Edit a sent order**: add or remove items; the kitchen reprints **only the
    changes**; every void is logged with who and why; card difference charged or
    refunded.
21. **Refunds**: full or per-line, card back through Stripe, cash logged.
22. **Reprint** any ticket or receipt.

### Money you can trust (Phase 3)
23. **End-of-day (Z) report**: takings by channel (web / app / counter / phone),
    by payment (card online / card reader / cash), by staff member; discounts,
    voids, refunds; delivery fees; expected cash in drawer.
24. **Cash drawer**: opening float, pay-ins / pay-outs (e.g. "£20 to driver for
    fuel"), counted cash vs expected, over/short.
25. **Driver cash settlement**: cash each driver collected, handed in, owed.
26. **Stripe payout match**: card takings per day vs Stripe balance transactions.
27. **Price change log**: every menu price edit with who and when (answers the
    "prices changed without telling us" complaint).

### Beyond Foodhub (Phase 4)
28. **Caller ID**: phone rings → customer pops on the till. Route depends on the
    shop's line: VoIP/SIP webhook (cleanest), or a USB caller-ID box read with
    Web Serial on a desktop Chrome till. Decide once the shop's phone setup is known.
29. **Customer-facing display**: second screen showing basket and total.
30. **Offline mode**: keep taking cash orders when the internet drops, sync after.
31. **Just Eat / Deliveroo / Uber Eats into the same queue** via Deliverect or the
    marketplaces' partner APIs (needs partner approval per platform).
32. **Eat-in / table orders** if the shop wants them.
33. **Keyboard shortcuts** for a desktop till: search, qty, pay, send.

### Marketing (added 2026-09-28, building alongside Phase 1)
34. **Push offers to app users**: push is a campaign channel next to SMS and
    email. The offer is either an existing live one (a deal, a promo code or a
    promo slot) or a custom one built on the spot. The audience is all app users,
    a segment, or hand-picked customers, with "Send offer" on any customer's
    page. Custom offers for specific people get one-person codes. The screen
    shows a phone preview, the recipient count and a confirm step, and
    redemptions are measured through the promo code. Marketing consent is
    respected.

---

## 5. How it is built

**Route**: `/pos` (top level, like `/kitchen`), guarded by middleware and a new
`pos` screen in `permissions.ts` granted to manager, shift_lead and
front_of_house. Added to `OPS` in `app/layout.tsx` so the storefront chrome is
not rendered.

**Data changes** (one migration):
- `Order.source String @default("web")` — web | app | pos | phone.
- `Order.takenBy String?` — staff name/id for counter and phone orders.
- `Customer.staffNotes String?`, `Customer.blocked Boolean @default(false)`.
- Payments: allow more than one `Payment` per order (split), each with
  `provider` stripe | stripe_terminal | cash, `tendered` for cash.
- A walk-in with no phone uses one shared "Walk-in" customer per shop.

**Order creation**: the write block in `api/checkout/route.ts` moves into a
shared `createOrder()` in `lib/orders.ts`; checkout and POS both call it, so
there is one path that writes orders.

**API** (all staff-only, `can(role, "pos")`, actor = staff on every event):

| Method | Path | Does |
|---|---|---|
| GET | `/api/pos/bootstrap` | menu, bestsellers, locations, delivery terms, terminal readers, staff |
| POST | `/api/pos/price` | server price for a POS basket incl. discount |
| GET | `/api/pos/customers?phone=` | customer, addresses, notes, last orders with basket lines |
| PATCH | `/api/pos/customers/:id` | staff notes / blocked |
| POST | `/api/pos/orders` | create order (source pos/phone) |
| POST | `/api/pos/orders/:id/pay` | cash, reader, or split part |
| GET | `/api/pos/orders/:id/pay/:paymentId` | reader payment status (polled) |
| POST | `/api/pos/orders/:id/pay/:paymentId/cancel` | cancel on reader |
| GET | `/api/pos/queue` | Phase 2 unified queue |

**Stripe Terminal**: server-driven integration. A Terminal Location and reader
are registered on the shop's connected account (`connectOpts`). Pay =
create a `card_present` PaymentIntent with `metadata.orderId` →
`terminal.readers.processPaymentIntent` → the existing webhook's
`payment_intent.succeeded` calls `markPlaced`. The till polls status and can
cancel. Test mode uses a simulated reader and
`testHelpers.terminal.readers.presentPaymentMethod`.

**Kitchen / print / notify**: unchanged — `markPlaced` already does it.

---

## 6. How the agents are split

Strength is matched to what breaks if it is wrong.

| Work | Model | Why |
|---|---|---|
| Migration, `createOrder()` extraction, POS order + payment APIs, Stripe Terminal, refunds | **Opus** | Money and data; a mistake loses takings |
| Security review of every phase before it is called done | **Opus** | Staff-only money endpoints |
| POS screens (till, builder, basket, cash panel, queue, reports) | **Sonnet** | Large UI, well-specified |
| Permissions entry, middleware, layout OPS, docs, help pages, seed staff | **Haiku** | Mechanical |

Independent pieces run in parallel against the API contract above. Nothing is
pushed live until Shoji has tested it locally and approved it.

---

## 7. Progress

| Phase | Status |
|---|---|
| 1 — Take an order, get paid (incl. card reader) | Built, reviewed, tested locally on a simulated reader (2026-09-28) |
| Push offers (item 34) | Built and reviewed. The app's tap-to-open handler is in farm-pizza-app, uncommitted |
| 2 — One queue | Backend built and tested (2026-09-28). Queue screen and second review in progress |
| 3 — Money you can trust | Not started |
| 4 — Beyond Foodhub | Not started |
