# Pizza Party — where it got to

Written 2026-09-07 while you were driving. Branch: `pizza-party-tenant`, in this
repo and in `farm-pizza-app`. Nothing is pushed and nothing is deployed.

## Done

**The website exists and works.** 11 categories, 87 products, 27 pizzas across
four sizes, 10 deals, and the bases, crusts and 26 toppings behind them. Menu,
category, product, deals, basket and locality pages all render and price
correctly. Real copy for Tilbury, Grays and Chadwell St Mary.

**The menu is real.** Pulled from their Just Eat listing, which turned out to
publish the whole menu with every size and price in the page data — including
the size system (7" small / 10" medium / 12" large / 15" X-large), the crust
options and the per-size topping prices.

**The app builds for either shop.** `farm-pizza-app` is now white-label:
`APP_TENANT=pizza-party` produces a different app, and Farm Pizza's resolved
config is identical key-for-key to the `app.json` it replaced.

**Three bugs fixed on the way**, all of which would have bitten a second shop:

- `/api/config/mobile` served hardcoded `hero.webp` and `banner.jpg` — Farm
  Pizza's files. Pizza Party's app would have shown two grey boxes.
- `pnpm seed --overwrite-menu` parsed the flag into a variable it never used, so
  re-importing a menu silently did nothing and reported success.
- The site's accent colour was nine hardcoded hexes, so a second shop would have
  been Farm Pizza in a different name.

Farm Pizza is unchanged throughout — checked, not assumed. Same base accent to
the byte, same config output, `validate-config` clean, 16/16 tests pass.

## What I need from you

**The prices are Just Eat's, and Just Eat charges more than the shop does.**
Confirmed gaps: 10" Margherita is £8 on their own site and £10 on Just Eat; the
Big Family Deal is £32.99 against £34.99. The difference is not a fixed amount
or a fixed percentage, so it cannot be calculated. Every price is listed in
`config/pizza-party/PRICES-TO-CONFIRM.md` for the owner to go through.

I used Just Eat's prices uncorrected rather than fixing the five I could see
both sides of, because a menu where the 12" costs more than the 15" is worse
than one that is honestly a pound high all the way through.

Also needed: **logo and photos** (the icons are a placeholder "PP" monogram on
`#E4572E`, which is a guessed brand colour), **the real delivery postcodes, fee
and minimum** (RM18/RM17/RM16, £2.50 and £12 are assumptions), the **Google
review URL**, and **live Stripe keys**.

## What only you can do

- `APP_TENANT=pizza-party eas init` — the app refuses to build without the
  project id, deliberately. A build with no EAS project gets uploaded against
  whichever project the CLI last remembered, which is how one shop's binary
  lands in another shop's TestFlight.
- Create the App Store Connect app and the Play listing, then fill in
  `ascAppId` in `eas.json` and `tenants/pizza-party.json`.
- Decide whether Play gets its own service account or keeps borrowing the Grays
  Park Masjid one.

## Running it locally

```bash
docker compose -f docker/compose.yml up -d db
export DATABASE_URL="postgresql://postgres:postgres@localhost:55433/pizza_party"
export CLIENT_SLUG=pizza-party NEXT_PUBLIC_SITE_URL=http://localhost:3200 PORT=3200
pnpm db:push && pnpm seed pizza-party && pnpm dev
```

The database is already created and seeded. Re-importing the menu after an edit
needs `pnpm seed pizza-party --overwrite-menu`, because once a shop is seeded
the database owns its menu.

For the app:

```bash
cd ../farm-pizza-app
APP_TENANT=pizza-party APP_API_URL=http://localhost:3200 npx expo start
```

## One note on the local build

`pnpm build` compiles fine — "Compiled successfully", 23/23 pages — and then
fails copying the standalone output, because `output: standalone` needs symlink
permission that Windows only grants in Developer Mode. It is not a code problem
and Coolify builds in Linux where it does not arise. Worth knowing so you do not
chase it.

## Still open from the design

The design doc's recommendation stands: **get one real release of the Farm Pizza
app out before this goes further.** It has been sitting on TestFlight unreleased.
The white-label refactor is verified against its own config, but "verified
against config" is not "verified in someone's hand", and if something surfaces
later you will not know whether it was the refactor or whether it never worked.
