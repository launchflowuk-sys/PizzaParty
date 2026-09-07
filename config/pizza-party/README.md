# Pizza Party

162 Dock Road, Tilbury, Essex RM18 7BS · 01375 400001 · pizzapartyonline.co.uk

One shop, one branch. Evening trade only: 15:00–23:00 Monday to Saturday,
15:00–22:30 on Sunday. Delivery and collection, no alcohol.

## Before this shop takes a real order

- [ ] **Confirm every price.** See `PRICES-TO-CONFIRM.md`. The menu was built from
      Just Eat, whose prices run above the shop's own by an amount that is not a
      fixed sum or percentage, so none of them can be trusted.
- [ ] **Confirm the delivery zone.** RM18, RM17 and RM16 are assumed, and the
      £2.50 fee and £12 minimum are placeholders.
- [ ] **Real Stripe keys.** The build runs on the sandbox. `stripeEnabled()` will
      happily run a live shop on test keys and every order will look paid while
      no money moves.
- [ ] **Logo, hero and product photography.** `assets/` holds generated
      placeholders. Products without a photo render as a monogram tile, which is
      a designed state rather than a bug, but the logo and hero are not.
- [ ] **Google review URL** in `contact.reviewUrl`, or the review-request engine
      stays dormant.
- [ ] **Staff PINs** in `ops.json` — the samples are committed to a public repo.
- [ ] **Brand colour.** `#E4572E` is a placeholder chosen to be clearly distinct
      from Farm Pizza's tomato. Replace it from the logo when that arrives; the
      whole accent ramp derives from it, so nothing else needs touching.

## Things worth knowing about this menu

**Half & Half** is modelled as an ordinary product with a topping choice per
half, because the schema has no concept of a split pizza. Real half-and-half
pricing — where the dearer half sets the price — would be a pricing change, not
a config one.

**Toppings and crusts are flat-priced.** Just Eat charges by pizza size (toppings
7" £0.50 up to 15" £1.20; sausage and stuffed crust £2.00 up to £4.00). This
platform charges one price per option regardless of size, the same as Farm Pizza,
so £1.00 and £2.50 are used throughout.

**Three pizzas carry inferred prices.** Ham & Mushroom, Chicken & Mushroom and
Doner Kebab appear on the shop's own site but not on Just Eat, so they were given
the cheaper tier's prices. They are the only prices in the file that were not
observed somewhere.
