# Pizza Party — the photographs still missing

69 of 87 products already have one, borrowed from the Farm Pizza library and
matched on what is in the picture. These 18 could not be: there is no honest
photograph of a burger, a wrap, plain chips or a Pepsi can in that library —
Farm Pizza sells Coke — and a wrong photograph is worse than none, because the
menu already renders a monogram tile for a missing image and that reads as
designed.

**These are also the blank thumbnails at checkout.** The "Goes well with" grid
in the basket pulls product images, and it suggests sides and drinks, which is
most of this list.

---

## Every size, in one place

| What | Generate at | Shown at | Notes |
|---|---|---|---|
| **Product tile** | **1024 × 1024** | 252 × 189 (4:3) | Square source, cropped to 4:3 by the site. 18 needed. |
| **Category header** | **1024 × 1024** | 4:3 | 3 needed. |
| **Hero** | 1024 × 1024 | ≈1:1 | Already have one (borrowed). Replace when you can. |
| **Social / OG card** | 1536 × 1024 | 1200 × 630 | Already have one (borrowed). |

JPEG is fine. Don't pre-crop — send squares and the site handles the rest.

**Style, so they sit with the 69 already there:** food shot **top-down** on a
plain surface, one item filling most of the frame, soft daylight, no props, no
hands, no branding, no text. Drinks are the exception — **three-quarter angle**,
because a can from above is a circle.

---

## The 18 products

Filenames matter — drop them in `config/pizza-party/assets/products/` with
exactly these names and they wire themselves up.

### Wraps (3) — top-down, wrap halved so the filling shows
| File | Item |
|---|---|
| `chicken-strips-wrap.jpg` | Chicken Strips Wrap |
| `chicken-and-crispy-bacon-wrap.jpg` | Chicken & Crispy Bacon Wrap |
| `hotdog-and-chips-wrap.jpg` | Hotdog & Chips Wrap |

### Burgers (3) — three-quarter is fine here, so the stack reads
| File | Item |
|---|---|
| `quarter-pounder.jpg` | Quarter Pounder with Cheese |
| `half-pounder.jpg` | Half Pounder with Cheese |
| `chicken-burger.jpg` | Chicken Burger with Cheese |

### Grilled chicken (3) — top-down, on a plain plate
| File | Item |
|---|---|
| `grilled-chicken-leg-1.jpg` | 1 Piece Grilled Chicken Leg Quarter |
| `grilled-chicken-leg-2.jpg` | 2 Pieces Grilled Chicken Leg Quarter |
| `grilled-chicken-leg-4.jpg` | 4 Pieces Grilled Chicken Leg Quarter |

### Sides (4) — top-down, in a basket or on a plate
| File | Item |
|---|---|
| `chips-large.jpg` | Chips (large) |
| `cheesy-chips.jpg` | Cheesy Chips |
| `salad-box.jpg` | Salad Box |
| `grilled-chicken-leg-side.jpg` | Grilled Chicken Leg (single, any flavour) |

### Drinks (5) — **three-quarter angle**, chilled, condensation
| File | Item |
|---|---|
| `pepsi-can.jpg` | Pepsi, 330ml can |
| `pepsi-max-can.jpg` | Pepsi Max, 330ml can |
| `pepsi-max-cherry-can.jpg` | Pepsi Max Cherry, 330ml can |
| `tango-orange-can.jpg` | Tango Orange, 330ml can |
| `capri-sun.jpg` | Capri-Sun carton |

**On the drinks:** these are real branded products. A generated "cola can" will
look wrong to anybody who knows the brand, and using someone else's product
photography is not yours to use. The cheapest honest route is to photograph the
actual cans on the counter with a phone — top light, plain background. Five
minutes and they will be more accurate than anything generated.

---

## Three category headers

Into `config/pizza-party/assets/categories/`:

| File | Category |
|---|---|
| `wraps.jpg` | Wraps |
| `burgers.jpg` | Burgers |
| `kids-meals.jpg` | Kids Meals |

The other eight categories already have one.

---

## Worth replacing when there is time

The **hero**, **banner** and **social card** are currently Farm Pizza's. They
work — a pizza is a pizza — but they are the most visible images on the site and
the two shops trade a few miles apart. A single good shot of a Pizza Party box
or the oven would be worth more than all eighteen tiles above.

Same for the **18 pizzas** already using Farm Pizza photography: correct in
content, not actually theirs.

---

## When you have them

Drop the files in and tell me. Nothing else needed — the names are already the
product slugs, so it is one command to pick them up and redeploy.
