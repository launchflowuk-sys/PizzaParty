# Pizza Party — source data for `config/pizza-party/`

Gathered 2026-09-07 from the shop's own Foodhub site, the Foodhub marketplace listing and their (now closed) Uber Eats store. This is raw source material for building `menu.json` and `client.json`, not the config itself.

## Shop details — verified

| Field | Value | Source |
|---|---|---|
| Name | Pizza Party | all three |
| Address | 162 Dock Road, Tilbury, Essex **RM18 7BS** | Uber Eats + Foodhub footer |
| Phone | **01375 400001** | own site footer |
| Cuisine | Pizza, Kebab, BBQ | Foodhub |
| Rating | 4.7 from 355 reviews | own site |
| Opening hours | **Sun 15:00–22:30; Mon–Sat 15:00–23:00** | Uber Eats |
| Quoted times | Delivery 45 min, pickup 15 min | Foodhub |
| Fulfilment | Delivery and collection | Foodhub |
| Pizza sizes | 10", 12", 15" | menu + deal wording |

Note the town: **Tilbury RM18**, not Grays. Delivery districts still need confirming with the owner — RM18 certainly, likely RM17 and RM16, but guessing a delivery zone is how you end up sending a driver somewhere unprofitable.

## Pricing: use their own site, not the marketplace

Foodhub's marketplace listing is roughly 4% dearer than the shop's own domain for the same items:

| Item | pizzapartyonline.co.uk | foodhub.co.uk |
|---|---|---|
| Pizza Deal For 4 | £23.99 | £24.90 |
| Big Family Deal | £32.99 | £34.30 |
| 10" Margherita | £8.00 | £8.30 |
| 15" Margherita | £12.00 | £12.45 |
| Chicken Strips Wrap | £5.50 | £5.70 |

**Take prices from their own site.** Seeding the marketplace prices would silently raise every price on the new shop.

## Prices still needed

The five above are the only confirmed ones. Their own site loads the rest per category behind a client-side API that refuses an unauthenticated call ("Invalid store header"), and the Uber Eats store has been closed since December 2024 so it renders items without prices.

**Cheapest way to close this: ask the owner.** Foodhub gives operators a menu export, and they will have a printed menu. That is one message versus an afternoon of scraping, and it is authoritative rather than inferred.

## Menu structure

Eleven categories. Item names and descriptions below are from Uber Eats, which lists them in full; the shop's own site shows the same items.

### Special Offers
Any 2 Pizzas · Any Three Pizzas · Pizza Party Special Deals
- **Set Deal** — any large 12" pizza, 7" garlic pizza bread, chicken strips and cheese chips
- **Big Family Deal** (£32.99) — any 2 × 15" pizzas, any 2 side orders, garlic bread, bottle of drink
- **Party Deal For 4** (£23.99) — any 2 × 12" large pizzas with 2 side orders
- **Pizza Party Deal** — any 15" pizza, any 2 sides, bottle of drink
- **Boneless Box** — 3 chicken strips, 5 nuggets, chips, can of drink
- **Box Mix** — 6 onion rings, 3 mozzarella sticks, 3 cheesy jalapenos, 3 nuggets, 3 chicken strips, small wedges

All of these map onto the existing `MenuDealSchema` / `DealSlotSchema` — "any N from category X" is already expressible.

### Pizzas (27)
Margherita (cheese and tomato) · Farmhouse Special (ham, onion, mushroom) · Double Pepperoni (extra pepperoni, extra cheese) · Ham and Pineapple · Hot Veg Passion (onion, mushroom, green pepper, jalapeno) · Meat Party · Kebab Delight (garlic sauce, kebab meat, onion, jalapeno) · BBQ Chicken (bbq sauce, chicken, onion, bacon) · Pepperoni Party (pepperoni, mushroom, onion) · New York Special (pepperoni, onion, green chilli, green pepper) · Mexican Party (spicy beef, onion, red pepper, jalapeno) · Ham & Mushroom · Chicken & Mushroom · Veg Party (onion, sweetcorn, red pepper, mushroom, fresh tomato) · Chicken Supreme (chicken, onion, mixed peppers, mushroom) · Seafood (prawns, tuna, anchovies, fresh tomato) · Meat Maryland (pepperoni, salami, sausage, kebab meat, ham) · Double Chicken (double mexican chicken, double tandoori chicken, sweetcorn, green pepper) · Smokey BBQ (chicken, crispy bacon, smoky sausage, red onion, sweetcorn, bbq sauce) · Flaming Meatballs (meatballs, sausage, pepperoni, onion, jalapeno) · Jumbo Party (sausage, pepperoni, ham, onion, green pepper, black olives) · Hot Meaty (pepperoni, chicken, sausage, kebab meat, jalapeno) · BBQ Hot Meaty · Hot Tandoori Passion (tandoori chicken, red onion, green pepper, jalapeno) · Doner Kebab · Pizza Party Special (any 4 toppings of your choice) · **Half and Half**

### Burgers (3, each also as a meal)
Quarter Pounder with Cheese · Half Pounder with Cheese · Chicken Burger. Meals add chips and a can.

### Wraps (3, each also as a meal)
Chicken Strips (£5.50) · Chicken and Crispy Bacon · Hot Dog and Chips

### Pasta (2)
Beef Lasagne · Spaghetti Bolognese

### Grilled Chicken (7)
1/2/4 pc Leg Quarter · 4/6/8 pc Grilled Wings · Combo Chicken Meal (¼ grilled chicken, 4 wings, chips, can)

### Sides (20)
Chips Large · Cheesy Chips · Curly Fries · Potato Wedges · Garlic Bread (4pc) · Garlic Bread with Cheese (4pc) · Garlic Pizza Bread with Cheese (7" + 1 dip) · BBQ Chicken Wings (6) · Peri Peri Chicken Wings (6) · Sweet Chilli Chicken Wings (6) · Cheesy Jalapenos (6) · Chicken Nuggets (10) · Chicken Strips (6) · Mozzarella Dippers (6) · Onion Rings (10) · Jacket Potato Skins with cheese (5) · Jacket Potato Skins with 1 Topping (5) · Salad Box · Grilled Chicken Leg (any flavour)

### Dips (7)
Garlic and Herb · Chilli · Sweet Chilli · BBQ · Sour Cream and Chives · Tomato Sauce · 3 Dips

### Kids Meals (3)
Chicken Popcorn · 7" Cheese and Tomato · 6 pc Nuggets. All served with chips and a can.

### Desserts (2)
Chocolate Fudge Cake · Strawberry Cheesecake

### Drinks
Cans (330ml): Pepsi · Pepsi Max · Diet Coke · Dr Pepper · Tango Orange · 7Up Lemon & Lime · Kids Capri-Sun
Bottles: Pepsi · Pepsi Max · Diet Coke · 7Up · Tango · Small Still Water

No alcohol, so the app's age rating stays low.

## Half and Half

They sell a Half and Half pizza and the platform has no concept of one. Model it as an ordinary product with two modifier groups, one per half — no code, no pricing change. True half-and-half pricing (dearer half wins) is a separate piece of work if the owner ever asks for it.

## Still to get from the owner

Menu prices (export or printed menu) · delivery districts, fees and minimums · logo and photography · Google review URL · live Stripe account.
