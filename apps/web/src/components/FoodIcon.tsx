/**
 * The food drawings on the web, from the same paths the app uses.
 *
 * `CategoryIcon` is the small colourful one beside a category name.
 * `FoodPattern` is the same drawings flattened to one tint and tiled behind a
 * section. Both read `food-shapes.ts`, which is a verbatim copy of the app's
 * file - so a wrap looks like the same wrap on a phone and in a browser.
 */

import { FOOD_PALETTE, patternKeyAt, shapesFor, type FillKey, type Shape } from "@/theme/food-shapes";

/**
 * Brand fills defer to CSS custom properties rather than resolving here.
 *
 * The stylesheet already computes the shop's accent ramp; reading it back in
 * JavaScript would be a second source of truth that could disagree with the
 * first. Food colours are literal because cheese is yellow in every shop.
 */
function fillFor(key: FillKey): string {
  if (key === "accent") return "var(--accent)";
  if (key === "accentDark") return "var(--accent-700, var(--accent))";
  return FOOD_PALETTE[key];
}

/** A path with no curve or close command is a line, and must be stroked. */
function isStroke(d: string): boolean {
  return !/[ZzQqCcAa]/.test(d);
}

function paint(s: Shape, i: number, tint?: string) {
  const stroke = isStroke(s.d);
  const c = tint ?? fillFor(s.fill);
  return (
    <path
      key={i}
      d={s.d}
      fill={stroke ? "none" : c}
      stroke={stroke ? c : undefined}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap={stroke ? "round" : undefined}
      opacity={tint ? undefined : s.opacity}
    />
  );
}

export function CategoryIcon({
  slug,
  size = 28,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const shapes = shapesFor(slug);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {shapes.map((s, i) => paint(s, i))}
    </svg>
  );
}

const DENSITY = {
  busy: { tile: 108, opacity: 0.055 },
  medium: { tile: 132, opacity: 0.04 },
  quiet: { tile: 168, opacity: 0.025 },
} as const;

/**
 * The tiled silhouettes.
 *
 * Only `solid` shapes survive: keeping the pepperoni would punch holes through
 * a flat shape and read as a mistake rather than as a pizza.
 *
 * Emitted as an SVG `<pattern>` rather than a repeated element, so the browser
 * tiles it and the page carries one copy of the geometry however tall it gets.
 */
export function FoodPattern({
  density = "medium",
  seed = 7,
  className,
}: {
  density?: keyof typeof DENSITY;
  seed?: number;
  className?: string;
}) {
  const { tile, opacity } = DENSITY[density];
  const cells = [0, 1, 2, 3].map((i) => {
    const n = i + seed;
    return {
      key: patternKeyAt(n),
      x: (i % 2) * (tile / 2),
      y: Math.floor(i / 2) * (tile / 2),
      rot: ((n * 37) % 4) * 15 - 22,
      scale: 0.82 + ((n * 13) % 5) * 0.07,
    };
  });
  const id = `food-${density}-${seed}`;

  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <defs>
        <pattern id={id} width={tile} height={tile} patternUnits="userSpaceOnUse">
          {cells.map((c, i) => (
            <g key={i} transform={`translate(${c.x}, ${c.y}) rotate(${c.rot}) scale(${c.scale})`}>
              {shapesFor(c.key)
                .filter((s) => s.tone === "solid")
                .map((s, j) => paint(s, j, "var(--accent)"))}
            </g>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </svg>
  );
}
