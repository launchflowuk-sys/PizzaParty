# Farm Pizza — image spec

What to generate, at what size, and what to call it. Derived from the Modernist
prototypes: content column 1200px with 32px gutters = **1136px of usable width**.

---

## Read this first — it changes what you generate

**1. Generate in COLOUR, not black and white.**
The design system applies `filter: grayscale(1) contrast(1.08)` to every photograph
via the `.grayscale` wrapper. The site converts them. Generating B/W wastes the
option of ever using colour later, and double-desaturation can flatten them.

**2. Because everything desaturates, colour contrast is worthless — tonal contrast is everything.**
Pepperoni-red on basil-green looks striking in colour and turns into identical mid-grey
mush in B/W. Ask for *strong light*, *visible shadow*, *texture* — char blisters on the
crust, flour dust, glossy cheese pull. That's what survives the filter.

**3. Pick one camera angle and hold it across all 16.**
They sit in a hard 4-column grid with 2px rules between cells. Mixed angles look broken
in that layout in a way they wouldn't in a soft card design. **Top-down (flat lay) is the
safe choice** for pizzas and sides.

**4. Plain, near-empty background.**
The design is flat and architectural — no props, no rustic wooden boards, no scattered
herbs. A plain mid-tone surface. Busy backgrounds fight the grid.

---

## Sizes to generate

Generators output fixed presets, so **generate square 1024×1024** for everything except
the hero. Square crops cleanly to every slot on the site; I'll do the cropping and
optimisation.

| Slot | Display size | Generate at | Notes |
| --- | --- | --- | --- |
| **Product tile** | 252 × 189 (4:3) | **1024 × 1024** | The main one — 16 needed. Shipped at 600×450 for retina. |
| **Hero (home)** | 450 × 440 (≈1:1) | **1024 × 1024** | One image. Near-square slot, so square source is ideal. |
| **Deal image** | 4:3 | **1024 × 1024** | 3 needed, optional — the deals list is currently type-only. |
| **Category header** | 4:3 | **1024 × 1024** | 4 needed, optional. |
| **OG / social share** | 1200 × 630 | **1536 × 1024** | One image, gets cropped to 1.91:1. |

Format: **JPG** for photographs (quality ~85). PNG only if it needs transparency.

---

## The 16 products — exact filenames

Save into `config/farm-pizza/assets/products/`. **Filename must match the slug exactly**,
lowercase, `.jpg` — that's how they get wired to the menu.

### Pizzas — top-down, whole pizza, plain surface
| Filename | Product |
| --- | --- |
| `margherita.jpg` | Margherita |
| `pepperoni-feast.jpg` | Pepperoni Feast |
| `bbq-chicken.jpg` | BBQ Chicken |
| `veggie-supreme.jpg` | Veggie Supreme |
| `meat-feast.jpg` | Meat Feast |

### Sides — top-down, on a plain plate or in a basket
| Filename | Product |
| --- | --- |
| `garlic-bread.jpg` | Garlic Bread |
| `garlic-bread-cheese.jpg` | Garlic Bread with Cheese |
| `chicken-wings.jpg` | Chicken Wings |
| `potato-wedges.jpg` | Potato Wedges |

### Drinks — **three-quarter angle, not top-down**
A can shot from above is a circle. Shoot these straight-on or slightly above, single
item, centred, plain background.

| Filename | Product |
| --- | --- |
| `coke-can.jpg` | Coca-Cola 330ml |
| `diet-coke-can.jpg` | Diet Coke 330ml |
| `fanta-can.jpg` | Fanta Orange 330ml |
| `coke-bottle.jpg` | Coca-Cola 1.5L |
| `water.jpg` | Still Water 500ml |

⚠️ **Branded drinks:** don't generate fake Coca-Cola / Fanta packaging — AI renders
trademarked branding badly and it's a trademark problem on a commercial site. Either use
the manufacturer's official press assets, photograph the real cans, or leave these as the
hatched placeholder. Generic "cola in a glass" is the safe generated option.

### Desserts
| Filename | Product |
| --- | --- |
| `chocolate-fudge-cake.jpg` | Chocolate Fudge Cake |
| `ben-jerrys.jpg` | Ben & Jerry's 465ml |

⚠️ Same trademark caution applies to `ben-jerrys.jpg`.

---

## Other assets

| Filename | Where | Generate at |
| --- | --- | --- |
| `assets/hero.jpg` | Home hero — pizza on the pass, or the oven | 1024 × 1024 |
| `assets/og.jpg` | Social share card | 1536 × 1024 |
| `assets/logo.svg` | Nav + favicon | **SVG preferred**, else 512×512 PNG, transparent |

The nav currently renders the shop name as Archivo 800 text ("FARM PIZZA"), which matches
the prototype. A logo is optional — if you want one used instead, say so.

You dropped a `Farm logo.png` in the repo root. Tell me if that's the intended brand mark
and I'll wire it in.

---

## A prompt that works for the tiles

> Top-down flat lay photograph of a [PRODUCT], centred, on a plain matte
> mid-grey surface, strong directional side light casting a visible soft shadow,
> high tonal contrast, sharp texture detail — char blisters, melted cheese, crumb.
> No props, no herbs scattered around, no wooden board, no cutlery. Square format.
> Editorial food photography, natural colour.

Keep the surface and lighting description **identical** across all 16 so the grid reads as
one set.

---

## When you have them

Drop them into `config/farm-pizza/assets/products/` and tell me. I'll set the `image`
field on each product, replace the hatched placeholders with real `<Image>` elements,
and re-run Lighthouse — images are the main risk to the current 100/100/100/100, so
they'll be served as optimised, correctly-sized, lazy-loaded AVIF/WebP.
