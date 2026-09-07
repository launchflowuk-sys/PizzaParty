# Pizza Party — every price needs confirming before go-live

Every price in `menu.json` was taken from **Just Eat**, because it is the only
place the shop's full menu is published with prices attached. Just Eat's prices
are **higher than the shop's own**, and the gap is neither a fixed amount nor a
fixed percentage:

| Item | Own site | Just Eat | Gap |
|---|---|---|---|
| 10" Margherita | £8.00 | £10.00 | +£2.00 |
| 15" Margherita | £12.00 | £14.00 | +£2.00 |
| Chicken Strips Wrap | £5.50 | £7.00 | +£1.50 |
| Party Deal For 4 | £23.99 | £24.99 | +£1.00 |
| Big Family Deal | £32.99 | £34.99 | +£2.00 |

Because it cannot be calculated, the Just Eat figure is used **everywhere,
uncorrected**. That is deliberate: part-correcting the five known items would
have left the 12" Margherita dearer than the 15", which is worse than being
consistently a pound or two high. Go through this list with the owner's own
price list and correct `menu.json`.

## Two prices that were flattened

The platform charges one price per topping regardless of pizza size, the same way
Farm Pizza does. Just Eat charges by size — 7" £0.50, 10" £0.80, 12" £1.00,
15" £1.20. **£1.00 is used for every size.** Same for crusts: Just Eat charges
£2.00 / £2.50 / £3.20 / £4.00 by size for sausage and stuffed crust, and
**£2.50 is used throughout**. If the owner wants size-stepped pricing, say so —
it is a schema change, not a config one.

## Three pizzas with guessed prices

Ham & Mushroom, Chicken & Mushroom and Doner Kebab are on the shop's own site but
not on Just Eat, so they carry the cheaper tier's prices (£5 / £9 / £10 / £12) on
the assumption they sit with the other simple pizzas. **Confirm these three
first** — they are the only prices in the file that are inferred rather than
observed.


## Pizzas

| Pizza | 7" | 10" | 12" | 15" |
|---|---|---|---|---|
| Margherita | £6.00 | £10.00 | £12.00 | £14.00 |
| Double Pepperoni | £6.00 | £10.00 | £12.00 | £14.00 |
| Meat Party | £5.00 | £9.00 | £10.00 | £12.00 |
| Pepperoni Party | £5.00 | £9.00 | £10.00 | £12.00 |
| Farmhouse Special | £5.00 | £9.00 | £10.00 | £12.00 |
| Ham & Pineapple | £5.00 | £9.00 | £10.00 | £12.00 |
| Ham & Mushroom | £5.00 | £9.00 | £10.00 | £12.00 |
| Chicken & Mushroom | £5.00 | £9.00 | £10.00 | £12.00 |
| Kebab Delight | £5.00 | £9.00 | £10.00 | £12.00 |
| Doner Kebab | £5.00 | £9.00 | £10.00 | £12.00 |
| New York Special | £5.00 | £9.00 | £10.00 | £12.00 |
| Hot Veg Passion | £5.00 | £9.00 | £10.00 | £12.00 |
| BBQ Chicken | £5.00 | £9.00 | £10.00 | £12.00 |
| Mexican Party | £5.00 | £9.00 | £10.00 | £12.00 |
| Veg Party | £6.00 | £10.00 | £11.00 | £14.00 |
| Seafood | £6.00 | £10.00 | £11.00 | £14.00 |
| Smokey BBQ | £6.00 | £10.00 | £11.00 | £14.00 |
| Hot Meaty | £6.00 | £10.00 | £11.00 | £14.00 |
| BBQ Hot Meaty | £6.00 | £10.00 | £11.00 | £14.00 |
| Chicken Supreme | £6.00 | £10.00 | £11.00 | £14.00 |
| Meat Maryland | £6.00 | £10.00 | £11.00 | £14.00 |
| Flaming Meatballs | £6.00 | £10.00 | £11.00 | £14.00 |
| Double Chicken | £6.00 | £10.00 | £11.00 | £14.00 |
| Jumbo Party | £6.00 | £10.00 | £11.00 | £14.00 |
| Hot Tandoori Passion | £6.00 | £10.00 | £11.00 | £14.00 |
| Pizza Party Special | £6.00 | £10.00 | £11.00 | £14.00 |
| Half & Half | £7.00 | £11.00 | £12.00 | £15.00 |

## Sharing Boxes

| Item | Price |
|---|---|
| Box Mix | £10.00 |
| Boneless Box | £7.50 |

## Wraps

| Item | Price |
|---|---|
| Chicken Strips Wrap | Regular £7.00 · Meal £8.50 |
| Chicken & Crispy Bacon Wrap | Regular £7.00 · Meal £8.50 |
| Hotdog & Chips Wrap | Regular £7.00 · Meal £8.50 |

## Burgers

| Item | Price |
|---|---|
| Quarter Pounder with Cheese | Burger £5.00 · Meal £7.00 |
| Half Pounder with Cheese | Burger £6.00 · Meal £8.00 |
| Chicken Burger with Cheese | Burger £5.00 · Meal £7.00 |

## Grilled Chicken

| Item | Price |
|---|---|
| 1 Piece Grilled Chicken Leg Quarter | Regular £4.00 · With chips £5.00 |
| 2 Pieces Grilled Chicken Leg Quarter | Regular £7.00 · With chips £8.00 |
| 4 Pieces Grilled Chicken Leg Quarter | Regular £10.00 · With chips £12.00 |
| 4 Pieces Grilled Wings | Regular £3.00 · With chips £4.50 |
| 6 Pieces Grilled Wings | Regular £4.00 · With chips £5.50 |
| 8 Pieces Grilled Wings | Regular £5.00 · With chips £6.50 |
| Combo Chicken Meal | £8.50 |

## Pasta

| Item | Price |
|---|---|
| Spaghetti Bolognese | £8.00 |
| Beef Lasagne | £8.00 |

## Sides

| Item | Price |
|---|---|
| Chips | £3.00 |
| Cheesy Chips | £4.00 |
| Curly Fries | £4.00 |
| Potato Wedges | £4.00 |
| Salad Box | £4.00 |
| Garlic Bread | £4.00 |
| Garlic Bread with Cheese | £5.00 |
| Garlic Pizza Bread with Cheese | £6.00 |
| Onion Rings | £4.00 |
| Cheesy Jalapenos | £5.00 |
| Mozzarella Dippers | £5.00 |
| Chicken Strips | £5.00 |
| Chicken Nuggets | £5.00 |
| BBQ Chicken Wings | £4.00 |
| Peri Peri Chicken Wings | £4.00 |
| Sweet Chilli Chicken Wings | £4.00 |
| Grilled Chicken Leg | £4.00 |
| Jacket Potato Skins | £5.00 |
| Jacket Potato Skins with 1 Topping | £6.00 |

## Dips

| Item | Price |
|---|---|
| Garlic & Herb | £0.50 |
| Tomato Sauce | £0.50 |
| Chilli | £0.50 |
| Sweet Chilli | £0.50 |
| Sour Cream & Chives | £0.50 |
| BBQ | £0.50 |

## Kids Meals

| Item | Price |
|---|---|
| 7" Cheese & Tomato | £8.00 |
| 6 Nuggets | £6.00 |
| Chicken Popcorn | £6.00 |

## Desserts

| Item | Price |
|---|---|
| Chocolate Fudge Cake | £4.00 |
| Strawberry Cheesecake | £4.00 |

## Drinks

| Item | Price |
|---|---|
| Pepsi Can | £1.30 |
| Pepsi Max Can | £1.30 |
| Pepsi Max Cherry Can | £1.30 |
| Diet Coke Can | £1.30 |
| Dr Pepper Can | £1.30 |
| 7Up Can | £1.30 |
| Tango Orange Can | £1.30 |
| Pepsi Bottle | £3.50 |
| Pepsi Max Bottle | £3.50 |
| 7Up Bottle | £3.50 |
| Tango Bottle | £3.50 |
| Capri-Sun | £1.00 |
| Still Water | £1.00 |

## Deals

| Deal | Price |
|---|---|
| Any 2 Pizzas — Medium | £16.00 |
| Any 3 Pizzas — Medium | £24.00 |
| Any 2 Pizzas — Large | £20.00 |
| Any 3 Pizzas — Large | £30.00 |
| Any 2 Pizzas — X-Large | £26.00 |
| Any 3 Pizzas — X-Large | £39.00 |
| Set Deal | £19.99 |
| Party Deal For 4 | £24.99 |
| Pizza Party Deal | £21.99 |
| Big Family Deal | £34.99 |

## Also unconfirmed

Delivery fee (£2.50 placeholder) · minimum order (£12 placeholder) · which postcodes they actually deliver to (RM18, RM17 and RM16 assumed) · whether delivery charges vary by district.
