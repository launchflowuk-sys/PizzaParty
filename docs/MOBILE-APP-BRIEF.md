# Farm Pizza — iOS and Android app build brief

**Repo:** this one (LaunchFlow white-label takeaway platform, Next.js 15 App Router + Prisma + Postgres, pnpm monorepo).
**Live tenant:** Farm Pizza, `CLIENT_SLUG=farm-pizza`, Essex. The business trades in Basildon as well as Grays, but **the config holds one branch, Grays, delivering to RM15–RM20 only** — build for one branch and read 1.2 before assuming otherwise.
**Stack for the app:** Expo (managed) + React Native + Expo Router, built and submitted with EAS Build / EAS Submit.
**Audience:** an engineer or agent session with no knowledge of the conversation that produced this document.

---

## 0. How to use this brief

Read sections 1–3 before writing any code. Section 5 is the contract with the backend and is the part most likely to be got wrong — every endpoint listed as "new" must actually be written in this repo, in `apps/web/src/app/api/`, before the app can call it.

Everything here that describes existing behaviour was checked against the code, not remembered. Where a claim matters, the file is named. If you change one of those files, re-check the claim.

Two rules that override anything else in this document:

1. **The app is a second front end onto the same server.** All pricing, availability, promo, deal and delivery-zone logic stays on the server, in `apps/web/src/lib/pricing.ts`, `checkout.ts`, `postcode.ts` and `availability.ts`. The app never computes a price, a delivery fee, a minimum spend or an open/closed state itself.
2. **Parity with the web product.** If the app can do something the website cannot, or the website can do something the app cannot, that is a bug unless it appears in section 11 as a deliberate exception.

---

## 1. The system you are building against

### 1.1 Shape

- One deployment serves **one shop**. `CLIENT_SLUG` selects the config folder (`config/farm-pizza/`) and the `Client` row; `apps/web/src/lib/menu.ts` reads only that client. There is no tenant switching at runtime, so the app is single-tenant too — the base URL identifies the shop.
- All money is **integer pence** end to end. `subtotal`, `deliveryFee`, `discount`, `total`, `unitPrice`, `price` are pence. Format for display only; never round in the app.
- All timestamps are **UTC ISO strings**. Each branch carries its own `timezone` (`Europe/London`). Display in the branch timezone, never the device timezone — Grays trades to 02:00 and 03:00 and a device set to another zone will show the wrong day.
- The menu is cached server-side for 60 seconds (`unstable_cache`, tag `menu`). A price or sold-out change can take up to a minute to appear. Do not cache the menu in the app for longer than that without a manual refresh.

### 1.2 Live config facts (verified in `config/farm-pizza/`)

| Thing | Value | Consequence for the app |
|---|---|---|
| Locations in config | **One** — Grays only, despite the business trading in Basildon too | The shop chooser will show one branch. Do not build a two-branch UI that then looks broken. Raise it with the owner. |
| Fulfilment | `delivery`, `collection` | No dine-in, no table service. |
| Payments | `stripeAccountId: ""`, `cashOnCollection: true`, `cashOnDelivery: false` | **Card is not live.** With no Stripe env keys, `/api/checkout` returns 503 for `paymentMethod: "card"`. Today the only working payment path is cash on collection. See 7.1 — this is a phase-zero blocker. |
| Menu | 7 categories (pizzas 30, starters 5, sides 9, chicken 7, pasta 2, desserts 5, drinks 10), 68 products, **46 with a photo** | 22 products render as a monogram tile. That is a designed state, not an error — see 3.5. |
| Drinks | Soft drinks and a milkshake only | No alcohol. No age gate needed; age rating stays low. |
| Referral | Enabled: £5 friend / £5 referrer, £15 minimum, 90-day expiry | In scope for the app. |
| Loyalty | `enabled: false` | **Out of scope for phase one.** See 2.1.3. |
| Kitchen alerts | `kitchenEmail`, `kitchenSms`, `printerWebhook` all `""` | Nothing tells the shop an order landed except the open `/kitchen` tab. Directly relevant to section 2.2. |
| Brand colour in config | `brand.primary: "#C8322B"` | **Not the colour the site actually uses.** The Modernist port sets the accent to `#ec3013` in `apps/web/src/app/modernist.css`; `--brand-primary` is set in `layout.tsx` and now read only by `PayStep.tsx`, so it themes nothing but the Stripe element. Ignore `brand.primary`. Use `#ec3013` as the accent — but **not** as the primary button fill, which is `#ae1800`. See 3.1. |

### 1.3 Known server-side defects the app will meet

Do not "fix" these in the app. Fix them on the server or leave them; either way, know they exist so you do not chase a phantom bug in React Native.

- `/api/basket/price` never receives the customer's phone, so a **first-order-only promo looks valid in the basket** and is refused only at `/api/checkout`. A personal referral reward code shows its rightful owner "That code was issued to someone else" right up until they submit.
- The **order tracker, the SSE stream and the reorder endpoint have no auth check**. Anyone with an order id can read the customer's name, phone and address, or rebuild their basket. Send the bearer token on those calls anyway so the app keeps working when the server is tightened.
- **Reorder always prices as collection** with no delivery fee, so a delivery-only deal is silently dropped from a reorder.
- Deal day-of-week checks use the server's clock, not `Europe/London`.
- The web checkout's delivery helper text quotes the headline £1.99 / £9.99 rather than the band actually charged, and the "about 35 min" beside it ignores the band's extra minutes (`CheckoutFlow.tsx` line 143 reads `price.location.deliveryFee` / `price.location.minOrder` / `location.deliveryMinutes`). **Do not copy that line**, and note precisely why, because the trap is inside a single response:
  - `/api/basket/price` returns **both**. Its top-level `deliveryFee` is the banded, correct figure (the summary at line 245 uses it). Its nested `location.deliveryFee` and `location.minOrder` are the shop's *headline* values straight off the `Location` row, which is what the helper text wrongly renders.
  - So: fee from `PricedBasket.deliveryFee`, never `location.deliveryFee`.
  - **There is no banded minimum in `PricedBasket` at all.** The correct minimum for a postcode comes only from `/api/postcode/check` (`location.minOrder`, computed by `deliveryTermsFor`), or indirectly as a message in `PricedBasket.errors`. If the app wants to show "spend £X more", call the postcode endpoint and hold its answer; do not read `location.minOrder` off the price response.
  - Farm Pizza's Grays bands today: RM17 £1.99 / £9.99 / +0 min; RM16 and RM20 £3.49 / £14.99 / **+15 min**. A Chafford Hundred customer is charged £3.49 while the web helper text says £1.99.
- `sendSms` and `sendEmail` return `{ ok: true, id: "dry-run" }` when credentials are missing (`apps/web/src/lib/notify.ts`). Anything that reports "sent" may not have been sent. Do not repeat that pattern for push (see 6.6).

### 1.4 How well tested the server actually is — read this before trusting any endpoint

The platform's entire automated test suite is **two files, 16 tests, 134 lines** — `scripts/tests/logic.test.ts` (13 tests) and `scripts/tests/config.test.ts` (3). They cover, and cover well:

- opening hours across midnight, next-opening, and pre-order slot generation (`availability.ts`)
- postcode normalisation, outward-code matching, band precedence, minimum inheritance (`postcode.ts`)
- UK phone normalisation (`phone.ts`)
- config and CSV loading

They cover **nothing else**. There is no test over `pricing.ts` — the file every price, deal, promo and discount runs through — none over `/api/checkout`, none over the Stripe webhook, none over sign-in, sessions or permissions, and no end-to-end or browser test of any journey anywhere. CI additionally gates Lighthouse performance and SEO at 90 on the home and menu pages only.

Two consequences for this project, and they are not small:

1. **The app will be the first serious second consumer of these endpoints.** Anywhere the web happens to send a field the app forgets, or tolerates a shape the app does not, there is no test that will catch it. Budget for finding server bugs during app development and treat them as server work, not app work.
2. **Write tests for the 13 new endpoints in 5.3 as you write them**, and take the opportunity to put a test round `priceBasket` while you are in there. The alternative is that a pricing regression reaches a shop's till through two front ends instead of one.

Nothing above is a reason not to build the app. It is a reason not to read "built" as "proven" anywhere in this document.

---

## 2. Scope

### 2.1 Customer app — in scope

One app, iOS and Android, from one Expo project.

#### 2.1.1 Phase one (ship this)

Browse menu · search · product options and sizes · basket with server pricing · deal builder · promo codes · delivery postcode check · collection or delivery · ASAP or pre-order slot · guest checkout · SMS-code sign-in · card / Apple Pay / Google Pay / cash-on-collection · live order tracking · order history · one-tap reorder · saved addresses (read + delete) · **transactional push only** · a marketing-preferences toggle · refer a friend · **in-app account deletion**.

Note two things that moved out of the original phase-one list because they contradicted rules later in this document:

- **Marketing push is phase two, not phase one.** Section 6.3 rule 4 requires every marketing push to open onto a working "Turn off offers" control, and section 6.3 rule 3 notes `saveAutomation` hard-codes `channel: "sms"` — so marketing push can only exist as one-off campaigns from `/admin/campaigns`, which is itself phase two. Phase one ships the `PushDevice` model, registration, consent plumbing and transactional push, and sends no marketing at all.
- **The marketing-preferences toggle stays in phase one** even though the campaigns that use it do not. It is one switch calling `/api/account/marketing`, and `/privacy` already tells customers they can opt out "from your account page" — a promise the website does not currently keep. Shipping it costs an afternoon and closes a live compliance gap.

Account deletion is phase one and not negotiable. The app supports account creation (SMS OTP), which triggers Apple Guideline 5.1.1(v): an app that lets a customer create an account must let them delete it **in the app**. It is the single most likely reason a first submission is rejected (9.6), so it ships with the first build, not after it. Endpoint 10 in section 5.3 is therefore phase-one server work.

#### 2.1.2 Phase two

Marketing push campaigns driven from `/admin/campaigns`, gated on the same consent flag as SMS STOP (6.3) · address add / edit / set-default · Apple and Google sign-in alongside SMS OTP.

#### 2.1.3 Explicitly not in phase one

- **Crust Club / loyalty.** `loyalty.enabled` is false, points cannot be spent (no redemption path exists anywhere in the codebase), and the 250-point ladder is hard-coded in a web page. Shipping a points screen would advertise a scheme that permanently reads zero. Leave it out entirely — no tab, no card, no mention.
- **Build your own pizza.** The screen does not exist on the web either; the nav link is deliberately held back.
- **Live driver map.** There is no GPS anywhere in the system. `/admin/dispatch` draws a CSS grid with pins positioned by array index. Do not build a map the data cannot fill.
- **Tips, saved cards, cutlery prompts, structured allergy questions.** None exist on the web. Adding them breaks parity and creates an order the kitchen screen cannot display.

### 2.2 Kitchen — recommendation: keep it as a web screen on the tablet. Do not build a native kitchen app in phase one.

Reasoning, in order of weight:

1. **The screen is not the problem; the alert is.** `/kitchen` is built and complete: four ruled columns (New / In the oven / Ready / Out for delivery), 5-second polling, a 20-second beep that nags while anything is unaccepted, full tickets, accept-with-ETA, reject from a fixed list of five reasons with an automatic Stripe refund when the order was already paid, and pause. (Built, not proven — see the coverage note in 1.4. It has had no automated or browser testing.) What fails is that `kitchenSms`, `kitchenEmail` and `printerWebhook` are all empty strings, the beep needs a manual "Enable sound" tap after every page load because of browser autoplay policy, and a sleeping tablet or a closed tab tells nobody. Rewriting the screen in React Native fixes none of that. Filling in three config values and putting the tablet in kiosk mode fixes most of it in an afternoon.
2. **The kitchen screen is coupled to the order lifecycle and changes often.** Every new status, reject reason or ticket field would then ship twice, through app-store review, to a tablet in a pizza shop. That is the worst possible place to put a release process.
3. **A kitchen tablet is a fixed device, on mains power, on the shop's own wi-fi.** None of the reasons to go native — offline, GPS, camera, in a pocket — apply.
4. **Store risk.** An app whose only content is the shop's own web screen is what Apple rejects under Guideline 4.2 (Minimum Functionality). It would be a fight over an app the public must never install.

**What to do instead, in order:**

- **(a) Fill in the notification channels.** Set `notifications.kitchenSms` to the shop mobile and `notifications.kitchenEmail` to the shop inbox in `config/farm-pizza/client.json`, then re-seed. `apps/web/src/lib/orders.ts` already texts and emails the kitchen on every new order — the code is written and idle. Zero new code.
- **(b) Kiosk the tablet.** Install `/kitchen` as a home-screen web app (Android: Chrome → Add to Home screen, or a kiosk launcher; iPad: Add to Home Screen), disable auto-lock, keep it charging. Sign in once — the kitchen cookie lasts 30 days.
- **(c) Only if (a) and (b) still leave orders missed:** ship a deliberately thin Expo companion, "Farm Pizza Kitchen" — full-screen `react-native-webview` pointed at `/kitchen`, plus `expo-keep-awake` and `expo-notifications` so a push wakes the tablet and rings through Do Not Disturb. Distribute **internally only**: TestFlight internal testing for iPad, Google Play internal testing or a direct EAS `.apk` for Android. Never submit it publicly. Budget two days, not three weeks.

Revisit a real native kitchen app only if a third branch opens or the shop wants offline ticket printing.

### 2.3 Driver — recommendation: no driver app, in phase one or phase two.

The server has nothing for a driver app to talk to. `/admin/dispatch` writes a driver's name against an order; **it does not touch the order** — the order stays `ready` until someone taps "out for delivery" on the kitchen screen. "Back at" is hard-coded to now + 30 minutes. `assignDriver` does not check the driver is free. There is no proof of delivery, no location, no job model, no driver auth, and the four drivers in `config/farm-pizza/ops.json` are sample data on Ofcom fiction-range placeholder numbers (`07700 900 201`–`204`).

A driver app is therefore a backend project first: driver identity and sign-in, an assignment that mutates the order, a delivery-completion action, optional location pings, proof-of-delivery photo. Phase three, with its own brief. Do not start it as a side effect of the customer app.

---

## 3. Design — the Modernist system on mobile

The app uses the same design system as the site: `apps/web/src/app/modernist.css`, ported from `docs/design_handoff_farm_pizza/_ds/`. It is a Swiss/International-style system — one typeface, heavy headings, hard 2px rules, zero radius, one hot accent on a warm-grey ground. Read `docs/design_handoff_farm_pizza/README.md` for the full component vocabulary before designing a screen that is not in section 4.

### 3.1 Tokens — exact values

These are copied from `modernist.css` and are the source of truth. Note the correction: the ground is `#f3f2f2` and the ink is `#201e1d` (not `#f7f7f5` / `#111`, which are approximations that have been circulating). Use the exact values below so app and web match on a shared screen.

```ts
// app/theme/tokens.ts — the whole design system, no CSS variables in RN
export const color = {
  bg:        '#f3f2f2',  // page ground
  surface:   '#eae9e9',  // cards, photo tiles, selected rows
  text:      '#201e1d',  // ink
  accent:    '#ec3013',  // the red. Prices, active states, focus rings, kickers.
                         // NOT the primary button fill — see the note below.
  accent2:   '#e15b47',
  divider:   'rgba(32,30,29,0.4)',   // ink at 40% — every rule uses this

  neutral100:'#f8f4f4', neutral200:'#eae7e7', neutral300:'#d7d3d3',
  neutral400:'#bab6b6', neutral500:'#9b9797', neutral600:'#7d7979',
  neutral700:'#605d5d', neutral800:'#444141', neutral900:'#2d2b2b',

  accent100:'#fff2ef', accent200:'#ffe0d9', accent300:'#ffc4b8',
  accent400:'#ff9783', accent500:'#ff563c', accent600:'#dd2b0f',
  accent700:'#ae1800', accent800:'#7c1405', accent900:'#4d170e',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 } as const;
export const radius = 0;          // everywhere. No exceptions, including images and sheets.
export const RULE = 2;            // the structural rule weight
export const HAIRLINE = 1;        // between rows inside a block
```

**The primary button is not `#ec3013`.** This is the one place the shipped site deliberately departs from the design handoff, and copying the handoff instead of the code would give you an app that neither matches the website nor passes WCAG AA.

- The handoff (`docs/design_handoff_farm_pizza/_ds/…/styles.css`) has `.btn-primary { background: var(--color-accent) }` — `#ec3013`, hover `#dd2b0f`, active `#ae1800`.
- The shipped site (`modernist.css`) has `.btn-primary { background: var(--color-accent-700) }` — **`#ae1800`**, hover `#7c1405` (accent-800), pressed `#4d170e` (accent-900), label `#f3f2f2`. The code carries the reason inline: `#f3f2f2` on `#ec3013` is 3.76:1 and AA wants 4.5:1 for a 14px label; on `#ae1800` it is 6.41:1.

**Use the shipped values.** Primary fill `#ae1800`, pressed `#4d170e`, label `#f3f2f2`. `#ec3013` stays the accent everywhere it is *not* carrying small text on top of it: prices, big numerals, kickers (`accent700` there), active/selected indicators, and the focus ring.

Other states, which the site and the handoff agree on: focus ring 2px `#ec3013` at 2px offset (`:focus-visible` in `modernist.css`); disabled 45% opacity; secondary button = 1px `divider` border, transparent fill, ink 7% / 14% on press.

### 3.2 Typography

One family: **Archivo**, weights 400 / 600 / 800. Install `@expo-google-fonts/archivo` and load `Archivo_400Regular`, `Archivo_600SemiBold`, `Archivo_800ExtraBold` with `expo-font`; hold the splash with `expo-splash-screen` until loaded, because a fallback-font flash destroys this design more than most.

| Role | Size / weight / tracking |
|---|---|
| Body | 15 / 400 / line-height 1.55 |
| Small print, descriptions | 13 / 400, `neutral700` |
| Kicker (section label) | 12 / 400, uppercase, letter-spacing 0.08em (`~1.0` in RN), `accent700` |
| Micro caption / monospace | 10–11, platform mono (`Menlo` / `monospace`), `neutral700` |
| Item name, price | 17 / 800 |
| Card and section heading | 22 / 800 |
| Screen title (h1) | 32–44 / 800, line-height 1.05, letter-spacing −0.02em (`-0.7` at 34pt) |
| Big numeral (price, points, count) | 40–56 / 800, in `accent` |

React Native does not accept em letter-spacing. Compute it: `letterSpacing = size * em`. At 44pt with −0.02em that is `-0.88`.

### 3.3 Rules and grid — the load-bearing part of the look

The system's identity is hard 2px rules, not shadows and not rounded cards. Shadows exist as tokens but the storefront barely uses them; do not reach for `elevation` to separate things — draw a rule.

The web grid draws `border-top` and `border-left` 2px on the container and `border-right` / `border-bottom` 2px on each cell, so every cell shows all four rules with no doubling. Reproduce exactly:

```tsx
<View style={{ borderTopWidth: 2, borderLeftWidth: 2, borderColor: color.divider,
               flexDirection: 'row', flexWrap: 'wrap' }}>
  {items.map(i => (
    <View key={i.id} style={{ width: '50%', borderRightWidth: 2, borderBottomWidth: 2,
                              borderColor: color.divider, padding: 16, gap: 10 }} />
  ))}
</View>
```

Use 2 device-independent points, **not** `StyleSheet.hairlineWidth`. On a 3× screen a hairline is a third of a point and the design collapses.

Column counts. The web's real breakpoints (`globals.css`) are: `.fp-grid-4` → 3 columns at 1000px; both `.fp-grid-4` and `.fp-grid-3` → 2 columns at 700px; **and both → 1 column at 440px**. The menu screen uses `fp-grid-3`. Because every mainstream phone is 440 CSS px or narrower (iPhone SE 375, iPhone 15 393, 15 Pro Max 430), **the website today shows a single column on a phone**, not two.

The app should use **2 columns** on a phone anyway — a 4:3 tile at half a 393pt screen is ~180pt wide, which is enough for the photo and the name, and one-column scrolling through 68 products is worse on a touch surface than on a mouse. That is a deliberate divergence, so it is listed as an exception in section 11; do not treat it as licence to diverge elsewhere. Deals stay **1 column**; a tablet in landscape may use 3.

If the web menu grid is later given a 2-column phone rule of its own, delete the exception rather than leaving the two disagreeing by accident.

### 3.4 Photography — flat-lay on a mobile screen

The Farm Pizza photography is overhead flat-lay on a plain ground, shot to be cropped. Rules for the app:

- **Aspect ratio 4:3** for grid tiles and 1:1 for the product hero. Always `resizeMode="cover"`; never letterbox onto the ground colour — the ground and the photo backgrounds are close enough that a letterbox reads as a rendering fault.
- **No rounding, no shadow, no border on the photo itself.** The surrounding cell's 2px rule is the frame.
- Serve images from the site: product `image` values resolve through `assetUrl()` to `/brand/<path>` (`apps/web/src/lib/config.ts`, `apps/web/src/app/brand/[...path]/route.ts`). The brand route is excluded from the middleware matcher, so it is safe to hit directly. Cache with `expo-image` (`cachePolicy="disk"`) and pass a `placeholder` blurhash if one is added later; today there is none.
- **Prefetch on the menu screen.** 68 products, roughly two thirds photographed, on a phone connection. Use `Image.prefetch` for the first screenful only; lazy-load the rest.
- `brand.photoStyle` is `colour` for Farm Pizza. It can be `grayscale` for other tenants, which the web does with a CSS filter. React Native has no equivalent; if a greyscale tenant ever ships, generate greyscale variants server-side rather than filtering on device. Note it and move on — it does not affect this build.

### 3.5 The monogram placeholder — a third of the menu, so get it right

22 of 68 products have no photo. `apps/web/src/components/Photo.tsx` draws a deliberate tile, not an empty frame, and the app must match it exactly:

- Tile background `color.surface` (`#eae9e9`), same aspect ratio as a photo.
- An inset border: 2px solid `neutral300` (`#d7d3d3`), inset 8pt from all four edges.
- **Two initials**, derived the same way: two or more words → first letter of each of the first two words ("Meat Feast" → MF); one word → its first two letters ("Hawaiian" → HA). Uppercase. Archivo 800, colour `neutral300`, letter-spacing −0.04em, centred.
- Web sizes the letters with `clamp(28px, 22cqw, 64px)` against the tile width. RN has no container queries: measure the tile with `onLayout` and set `fontSize = Math.min(64, Math.max(28, width * 0.22))`.
- A monospace caption bottom-left, 16pt from the left, 14pt from the bottom, 10pt, `neutral700` (`.fp-photo-cap`). It renders **only on the monogram tile**, never over a real photo — `Photo.tsx` puts it inside the `!src` branch.
- **Do not copy the web's caption string verbatim.** `MenuBrowser.tsx` passes `` `photo · ${name.toLowerCase()} · b/w` ``, and the `· b/w` is left over from the greyscale prototype — Farm Pizza's `photoStyle` is `colour`, so the site is currently printing "b/w" under colour-photography tiles. Use `photo · <product name lowercased>` in the app and raise the web string as a one-line fix.
- Mark the letters `accessibilityElementsHidden` / `importantForAccessibility="no"`; the product name is already read from the row beneath.

### 3.6 Mobile-specific decisions the web does not have to make

- **Light only.** The system has no dark palette. Set `userInterfaceStyle: "light"` in `app.json` and paint every background explicitly. Do not synthesise a dark theme — inverting a design built on a warm grey ground and one hot red produces something that is not this brand.
- **Status bar** dark content on `#f3f2f2`. Set `expo-status-bar` to `style="dark"` and `backgroundColor` `#f3f2f2` on Android.
- **Safe areas.** The sticky basket bar and the primary buttons sit above the home indicator; use `react-native-safe-area-context` insets, and keep the ruled top edge of the bar at full width edge to edge.
- **Splash and icon.** Ground `#f3f2f2`, the Farm Pizza wordmark from `config/farm-pizza/assets/logo.png`. Adaptive icon on Android: foreground the mark, background `#f3f2f2` — not the red, which vibrates badly at icon size against most wallpapers.
- **Haptics** on add-to-basket and on order-status changes (`expo-haptics`, `Light` and `Success`). This is the one thing the app should do that the web cannot, and it costs nothing.

---

## 4. Screens and navigation

Expo Router, file-based. Bottom tab bar of four, with everything else pushed as stacks. A tab bar of four keeps the basket permanently one tap away, which is the single biggest conversion lever on a takeaway app.

```
app/
  _layout.tsx                    # fonts, SafeAreaProvider, StripeProvider, QueryClient, push registration
  (tabs)/
    _layout.tsx                  # 4 tabs: Menu · Deals · Basket · Account
    index.tsx                    # MENU (default tab, the app opens here — not on a home screen)
    deals.tsx                    # DEALS
    basket.tsx                   # BASKET
    account.tsx                  # ACCOUNT
  product/[slug].tsx             # PRODUCT (modal on iOS, push on Android)
  deal/[slug].tsx                # DEAL BUILDER (full-screen modal, step by step)
  checkout/
    index.tsx                    # CHECKOUT (how / when / who)
    pay.tsx                      # PAY (Stripe PaymentSheet host)
  order/[id].tsx                 # TRACKER
  orders.tsx                     # ORDER HISTORY
  account/
    addresses.tsx
    referral.tsx
    preferences.tsx              # notifications + marketing consent — PHASE ONE (see 2.1.1)
    delete.tsx                   # account deletion — PHASE ONE, Apple 5.1.1(v)
  sign-in.tsx                    # phone → code, presented as a sheet from anywhere
  shops.tsx                      # SHOPS: address, hours, open state, tap to call
  legal/[page].tsx               # allergens, privacy, terms — WebView onto the live pages
```

### 4.1 Screen by screen

**MENU** (tab 1, launch screen). Sticky header: shop name, live open/closed pill, delivery-or-collection segmented control. Below: search field (max 280 wide on tablet, full width on phone), horizontal category chip rail with counts, then the 2-column ruled photo grid. Each cell: 4:3 photo or monogram → name (17/800) and price (17/800, right) → description (13, `neutral700`) → tags (V / VG / Spicy) and size note (11, `neutral600`) → an **Add** button when the product has no required choice, or **Choose options** when it has sizes or a required group. Sold out shows a `Sold out` tag and no button. Pull to refresh re-fetches the menu. Search filters name and description across the whole menu (it does not find "vegan" or "nut free" — same limitation as web; do not silently improve it without also improving web).

**PRODUCT**. Hero photo 1:1. Name, price, description, diet tags, allergen line. Sizes as ruled radio rows. Single-choice groups (Base) as radios; multi-choice groups (Extra toppings, up to 8) as toggle chips with surcharges. Running unit price updates live. Quantity stepper 1–20. Kitchen note, 200 characters, counted. Pinned bottom bar: total and **Add to basket**, disabled until every required group is answered. On add: haptic, toast "Added — View basket", stay on the screen.

**DEALS** (tab 2). One-column ruled rows: price in 56/800 accent, title, contents, terms, **Build the deal**. Below, the promo code list with **Apply to basket**. (Server-side note: the public code list currently includes personal `THANKS-XXXXX` reward codes and expired codes. Filter them out in the new mobile endpoint — see 5.3.)

**DEAL BUILDER**. Full-screen, one slot at a time, with a ruled checklist of what is chosen and what is left, a running total including paid extras, and a pinned bar disabled until every slot is filled. Re-validated by the server on every re-price.

**BASKET** (tab 3, with a badge showing item count). Ruled line rows: name, detail, quantity stepper, remove, line total. Then "Goes well with" as a horizontal strip. Summary block with a 2px ink border: subtotal, delivery or collection line, discount, 2px rule, total in 28/800. Promo field with **Apply** and the server's message. **Go to checkout** disabled while the server reports errors. Every mutation re-prices against `/api/basket/price`; debounce 300 ms.

**CHECKOUT**. Three ruled sections then pay. *How*: delivery with address and postcode, or collection with a branch. *When*: ASAP, or a 15-minute slot for today or tomorrow; ASAP disappears when the shop is shut or paused. *Who*: name, mobile, optional email, marketing tick box (unticked by default — do not pre-tick it). Signed-in customers get name, phone, email and last address pre-filled. Guest checkout must work without an account.

**PAY**. Stripe PaymentSheet — see section 7. Cash on collection where config allows.

**TRACKER**. Status headline, estimated time, five-step ruled progress (Received · Accepted · In the oven · On its way / Ready · Done), address or collection branch, itemised order with modifiers and deal contents, totals, paid or cash. Live updates: see 5.3 on why the app polls rather than using the SSE stream. Tap-to-call the shop. **Order again**.

**ACCOUNT** (tab 4). Signed out: a short pitch and **Sign in with your mobile**. Signed in: name and number, recent orders (last 20, view / reorder), saved addresses, referral panel with the code, a Copy button and a native share sheet, notification and marketing preferences, sign out, and **Delete my account**. **No Crust Club card** — `account/page.tsx` renders one unconditionally, outside any `loyalty.enabled` check, so every signed-in customer on the website is currently shown a points balance for a scheme that is switched off and will read 0 forever. Do not repeat that.

Delete must be reachable in the app, not a phone number (Apple 5.1.1(v)). Confirm destructively — a typed confirmation or a two-step sheet, not a single tap — then call `DELETE /api/account`, wipe secure storage and the basket, and drop to the signed-out state. Tell the customer plainly what is kept: the orders themselves survive, anonymised, because `/privacy` commits the shop to a six-year retention obligation.

**SIGN IN**. Presented as a sheet from anywhere that needs it. Phone → six-digit code → done. Surface the server's own strings rather than inventing friendlier ones — they are already written for a customer. From `otp/send` and `otp/verify`: `"Too many codes requested. Try again in 10 minutes."` (429, after 3 codes in 10 minutes), `"Wrong code."` (400, on each wrong attempt), `"Code expired. Request a new one."` (400 — note this is returned both when the code has genuinely expired **and once `attempts >= 5`**, so a customer who has burned five tries sees "expired", not "too many attempts"; do not write UI that assumes the two are distinguishable), `"Enter a valid UK mobile number."`, `"Could not send SMS right now."` (502, when Twilio actually fails — but see 5.4.6: a *missing* Twilio config returns 200 and sends nothing).

**SHOPS**. Branch name, address, open/closed with closing time, delivery fee and minimum, collection and delivery estimates, tap-to-call, and a seven-day hours table. **No map** — the web map is a drawn placeholder with meaningless pins. Use `Linking.openURL` to hand the address to Apple Maps or Google Maps instead; that is better than a fake map and free.

**LEGAL**. Allergens, privacy and terms as a `WebView` onto the live pages so one edit updates both products. Apple requires a reachable privacy policy; this satisfies it.

---

## 5. Talking to the backend

### 5.1 Base URL — read this before writing the API client

`apps/web/src/middleware.ts` **301-redirects any host that is not the canonical `NEXT_PUBLIC_SITE_URL` host** (localhost excepted), and legacy hosts lose their path entirely. The matcher covers `/api/*` apart from the Stripe webhook. Consequences:

- The app must call the **exact canonical host**, no `www.`, no Coolify preview URL, no trailing-slash variance. A wrong host silently turns a `POST /api/checkout` into a 301 to `/` and the app sees an HTML page where it expected JSON.
- `fetch` in React Native follows redirects and converts the redirected POST to a GET. The failure will look like a parse error, not a redirect. Log the final URL on every non-2xx.
- Put the base URL in `app.config.ts` under `extra`, one per EAS profile: development → the LAN dev server, preview → staging, production → the live domain.

Set `Accept: application/json` and a `X-LF-Client: mobile/<version>` header on every request so server logs can tell app traffic from web.

### 5.2 Endpoints reusable as they are

All are under the canonical origin. "Auth" means the customer bearer token from 5.4.

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| POST | `/api/basket/price` | `{ lines: BasketLine[], fulfilment, postcode?, locationKey?, promoCode? }` | `PricedBasket` + `location` (`key, name, deliveryFee, minOrder, open, paused`) — **`location` is `null`** when no branch resolves (undeliverable postcode) | Optional |
| POST | `/api/basket/upsells` | `{ products: string[] }` (slugs already in the basket) | `{ items: [{ name, href, price }] }`, up to 6 — note the `items` wrapper | No |
| GET | `/api/checkout/context` | — | shop name, fulfilment, cash flags, `stripe` (publishable key + account id), per-branch open/paused/nextOpen/hours/prep/delivery minutes and up to 96 pre-order slots as ISO strings, and the signed-in customer's name/phone/email/addresses. **`stripe` is `null` whenever `stripeEnabled()` is false** — which is today's state (7.1) | Optional (fills `customer` when present) |
| POST | `/api/checkout` | the basket body plus `name, phone, email, address?, notes, scheduledFor?, paymentMethod, marketingOptIn` | `{ orderId, clientSecret, total }` for card, `{ orderId, cash: true }` for cash | Optional |
| POST | `/api/postcode/check` | `{ postcode }` | `{ ok, location: { key, name, deliveryFee, minOrder, band, open, etaMinutes } }` or `{ ok: false, message }` | No |
| POST | `/api/account/otp/send` | `{ phone }` | `{ ok }` (plus `devCode` outside production when SMS is dry-run) | No |
| POST | `/api/account/otp/verify` | `{ phone, code }` | `{ ok }` — **needs the change in 5.4.2** | No |
| POST | `/api/account/logout` | — | `{ ok }` — **needs the change in 5.4.4** | Yes |
| DELETE | `/api/account/address` | `{ id }` | `{ ok }` | Yes |
| POST | `/api/orders/[id]/reorder` | — | `{ lines, errors }` re-priced against today's menu | Should be, currently none |

The `BasketLine` and `PricedBasket` shapes are defined in `apps/web/src/lib/basket-types.ts`. **Copy that file into the app verbatim** (or, better, move it to `packages/shared` and import it from both) so the two ends cannot drift. It is deliberately free of server imports for exactly this reason.

Two things about the basket body that are easy to miss and are enforced by `BasketBody` in `apps/web/src/lib/checkout.ts`:

- **`locationKey` is part of the contract** (string, max 40) and the web basket sends it. It is how a *collection* order names the branch it is being collected from; `resolveLocation()` uses postcode for delivery and `locationKey` for collection. Omit it and a collection order falls back to the first branch — invisible today with one branch in config, wrong the moment Basildon is added.
- Server-enforced limits, which the app must mirror client-side so the customer is stopped before the round trip: 50 lines per basket, `qty` 1–20, `notes` 200 characters per line, 30 modifiers per line, 20 deal components, `postcode` 10 characters, `promoCode` 30. Order-level `notes` is 300 (on `/api/checkout`, not the basket body).

### 5.3 New endpoints to write — precise list

These do not exist. Write them in `apps/web/src/app/api/` before the app can work. Each is small; all of them together are perhaps a day's server work.

**1. `GET /api/menu`** — *the biggest gap.* The web renders the menu server-side, so there is no JSON menu anywhere. Return the shape the app needs, flattened and pre-resolved, from `getMenu()` in `apps/web/src/lib/menu.ts` (which is already cached with the `menu` tag):

```jsonc
{
  "version": "<config hash or updatedAt max>",   // so the app can skip an unchanged payload
  "categories": [
    { "slug": "pizzas", "name": "Pizzas", "count": 30,
      "products": [
        { "slug": "original", "name": "Original", "description": "...",
          "image": "/brand/products/original.jpg",   // already assetUrl()-resolved, or null
          "tags": ["vegetarian","popular"],          // raw tag values — see below
          "allergens": ["gluten","milk"], "soldOut": false,
          "sizes": [{ "key": "medium", "name": "10\" Medium", "price": 1364, "soldOut": false }],
          "modifierGroups": [
            { "key": "base", "name": "Base", "minSelect": 1, "maxSelect": 1,
              "modifiers": [{ "key": "tomato", "name": "Tomato base", "price": 0, "soldOut": false }] }
          ] } ] } ]
}
```

Three details in that shape that are load-bearing:

- **`tags` are raw, not display labels.** `Product.tags` holds `vegetarian | vegan | spicy | new | popular`. The `V` / `VG` / `Spicy` / `New` chips are a client-side map — `TAG_LABEL` in `MenuBrowser.tsx` and in the product page — and `popular` has no chip at all. Return the raw values and port `TAG_LABEL` into the app; do not have the server invent "V", or the two ends will drift the first time a tenant adds a tag.
- **`ProductSize.soldOut` is a real column**, separate from `Product.soldOut`. A single size can be off while the product is on. Return it per size and grey that radio row, or the customer picks a 20" that pricing will then reject.
- Sizes come back in `sortOrder`; Farm Pizza's five pizza sizes are `small | medium | large | xlarge | xxlarge`, named `7" Small` … `20" XX-Large`. Prices in the JSON are **pence** (`1364`), even though `config/farm-pizza/menu.json` stores pounds (`13.64`) — the seeder converts. Read from `getMenu()`, never from the config file.

Support `If-None-Match` / `ETag` on `version`. Cache-Control `public, max-age=60` to match the server cache.

**2. `GET /api/deals`** — the eight active deals with slots, allowed products and sizes per slot, price, description and terms, so the deal builder can run natively.

**3. `GET /api/promos/public`** — the publicly listable codes. Must **exclude** codes owned by a specific customer (the `THANKS-XXXXX` referral rewards) and codes past their end date. The web `/deals` page currently lists both, which is a leak the app must not copy.

**4. `GET /api/orders/[id]`** — the tracker payload as JSON: status, label, ETA, fulfilment, branch, address, items with modifiers and deal components, totals, payment state, reject reason. The web page renders this server-side; there is no JSON route. Accept the bearer token and, when present, verify the order belongs to that customer; without a token fall back to id-only access so guest orders still track (matching current web behaviour, which you should plan to tighten later).

**5. `GET /api/orders?limit=20`** — the signed-in customer's order history. Bearer required. Returns id, number, createdAt, status, fulfilment, total and a one-line item summary.

**6. `GET /api/orders/[id]/status`** — a tiny polling endpoint returning only `{ status, label, etaAt, etaMinutes, rejectReason, fulfilment }`. **Use this instead of the SSE stream at `/api/orders/[id]/events`.** React Native has no native `EventSource`, the stream re-queries the database every 3 seconds per viewer, and mobile networks and background transitions break long-lived connections badly. Poll every 10 seconds while the tracker is foregrounded, stop when backgrounded (push takes over), stop on a terminal status.

**7. `GET /api/account`** — the signed-in customer: name, phone, email, marketing consent, addresses, referral code and referral stats. Bearer required. Today `/account` is a server-rendered page and mints the referral code as a side effect of rendering — move that minting into this endpoint.

**8. `POST /api/account/profile`** — update name and email. The web cannot do this either; it is the minimum needed for an app account screen to not feel broken, and it is a small extension of the existing customer update in the checkout route.

**9. `POST /api/account/marketing`** — `{ optIn: boolean }`. Writes `Customer.marketingOptIn` and, when turning off, sets `optOutAt` and `optOutSource: "app"` exactly as `apps/web/src/lib/opt-out.ts` does for an SMS STOP. This is the control the privacy page already claims exists ("opt out from your account page") and does not.

**10. `DELETE /api/account`** — delete the account. **Required by Apple** (Guideline 5.1.1(v): any app supporting account creation must support in-app deletion). Anonymise rather than hard-delete: clear name, email, addresses, referral code, set `marketingOptIn` false, blank the phone to a tombstone value, and keep the orders for the shop's six-year retention obligation stated on `/privacy`. Delete all `Session` rows and all `PushDevice` rows for that customer.

**11. `POST /api/push/register`** — `{ token, platform: "ios"|"android", deviceId, appVersion }`. Bearer optional: register anonymously so a guest can still get order updates, and attach `customerId` when a token is present. Upsert on `token`.

**12. `POST /api/push/unregister`** — `{ token }`. Called on sign-out and on notification-permission revocation.

**13. `GET /api/config/mobile`** — a small bootstrap document the app fetches on launch: shop name, phone, branches with hours and open state, fulfilment options, cash flags, referral terms, `minSupportedVersion` and an optional `message` for a forced-update or maintenance banner. Ship `minSupportedVersion` from day one — it is the only lever you have over a customer who never updates.

**New Prisma model** (`packages/db/prisma/schema.prisma`), plus a migration:

```prisma
model PushDevice {
  id          String   @id @default(cuid())
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  customerId  String?
  customer    Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  token       String   @unique          // Expo push token
  platform    String                    // "ios" | "android"
  deviceId    String   @default("")
  appVersion  String   @default("")
  lastSeenAt  DateTime @default(now())
  disabledAt  DateTime?                 // set when Expo reports DeviceNotRegistered
  createdAt   DateTime @default(now())

  @@index([clientId, customerId])
}
```

### 5.4 Authentication — cookies do not travel; use a bearer token

#### 5.4.1 What exists today

`apps/web/src/lib/auth.ts` signs an HMAC-SHA256 token over a JSON payload `{ role, sub, exp }` and stores it in an **httpOnly, SameSite=Lax, Secure cookie** named `lf_customer`, TTL 90 days. For a customer, `sub` is a random 24-byte base64url string that is also the `token` column of a **`Session` row in the database**, which is what makes revocation possible. `currentCustomer()` in `apps/web/src/lib/session.ts` reads the cookie, verifies the HMAC, then looks the session up and checks `expiresAt`.

The important point: **the signed string is already a self-contained bearer credential.** It is signed, it carries an expiry, and it points at a revocable database row. You do not need a new token format, a new signing scheme, JWT libraries, or refresh tokens. Anything that invents a second auth system here is wrong.

#### 5.4.2 Change 1 — return the token in the body for native clients

In `apps/web/src/app/api/account/otp/verify/route.ts`, after minting the session, return the signed token alongside setting the cookie:

```ts
const signed = await signToken({ role: "customer", sub: token });
const res = NextResponse.json({
  ok: true,
  // Native clients cannot use the cookie. Same credential, handed over explicitly.
  token: req.headers.get("x-lf-client")?.startsWith("mobile") ? signed : undefined,
  expiresAt: new Date(Date.now() + 90 * 86400_000).toISOString(),
});
res.cookies.set(COOKIE.customer, signed, cookieOptions("customer"));
return res;
```

Gate it on the `X-LF-Client` header (or a `?client=mobile` query) so a browser never receives the token in a readable body — that would hand an XSS a credential the httpOnly cookie was protecting.

#### 5.4.3 Change 2 — accept the token from the Authorization header

In `apps/web/src/lib/session.ts`, make `currentCustomer()` read the header first, then fall back to the cookie. Nothing else in the codebase changes, because every route already calls `currentCustomer()`:

```ts
export async function currentCustomer() {
  const h = await headers();
  const bearer = h.get("authorization")?.replace(/^Bearer\s+/i, "");
  const jar = await cookies();
  const raw = bearer || jar.get(COOKIE.customer)?.value;
  const p = await verifyToken(raw, "customer");
  if (!p) return null;
  const session = await prisma.session.findUnique({
    where: { token: p.sub },
    include: { customer: { include: { addresses: { orderBy: { createdAt: "desc" } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.customer;
}
```

Because the header is checked first, a shared device or a WebView cannot have its cookie silently override the app's token.

#### 5.4.4 Change 3 — logout must accept the header too

`apps/web/src/app/api/account/logout/route.ts` currently reads only `req.cookies`. Read the bearer as well, so signing out of the app actually deletes the `Session` row rather than leaving a live 90-day credential on the device.

#### 5.4.5 App-side rules

- Store the token in **`expo-secure-store`** (Keychain / Android Keystore). Never `AsyncStorage`, never Redux persistence, never a log line.
- Send `Authorization: Bearer <token>` on every authenticated call. Do not send cookies at all — set `credentials: "omit"`.
- On **401**, clear the token, drop to the signed-out state and re-present the sign-in sheet. Do not retry, and do not build a refresh-token flow: a 90-day session that the customer renews with a six-digit text is the right ergonomics for a takeaway app.
- On **sign-out**, call `/api/account/logout` with the bearer, call `/api/push/unregister`, then wipe secure storage. If the network call fails, wipe locally anyway and let the session expire.
- The token is a credential, so it must not appear in Sentry breadcrumbs, in a `console.log`, or in a deep link.

#### 5.4.6 The hard dependency nobody should discover late

**No longer true as of 6 September 2026 — sign-in no longer requires Twilio.** `/api/account/otp/send` now takes an `identifier` that is either a mobile number or an email address, and sends the six-digit code by whichever was given. The app should offer the same single field. Email is the free route and the one to lead with.

The original warning is kept below because the failure mode it describes is still live for the SMS half, and is still the worst kind:

**Sending a code by text requires Twilio.** With `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` unset, `sendSms` writes the code to the server log and returns `{ ok: true }`, so the endpoint reports success and nobody ever receives a code. On the website this is survivable because guest checkout exists. In an app, "create an account" that silently never texts is a store rejection and a bad first impression.

So: **email sign-in must be the default offered in the app**, and Twilio must be live before the SMS option is shown. Until it is, the app must keep guest checkout fully working and must never gate the ordering path behind sign-in. Test the OTP path against a staging deployment with real Twilio credentials, not against a dry-run local server.

Rate limits already enforced server-side and to be surfaced verbatim in the UI: 3 codes per 10 minutes, 5 wrong attempts, 10-minute code expiry, 90-day session.

---

## 6. Push notifications

### 6.1 Transport

`expo-notifications` with **Expo Push (EAS)**. Register the device on launch (or after the first order, which converts better than a cold permission prompt), post the token to `/api/push/register`, and send from the server through `https://exp.host/--/api/v2/push/send` in a new `sendPush()` in `apps/web/src/lib/notify.ts`, sitting alongside `sendSms` and `sendEmail`.

iOS needs an APNs key uploaded to Expo (`eas credentials`); Android needs the FCM V1 service-account JSON uploaded to the Expo project. Both are one-off setup steps done during 9.2.

### 6.2 Transactional pushes — sent to everyone, no consent check

These mirror the SMS the server already sends in `notifyCustomer()` (`apps/web/src/lib/orders.ts`). They are service messages about a transaction the customer started, so they are **not** marketing under PECR and are **not** gated on `marketingOptIn`.

| Trigger (order status) | Push copy | Notes |
|---|---|---|
| `placed` | "Order #1234 received (£24.50). We'll text when the kitchen accepts it." | Only when the app placed the order; suppress if the app is foregrounded on the tracker. |
| `accepted` | "Order #1234 accepted. Estimated delivery 19:42." / "…ready for collection at 19:20." | The highest-value push in the whole system. |
| `preparing` | *(no push)* | Adds nothing; the tracker shows it. |
| `ready` | Collection only: "Order #1234 is ready to collect." | Delivery orders get nothing here, matching SMS. |
| `out_for_delivery` | "Order #1234 is on its way." | |
| `rejected` | "Sorry, we couldn't take order #1234. Your payment will be refunded." | Include the reject reason when present. |
| Basket abandoned | *(no push in phase one)* | The existing recovery text is SMS and consent-gated; do not add a second channel to it without deciding the consent question first. |

Every transactional push carries `data: { orderId }` and deep-links to `/order/[id]`.

**Do not double up.** The customer currently gets an SMS at each of these steps. Sending an identical push at the same moment is irritating and, at 4p a message, wasteful. Recommended rule: **if the customer has a registered, enabled push token for this order's customer, skip the SMS for `accepted`, `ready` and `out_for_delivery` and push instead; always keep the SMS for `placed` and `rejected`** (order confirmation and money-back are too important to depend on a notification permission). Implement that choice in one place — `notifyCustomer()` — not in the app.

### 6.3 Marketing pushes — consent-gated, and the rule that matters most

**A customer who has opted out of SMS marketing must never receive a marketing push.** This is the requirement to get right; everything else here follows from it.

The system already has exactly one consent flag: `Customer.marketingOptIn`, with `optOutAt` and `optOutSource` kept as PECR evidence. `apps/web/src/lib/opt-out.ts` clears it when a customer texts STOP; `audienceFor()` in `apps/web/src/lib/marketing.ts` filters every automation audience on `marketingOptIn: true` plus a non-empty phone; `sendCampaign` does the same for one-off campaigns.

**Design decision: one consent flag, all channels. Do not add `pushMarketingOptIn`.**

Reasoning: a separate push flag means a customer who has texted STOP can still be marketed to, on a channel that is more intrusive than SMS, from a business that has been told to stop. That is both a PECR problem and a reputational one, and it would be nobody's intent — it would happen because two flags drifted. One flag, one STOP, nothing to get wrong. The cost is that a customer cannot keep push offers while dropping SMS offers; that is an acceptable trade for a pizza shop.

Concretely:

1. Marketing push audiences use **the same `audienceFor()` query** as SMS, with the phone filter swapped for "has at least one enabled `PushDevice`". Do not write a second audience builder — extend the existing one with a `channel` parameter so the consent clause can only ever be written once.
2. `handleInbound()` in `opt-out.ts` needs **no change** for consent (it already clears `marketingOptIn`), but it is the natural place to note in a comment that clearing the flag also stops push. Add that comment so the next person does not "fix" it.
3. `saveAutomation` currently hard-codes `channel: "sms"`. If push automations are wanted, that must change; until it does, marketing push exists only as one-off campaigns.
4. Every marketing push must carry a visible way out: the notification opens the app on a screen with a "Turn off offers" control that calls `/api/account/marketing`, which sets the same flag and the same `optOutAt` evidence. iOS and Android's own "turn off notifications" is not sufficient, because it silences transactional pushes too.
5. **The review-request text is a live exception.** `sendReviewRequests()` deliberately ignores `marketingOptIn`. Whatever the merits of that on SMS, **do not replicate it on push.** A review request is a marketing push and must be consent-gated.

### 6.4 Ordering and quiet hours

Marketing pushes obey the shop's own trading pattern: never before 11:00 or after 21:30 `Europe/London`. There is no quiet-hours rule in the codebase today because campaigns are sent by hand; add the check inside `sendPush()` for `kind !== "transactional"` so it cannot be bypassed by a hurried "Send now".

### 6.5 Permission timing

Do not ask on first launch. Ask **immediately after the first order is placed**, on the tracker, with a one-line reason ("Get a notification when the kitchen accepts your order"). That is the moment the permission is obviously in the customer's interest, and it produces a far higher grant rate than a cold prompt. If declined, do not ask again; show the control in Account preferences instead.

### 6.6 Reporting — do not repeat the dry-run defect

`sendSms` returns `{ ok: true }` when Twilio is not configured, which is why campaign spend figures in `/admin/marketing` can be entirely fictional. `sendPush()` must return `{ ok: false, error: "not configured" }` when the Expo credentials are missing, and must record the actual Expo receipt outcome (`DeviceNotRegistered` → set `PushDevice.disabledAt`).

If marketing pushes write `MarketingSend` rows for attribution, set `kind: "push"` explicitly and `cost: 0`. `SMS_COST_PENCE` is hard-coded at 4p; a push priced at 4p would silently corrupt the marketing P&L. Note also the existing bug that `sendCampaign` never sets `kind`, so campaigns are filed as automations — do not inherit that; set `kind` on every row you write.

---

## 7. Payments

### 7.1 Blocker first

Card payment is **not currently live**. `stripeEnabled()` requires `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; `config/farm-pizza/client.json` has `stripeAccountId: ""`, so even once keys are set, money lands in whichever Stripe account the platform key belongs to rather than in a Stripe account owned by the shop. `cashOnDelivery` is false. Today the only working payment route is **cash on collection**.

An app that can only take cash on collection is not worth shipping. Therefore, before any app work starts:

1. Create or connect the shop's Stripe account and put its id in `payments.stripeAccountId`.
2. Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET` in the deployment. Without the webhook secret the webhook rejects every event and orders only get rescued when the customer happens to open the tracker.
3. Verify a live card payment, a decline and a refund on the website first.

### 7.2 What is already right for native

`/api/checkout` creates the PaymentIntent server-side, for the amount **the server calculated**, with `automatic_payment_methods: { enabled: true }` and an idempotency key of `pi_<orderId>`. That means:

- Apple Pay and Google Pay need **no server change** — they are payment methods on the same intent.
- A double-tap cannot create two charges.
- The client never sees or influences the amount.

The app calls exactly the same endpoint the web does and receives `{ orderId, clientSecret, total }`.

### 7.3 Native implementation

`@stripe/stripe-react-native`, wrapped once at the root:

```tsx
// cfg.stripe is NULL whenever the server has no Stripe keys — today's state (7.1).
// Guard it: an unguarded cfg.stripe.publishableKey crashes the app at the root.
<StripeProvider
  publishableKey={cfg.stripe?.publishableKey ?? ""}   // from /api/checkout/context
  stripeAccountId={cfg.stripe?.accountId ?? undefined}
  merchantIdentifier="merchant.com.farmpizza"         // must match the Apple Pay merchant ID
  urlScheme="farmpizza"                               // for 3-D Secure return
>
```

When `cfg.stripe` is null the app must hide the card option entirely and offer only cash on collection, with the shop's phone number — not show a card form that 503s.

Then PaymentSheet, not the card field:

```ts
await initPaymentSheet({
  merchantDisplayName: 'Farm Pizza',
  paymentIntentClientSecret: clientSecret,
  applePay: { merchantCountryCode: 'GB' },
  googlePay: { merchantCountryCode: 'GB', currencyCode: 'GBP', testEnv: !isProduction },
  returnURL: 'farmpizza://stripe-redirect',
  allowsDelayedPaymentMethods: false,
  appearance: {
    colors: { primary: '#ec3013', background: '#f3f2f2', componentBackground: '#eae9e9',
              componentBorder: 'rgba(32,30,29,0.4)', primaryText: '#201e1d' },
    shapes: { borderRadius: 0, borderWidth: 2 },
    primaryButton: { colors: { background: '#ae1800', text: '#f3f2f2' } },
  },
});
const { error } = await presentPaymentSheet();
```

Two notes on that appearance block, both deliberate:

- `colors.primary` is `#ec3013` (the accent, used for focus and active states inside the sheet) but `primaryButton.background` is **`#ae1800`**, matching `.btn-primary` in `modernist.css`. See 3.1 — `#f3f2f2` on `#ec3013` fails AA.
- It does not use `brand.primary`. The web's `PayStep.tsx` reads the `--brand-primary` CSS variable and falls back to `#C8322B`, and also sets `borderRadius: "10px"` and `fontFamily: "Inter"` — three values that predate the Modernist port and match nothing else on the site. (`--brand-primary` is now set in `layout.tsx` and read *only* by `PayStep.tsx`; nothing else on the storefront uses it.) The app should be right — zero radius, 2px borders, Archivo, `#ae1800` — and `PayStep.tsx` should be corrected to match rather than the app copying it.

### 7.4 What changes versus the web checkout

| Web | App |
|---|---|
| Stripe **PaymentElement** embedded in a second step of the page | Stripe **PaymentSheet**, presented as a native modal |
| Wallets appear as buttons inside the element | Apple Pay / Google Pay appear as the sheet's primary action on supported devices, and should also appear as an express button **above** the checkout form when `isPlatformPaySupported()` returns true |
| 3-D Secure redirects in the same browser tab | 3-D Secure opens an in-app browser and returns via `farmpizza://stripe-redirect`; `urlScheme` and `returnURL` must both be set or the customer is stranded |
| Payment confirmed, then the tracker reconciles with Stripe if the webhook is late | Identical — after `presentPaymentSheet()` resolves, navigate to the tracker and let the existing reconciliation run |
| Cash on collection offered where config allows | Same, unchanged |

### 7.5 App Store rules on payments

Food for delivery or collection is a **physical good and a real-world service**. Apple's Guideline 3.1.5(a) and 3.1.3(e) put it outside In-App Purchase: you must use Stripe, and using IAP would itself be a rejection. Do not let anyone "helpfully" add IAP. Google Play's Payments policy says the same for physical goods.

Practical consequences: no IAP entitlement is needed; the Apple Pay capability **is** needed; and the app must not describe anything as a "subscription" or "digital content".

### 7.6 Out of scope, for parity

No tips (the web has none), no saved cards (the web has none — Stripe would need a Customer object and a SetupIntent), no split payments, no gift cards.

---

## 8. State, offline and versioning

- **Server state:** TanStack Query. `menu` staleTime 60 s (matching the server cache), `checkout/context` staleTime 30 s, order status refetch every 10 s while foregrounded.
- **Basket:** local, persisted with `AsyncStorage` (or MMKV) under the same conceptual key as the web (`lf-basket` — the zustand `persist` key in `apps/web/src/components/basket/store.ts`). **Not `expo-secure-store`:** SecureStore is for small secrets and does not reliably store values over ~2KB on iOS, and a 50-line basket carrying the cached `name` / `detail` / `unitPrice` / `lineTotal` display fields is comfortably past that. SecureStore holds the bearer token and nothing else (5.4.5). The basket does not sync between devices — same as the web, which stores it in `localStorage`. Do not build basket sync in phase one; it needs a server-side basket the platform does not have. Hard limits to enforce client-side, matching the server: 50 lines per basket, quantity 1–20 per line, item notes truncated at 200 characters, order notes at 300.
- **Offline:** show the last cached menu with a "You're offline" bar. Block checkout entirely when offline — never queue an order for later submission; prices, availability and opening hours will have moved.
- **Version gate:** `/api/config/mobile` returns `minSupportedVersion`. Below it, show a blocking "Update Farm Pizza" screen with a store link. This is the only way to retire a broken client.
- **Deep links:** scheme `farmpizza://` plus universal / app links on the canonical domain, so `/order/<id>` and `/r/<code>` open in the app when it is installed. The referral short link `/r/CODE` currently sets a cookie and redirects to the menu; the app equivalent should store the code locally and pre-fill the promo box, exactly as the web basket does.
- **Crash and error reporting:** Sentry via `@sentry/react-native`, with the bearer token and phone numbers scrubbed.

---

## 9. Build, signing and store submission

### 9.1 Project setup

- Expo SDK, managed workflow, TypeScript, Expo Router. Put the app in this monorepo at `apps/mobile/` so it shares `packages/shared` types with the web (`pnpm-workspace.yaml` already globs `apps/*` and `packages/*`; check `metro.config.js` monorepo settings — Metro needs `watchFolders` and `disableHierarchicalLookup` for pnpm's symlinked store).
- `app.config.ts` (not static `app.json`), reading per-profile values from `process.env` so the API base URL differs between development, preview and production.
- Bundle identifiers: iOS `com.farmpizza.app`, Android `com.farmpizza.app`. **Choose these once** — changing an identifier after release means a new app listing and losing every install. Two constraints behind that suggestion:
  - Reverse-DNS should come from a domain the business actually controls. `config/farm-pizza/client.json` has `domain: "farm-pizza.com"` (legacy: `order.farm-pizza.com`, `farm-pizza.uk`, `farmpizzatakeaway.co.uk`). There is **no `farmpizza.co.uk`**, so anything of the form `uk.co.farmpizza.*` is inventing a domain. This matters beyond tidiness: the universal-link and app-link association files in section 8 must be served from the canonical domain, and Apple/Google check them against the identifier.
  - Android package names must be valid Java identifiers, so `com.farm-pizza.app` is illegal — the hyphen has to be dropped, which is why both platforms get `com.farmpizza.app` rather than a literal transcription of the domain.
  - **Confirm the canonical domain with the owner before the first build** (it is also decision 1 in section 12). If the shop is moving to a different domain, set the identifier from that one, not from `farm-pizza.com`.
- `userInterfaceStyle: "light"`, `orientation: "portrait"` for phone (allow landscape on tablet only if you build tablet layouts; otherwise lock portrait).

### 9.2 Credentials

Let **EAS manage credentials** unless there is a reason not to. It generates and stores the iOS distribution certificate and provisioning profile, and the Android upload keystore.

- **Apple:** Apple Developer Program membership (£79 + VAT a year at the time of writing — check the current price) in the business's own Apple ID, not a personal one and not the agency's. Set up an App Store Connect app record, an Apple Pay merchant identifier (`merchant.com.farmpizza`, matching 9.1), and an APNs key for push. `eas credentials` uploads the APNs key to Expo.
- **Google:** Play Console developer account, one-off $25, again owned by the business. Create the app record, upload the FCM V1 service-account JSON to the Expo project for push, and register the app signing key (use Play App Signing; EAS produces the upload key).
- **Back up** the Android upload keystore and note where the Apple account credentials live. Losing the keystore without Play App Signing enabled means the app can never be updated.

### 9.3 EAS profiles

```jsonc
// eas.json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal",
                     "env": { "EXPO_PUBLIC_API_URL": "http://192.168.1.x:3000" } },
    "preview":     { "distribution": "internal",
                     "env": { "EXPO_PUBLIC_API_URL": "https://staging.farmpizza.example" } },
    "production":  { "autoIncrement": true,
                     "env": { "EXPO_PUBLIC_API_URL": "https://<canonical domain>" } }
  },
  "submit": { "production": { "ios": { "appleId": "…", "ascAppId": "…" },
                              "android": { "track": "internal" } } }
}
```

Build with `eas build -p ios --profile production` / `-p android`, submit with `eas submit -p ios` / `-p android`. Use `eas update` (OTA) only for JavaScript-only fixes; anything touching native modules needs a store build.

### 9.4 Test devices and staging

Test against a **staging deployment with real Twilio and real Stripe test keys**, not a local dry-run server. The two things most likely to be wrong on first submission — SMS never arriving and card payments 503-ing — are both invisible in a dry-run environment.

### 9.5 Store listing assets

Screenshots at whatever sizes App Store Connect and Play Console demand **on the day** — Apple has changed the required set more than once recently (6.9" is the current anchor, with smaller sizes derived rather than uploaded), so read the console rather than trusting this line. Plus: app icon 1024×1024 (no alpha for iOS); short and full descriptions; a support URL and a **privacy policy URL** (use the live `/privacy`, which exists); category Food & Drink; content rating questionnaire — no alcohol (the drinks category is nine soft drinks and a milkshake), no user-generated content, no gambling → lowest rating.

### 9.6 Review-risk items, in order of likelihood

1. **Account deletion (Apple 5.1.1(v)).** The app supports account creation (SMS OTP), therefore it **must** offer in-app account deletion. Today the privacy page tells customers to phone the shop. Endpoint 10 in section 5.3 is not optional — this is the single most common rejection for apps like this.
2. **Sign-in that does not work for the reviewer.** Apple's reviewer is in California and cannot receive a UK SMS. Provide a **demo account** in App Store Connect notes with a fixed phone number and a fixed bypass code, gated server-side to that one number, or make the whole ordering path reachable without signing in (which it should be anyway) and say so in the review notes.
3. **Login wall (Apple 5.1.1(i)).** Do not require an account to browse or to order. Guest checkout must work.
4. **Sign in with Apple (Apple 4.8).** Only triggered if you add a third-party social login. SMS OTP alone does **not** trigger it. If Google sign-in is added in phase two, Sign in with Apple becomes mandatory on iOS.
5. **Push permission prompt with no context** — a bare prompt on first launch is a common "spam" flag. See 6.5.
6. **Payments.** Ensure nothing in the app reads as digital content or a subscription. Physical food is correct outside IAP.
7. **Placeholder content.** Anything that says "coming soon", any empty tab, any screen showing sample data (the seeded reviews, the placeholder drivers) is a 4.2 rejection. Ship complete screens or no screen.
8. **Android data safety form.** Must accurately declare: phone number, name, email, delivery address, approximate location (postcode), order history, push token; all "collected", "not shared with third parties for advertising", encrypted in transit, deletable.
9. **Permissions with no purpose string.** Every iOS permission needs an `Info.plist` usage description. The app should need very few — push does not need one, and you should not request location, camera or contacts at all in phase one.

### 9.7 Realistic timeline

Assumes one competent developer, the server work in 5.3 done first, and the phase-zero blockers cleared.

| Stage | Duration | Notes |
|---|---|---|
| **Phase zero** — Stripe account and keys live, Twilio live, kitchen alert channels filled in | 2–5 days, mostly waiting | Stripe account verification is the long pole and is outside your control. Start it on day one. |
| **Server work** — the 13 endpoints, the `PushDevice` model and migration, the bearer-token changes | 4–6 days | Small individually; the menu endpoint and the account endpoints are the bulk. |
| **App build** — design system, navigation, all phase-one screens, Stripe, push | 4–6 weeks | The deal builder and the checkout are the two screens that always take longer than estimated. |
| **Internal testing** — TestFlight + Play internal, real orders through the real kitchen | 1–2 weeks | Must include a Friday night with real volume. |
| **Store review** | Apple 1–3 days typically, but budget a week and expect one rejection on the first submission; Google 1–7 days, longer for a brand-new developer account | A first submission from a new Apple developer account is slower than steady state. |
| **Total, first release** | **8–11 weeks elapsed** | Do not promise six weeks. |

Ongoing: a store build for every native change, OTA updates for JS-only fixes, and a Play Console / App Store Connect account to keep renewed.

---

## 10. Analytics and measurement

There is **no analytics anywhere in the platform today** — no GA4, no Tag Manager, no product analytics. Do not let the app be the same. Minimum viable: a small event wrapper posting to whatever the business standardises on, capturing `menu_viewed`, `product_viewed`, `add_to_basket`, `checkout_started`, `payment_succeeded`, `order_placed`, `reorder_used`, `push_permission_granted`, `push_opened`. Attach the order id, not the customer's phone.

Marketing attribution stays server-side, in `MarketingSend` and `attributeOrder()`, exactly as it does for the web. The app does not need to attribute anything itself; it only needs to pass the promo code through.

---

## 11. Do not do — the parity-breaking list

Each of these would make the app and the website disagree about something that matters. If one becomes genuinely necessary, change the server and the website first, then the app.

1. **Do not price anything on the device.** No client-side subtotal, delivery fee, minimum-spend check, discount, deal total or "you need £3 more for free delivery". Every figure comes from `/api/basket/price` or `/api/checkout`. The whole security model of this platform is that the server re-prices from the live menu.
2. **Do not decide open, closed or paused on the device.** `availability()` handles past-midnight hours and pause windows in the branch timezone and is unit-tested. A device clock and a naive comparison will get Grays' 03:00 close wrong.
3. **Do not compute delivery zones or fees from the postcode on the device.** Banded fees, band precedence and minimum inheritance live in `postcode.ts` and are tested. Call `/api/postcode/check`.
4. **Do not create a second auth system.** No JWTs of your own, no refresh tokens, no device-id login, no PIN. Reuse the signed session token and the `Session` row.
5. **Do not store the bearer token outside secure storage,** and do not log it.
6. **Do not add a marketing push channel with its own opt-in flag.** One flag, `Customer.marketingOptIn`. STOP by SMS silences push too.
7. **Do not send marketing push to anyone `audienceFor()` would exclude,** and do not copy the review-request exception that ignores consent.
8. **Do not add features the website lacks:** tips, saved cards, half-and-half pizzas, remove-a-topping, allergen filters, a loyalty screen, a driver map, live location, order editing, order cancellation. Every one of these needs server work and would produce an order the kitchen screen cannot render.
9. **Do not show Crust Club, points, or a stamp card** while `loyalty.enabled` is false.
10. **Do not build a native kitchen screen** as part of this project (section 2.2).
11. **Do not use In-App Purchase** for food (section 7.5).
12. **Do not use the SSE endpoint** `/api/orders/[id]/events` from the app; poll `/api/orders/[id]/status` instead (section 5.3, item 6).
13. **Do not call a non-canonical host** — no `www.`, no preview URL (section 5.1).
14. **Do not round money.** Pence integers throughout; format at the last moment.
15. **Do not queue orders offline** for later submission.
16. **Do not soften the design into a generic app look:** no rounded corners, no card shadows, no iOS-default blue, no system font, no dark mode, no gradient buttons. Zero radius, 2px rules, Archivo, ink `#201e1d` and accent `#ec3013` on the `#f3f2f2` ground, primary buttons filled `#ae1800` (3.1). If a native control cannot be themed to the system, replace it rather than accept its defaults.
17. **Do not copy the web's incorrect delivery-fee helper text** or its public promo list that leaks personal reward codes (section 1.3, section 5.3 item 3).
18. **Do not ship a screen with placeholder or sample data.** The seeded reviews and the sample drivers must never appear in the app.

### 11.1 Deliberate exceptions to parity

Rule 2 in section 0 says any app/web divergence is a bug unless it is listed here. This is the complete list. Anything not on it is a bug.

| Divergence | Why | Retire it when |
|---|---|---|
| **Menu grid is 2 columns on a phone; the web is 1 column below 440px** (3.3) | A 4:3 tile at half a 393pt screen still reads, and one-column scrolling through 68 products is worse on a touch surface. | The web menu grid gets a 2-column phone rule of its own. |
| **No `· b/w` in the monogram caption** (3.5) | The web string is a greyscale-prototype leftover printing under colour photography. | `MenuBrowser.tsx` drops it; then both say the same thing. |
| **Stripe sheet is themed Modernist, not `brand.primary`** (7.3) | `PayStep.tsx` still uses `#C8322B` / 10px radius / Inter, which match nothing else on the site. | `PayStep.tsx` is corrected; the app is already right. |
| **Tracker polls `/api/orders/[id]/status`; the web uses SSE** (5.3 item 6) | React Native has no native `EventSource` and mobile networks break long-lived connections. Same data, same shape. | Never — this one is permanent. |
| **Bearer token instead of the `lf_customer` cookie** (5.4) | Cookies do not travel to a native client. Same signed credential, same `Session` row. | Never — this one is permanent. |
| **`POST /api/account/profile` and `/api/account/marketing` exist for the app before the web has them** (5.3 items 8, 9) | An app account screen with no way to fix a typo in your own email reads as broken, and `/privacy` already promises a marketing opt-out the web does not provide. | The web account page adopts the same two endpoints, which it should. |

Two of these are the app *leading* rather than diverging — the marketing opt-out especially, which closes a gap between what `/privacy` claims and what the site does. Fix the web after, not instead.

---

## 12. Decisions needed from the owner before phase one starts

1. Is the Stripe account being opened in Farm Pizza's name, and who owns the Apple and Google developer accounts? (They should be the business's, not the agency's.) **Confirm the canonical domain in the same conversation** — config says `farm-pizza.com`, with `order.farm-pizza.com`, `farm-pizza.uk` and `farmpizzatakeaway.co.uk` redirecting to it. The bundle identifier, the Apple Pay merchant id and the universal-link association files all hang off that answer, and the identifier cannot be changed after the first release (9.1).
2. Is Twilio going live? Without it there is no sign-in and no order texts.
3. Basildon is missing from `config/farm-pizza/client.json` — is the second branch trading, and should it be added before the app ships with a one-branch shop chooser?
4. Cash on delivery is off and cash on collection is on. Keep that in the app?
5. When push replaces SMS for accepted / ready / out-for-delivery (section 6.2), the shop's Twilio bill falls. Confirm that swap is wanted, or keep both and accept the duplication.
6. Kitchen: confirm the recommendation in 2.2 — fill in the alert channels and kiosk the tablet, rather than commissioning a kitchen app.
