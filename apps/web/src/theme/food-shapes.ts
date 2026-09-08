/**
 * The food drawings, as data.
 *
 * One set of shapes serves two jobs that would otherwise drift apart:
 *
 *   - a small colourful icon beside a category name
 *   - the same silhouette, flattened to one tint, tiled behind a screen
 *
 * Drawing them twice would guarantee the pattern stopped matching the icons the
 * first time either changed, so they are the same paths rendered two ways.
 *
 * Everything is on a 48x48 grid. Shapes are listed back to front - the first
 * entry is furthest away - because that is the order an SVG paints them.
 *
 * `tone` is what makes the silhouette possible. A shape marked `solid` is part
 * of the object's outline; `detail` is a pepperoni, a seed, a straw - something
 * that should vanish when the drawing collapses to one flat colour. The pattern
 * renderer keeps `solid` and drops `detail`, which is why a silhouette reads as
 * a pizza rather than a pizza with holes in it.
 *
 * These are deliberately blunt. They are drawn at 28px beside a word and at
 * roughly 40px in a background at four percent opacity; anything finer turns to
 * mud at both sizes.
 *
 * This file is a verbatim copy. The source of truth is `src/theme/food-shapes.ts`
 * in the farm-pizza-app repo. A phone and a Next.js build cannot share
 * a module, and a shared package for thirteen icons would cost more than it
 * saves - but they must not diverge, so a test in each repo compares them.
 */

export type Tone = "solid" | "detail";

export type Shape = {
  d: string;
  /** Palette key, resolved per platform so a shop's accent can drive it. */
  fill: FillKey;
  tone: Tone;
  opacity?: number;
};

/**
 * Fills are names, not colours.
 *
 * A hard-coded tomato red would be wrong the moment a shop's accent is green,
 * so anything that should follow the brand asks for `accent`. Everything else
 * is food - cheese is yellow in every shop - and stays literal.
 */
export type FillKey =
  | "accent"
  | "accentDark"
  | "crust"
  | "crustDark"
  | "cheese"
  | "green"
  | "brown"
  | "brownDark"
  | "cream"
  | "ink"
  | "cola"
  | "ice";

export const FOOD_PALETTE: Record<Exclude<FillKey, "accent" | "accentDark">, string> = {
  crust: "#E8B96B",
  crustDark: "#C9954A",
  cheese: "#F5D272",
  green: "#4E8B54",
  brown: "#B5713C",
  brownDark: "#8A5227",
  cream: "#FBF3E4",
  ink: "#3B332A",
  cola: "#6B3A1E",
  ice: "#9CC7D8",
};

/** A pizza slice, point down, three pepperoni. */
const pizzas: Shape[] = [
  { d: "M24 44 L6 12 Q24 4 42 12 Z", fill: "cheese", tone: "solid" },
  { d: "M6 12 Q24 4 42 12 Q24 10 6 12 Z", fill: "crustDark", tone: "solid" },
  { d: "M24 44 L6 12 Q24 4 42 12 Z", fill: "crust", tone: "detail", opacity: 0.18 },
  { d: "M18 17 m-3.2 0 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0", fill: "accent", tone: "detail" },
  { d: "M31 18 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0", fill: "accent", tone: "detail" },
  { d: "M24 29 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0", fill: "accent", tone: "detail" },
];

/** A sharing box, lid open, a pizza showing. */
const boxes: Shape[] = [
  { d: "M7 20 L24 13 L41 20 L41 24 L7 24 Z", fill: "crustDark", tone: "solid" },
  { d: "M8 24 H40 V40 Q40 42 38 42 H10 Q8 42 8 40 Z", fill: "crust", tone: "solid" },
  { d: "M14 28 H34 V36 H14 Z", fill: "cheese", tone: "detail" },
  { d: "M19 31 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0", fill: "accent", tone: "detail" },
  { d: "M29 33 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0", fill: "accent", tone: "detail" },
];

/** A wrap, cut on the diagonal, filling showing. */
const wraps: Shape[] = [
  { d: "M16 43 Q9 43 9 36 L9 18 Q9 11 16 11 L24 11 L31 43 Z", fill: "cream", tone: "solid" },
  { d: "M24 11 L31 43 L37 40 L30 9 Z", fill: "crust", tone: "solid" },
  { d: "M13 17 H23 L24 22 H13 Z", fill: "green", tone: "detail" },
  { d: "M13 25 H25 L26 30 H13 Z", fill: "accent", tone: "detail" },
  { d: "M14 33 H26 L27 38 H14 Z", fill: "cheese", tone: "detail" },
];

/** A burger. Bun, lettuce, patty, bun. */
const burgers: Shape[] = [
  { d: "M8 20 Q8 8 24 8 Q40 8 40 20 Z", fill: "crust", tone: "solid" },
  { d: "M7 21 H41 Q43 21 43 23 Q43 25 41 25 H7 Q5 25 5 23 Q5 21 7 21 Z", fill: "green", tone: "solid" },
  { d: "M8 26 H40 Q42 26 42 29 L42 31 Q42 34 40 34 H8 Q6 34 6 31 L6 29 Q6 26 8 26 Z", fill: "brownDark", tone: "solid" },
  { d: "M9 35 H39 Q41 35 41 38 Q41 41 39 41 H9 Q7 41 7 38 Q7 35 9 35 Z", fill: "crust", tone: "solid" },
  { d: "M16 14 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0", fill: "cream", tone: "detail" },
  { d: "M25 12 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0", fill: "cream", tone: "detail" },
  { d: "M32 15 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0", fill: "cream", tone: "detail" },
];

/** A drumstick. Reads as chicken at any size. */
const chicken: Shape[] = [
  { d: "M31 7 Q41 7 41 17 Q41 26 32 28 L24 36 Q19 41 14 36 Q9 31 14 26 L22 18 Q24 9 31 7 Z", fill: "brown", tone: "solid" },
  { d: "M16 30 L11 35 Q8 38 10 40 Q12 42 15 39 L20 34 Z", fill: "cream", tone: "solid" },
  { d: "M30 13 Q36 13 36 19", fill: "brownDark", tone: "detail", opacity: 0.5 },
];

/** A bowl of pasta with a fork twist. */
const pasta: Shape[] = [
  { d: "M6 24 H42 Q42 40 24 40 Q6 40 6 24 Z", fill: "cream", tone: "solid" },
  { d: "M8 24 H40 Q40 27 24 27 Q8 27 8 24 Z", fill: "cheese", tone: "detail" },
  { d: "M13 22 Q13 13 24 13 Q35 13 35 22 Z", fill: "cheese", tone: "solid" },
  { d: "M18 19 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0", fill: "accent", tone: "detail" },
  { d: "M29 20 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0", fill: "accent", tone: "detail" },
];

/** Chips in a carton. */
const sides: Shape[] = [
  { d: "M17 8 H21 V26 H17 Z", fill: "cheese", tone: "solid" },
  { d: "M23 6 H27 V26 H23 Z", fill: "crust", tone: "solid" },
  { d: "M29 9 H33 V26 H29 Z", fill: "cheese", tone: "solid" },
  { d: "M12 24 H38 L35 42 Q35 44 33 44 H17 Q15 44 15 42 Z", fill: "accent", tone: "solid" },
  { d: "M16 30 H34 L33 35 H17 Z", fill: "cream", tone: "detail", opacity: 0.55 },
];

/** Garlic bread, for shops whose first category is starters. */
const starters: Shape[] = [
  { d: "M6 20 Q6 13 14 13 H34 Q42 13 42 20 Q42 27 34 27 H14 Q6 27 6 20 Z", fill: "crust", tone: "solid" },
  { d: "M10 27 H38 L35 38 Q34 41 31 41 H17 Q14 41 13 38 Z", fill: "crustDark", tone: "solid" },
  { d: "M14 18 h5 M23 17 h5 M32 19 h4", fill: "green", tone: "detail" },
  { d: "M16 20 m-1.3 0 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0", fill: "green", tone: "detail" },
  { d: "M27 21 m-1.3 0 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0", fill: "green", tone: "detail" },
];

/** A dip pot with a peeled lid. */
const dips: Shape[] = [
  { d: "M12 18 H36 L33 40 Q33 43 30 43 H18 Q15 43 15 40 Z", fill: "cream", tone: "solid" },
  { d: "M10 14 H38 Q40 14 40 16 Q40 19 38 19 H10 Q8 19 8 16 Q8 14 10 14 Z", fill: "accent", tone: "solid" },
  { d: "M17 23 H31 L29 37 H19 Z", fill: "accentDark", tone: "detail" },
];

/** A kids meal: a lidded cup and a chip, small and friendly. */
const kidsMeals: Shape[] = [
  { d: "M13 17 H35 L32 42 Q32 44 29 44 H19 Q16 44 16 42 Z", fill: "accent", tone: "solid" },
  { d: "M11 12 H37 Q39 12 39 14 Q39 17 37 17 H11 Q9 17 9 14 Q9 12 11 12 Z", fill: "cream", tone: "solid" },
  { d: "M26 4 L31 5 L28 13 L25 12 Z", fill: "green", tone: "solid" },
  { d: "M19 25 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0", fill: "cream", tone: "detail" },
  { d: "M29 25 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0", fill: "cream", tone: "detail" },
  { d: "M19 31 Q24 36 29 31", fill: "cream", tone: "detail" },
];

/** An ice cream cone. */
const desserts: Shape[] = [
  { d: "M14 22 H34 L24 44 Z", fill: "crust", tone: "solid" },
  { d: "M13 22 Q9 22 9 18 Q9 13 14 13 Q15 6 23 6 Q31 6 32 13 Q38 13 38 18 Q38 22 34 22 Z", fill: "cream", tone: "solid" },
  { d: "M17 16 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0", fill: "accent", tone: "detail" },
  { d: "M28 14 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0", fill: "accent", tone: "detail" },
  { d: "M18 27 L30 27 L28 32 L20 32 Z", fill: "crustDark", tone: "detail", opacity: 0.4 },
];

/** A cup with a straw. */
const drinks: Shape[] = [
  { d: "M26 4 L33 6 L27 18 L24 17 Z", fill: "accent", tone: "solid" },
  { d: "M12 14 H36 L33 41 Q33 44 30 44 H18 Q15 44 15 41 Z", fill: "cola", tone: "solid" },
  { d: "M10 10 H38 Q40 10 40 12 Q40 15 38 15 H10 Q8 15 8 12 Q8 10 10 10 Z", fill: "cream", tone: "solid" },
  { d: "M17 21 H31 L29 30 H19 Z", fill: "cream", tone: "detail", opacity: 0.3 },
];

/**
 * Every category slug either shop uses, plus the shapes behind them.
 *
 * Keyed by slug because that is what the API sends. A shop owns its menu after
 * the first seed and can invent a slug nobody has drawn for, so lookup is a
 * function with a fallback rather than a bare index - see `shapesFor`.
 */
export const FOOD_SHAPES = {
  pizzas,
  boxes,
  wraps,
  burgers,
  "grilled-chicken": chicken,
  chicken,
  pasta,
  sides,
  starters,
  dips,
  "kids-meals": kidsMeals,
  desserts,
  drinks,
} as const satisfies Record<string, Shape[]>;

export type FoodKey = keyof typeof FOOD_SHAPES;

/**
 * Slugs that are not drawn but obviously mean something that is.
 *
 * Cheap insurance: a third shop calling its chicken "fried-chicken" gets the
 * drumstick rather than the fallback, without anybody editing this file.
 */
const ALIASES: Record<string, FoodKey> = {
  pizza: "pizzas",
  "sharing-boxes": "boxes",
  "meal-deals": "boxes",
  deals: "boxes",
  wrap: "wraps",
  burger: "burgers",
  "fried-chicken": "chicken",
  "peri-peri": "chicken",
  kebabs: "wraps",
  "kids-meal": "kids-meals",
  kids: "kids-meals",
  dessert: "desserts",
  drink: "drinks",
  "soft-drinks": "drinks",
  sauces: "dips",
  salads: "sides",
  starter: "starters",
  side: "sides",
};

/**
 * The shapes for a category slug, or pizza if we have never heard of it.
 *
 * Falling back to a drawing rather than to nothing is deliberate: a missing
 * icon leaves a hole in a row of icons, which looks broken, whereas a slightly
 * wrong one looks intentional. Every shop in this business sells pizza.
 */
export function shapesFor(slug: string): Shape[] {
  const key = slug.toLowerCase().trim();
  if (key in FOOD_SHAPES) return FOOD_SHAPES[key as FoodKey];
  const alias = ALIASES[key];
  if (alias) return FOOD_SHAPES[alias];
  return FOOD_SHAPES.pizzas;
}

/** True when the slug has a drawing of its own. Used by the tests, not the UI. */
export function hasOwnShape(slug: string): boolean {
  const key = slug.toLowerCase().trim();
  return key in FOOD_SHAPES || key in ALIASES;
}

/** The order shapes are laid out in a background tile. */
export const PATTERN_ORDER: FoodKey[] = [
  "pizzas",
  "burgers",
  "drinks",
  "wraps",
  "desserts",
  "chicken",
  "sides",
  "dips",
];

/**
 * The pattern shape at position `n`, wrapping round the list.
 *
 * A plain index into PATTERN_ORDER is typed `FoodKey | undefined` under
 * strict index checking, which is correct - the compiler cannot know the
 * modulo keeps it in range. This says so once rather than at each call site.
 */
export function patternKeyAt(n: number): FoodKey {
  const i = ((n % PATTERN_ORDER.length) + PATTERN_ORDER.length) % PATTERN_ORDER.length;
  return PATTERN_ORDER[i] ?? "pizzas";
}
