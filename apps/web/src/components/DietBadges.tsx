/**
 * Vegetarian, vegan and spicy, as badges rather than letters.
 *
 * These used to be a bare green "V" set in the price line, which read as part
 * of the price rather than as a label. A filled round badge is what people
 * already recognise from a menu, and it survives being scanned quickly down a
 * long list - which is the only way anybody reads a takeaway menu.
 *
 * One component, used everywhere an item appears: the cards, the menu list, the
 * item's own page, the deal picker and the search results. When the rule for
 * what counts as vegetarian changes, it changes in one place.
 */

const DIET = [
  { tag: "vegan", label: "VE", title: "Vegan" },
  { tag: "vegetarian", label: "V", title: "Vegetarian" },
] as const;

/**
 * How hot, as a count of chillies.
 *
 * One for a kick, two for properly hot, three for the ones that need a warning
 * - which is the scale every takeaway menu already uses, so it needs no key.
 * The strongest tag present wins; an item is not "spicy and also extra hot".
 */
const HEAT: { tag: string; chillies: 1 | 2 | 3; title: string }[] = [
  { tag: "extra-hot", chillies: 3, title: "Extra hot" },
  { tag: "hot", chillies: 2, title: "Hot" },
  { tag: "spicy", chillies: 1, title: "Mild kick" },
];

export function DietBadges({ tags, size = 20 }: { tags: string[]; size?: number }) {
  // Vegan implies vegetarian on most menus, and showing both is noise - the
  // stronger claim wins, so a vegan pizza gets VE and not "VE V".
  const diet = DIET.filter(
    (b) => tags.includes(b.tag) && !(b.tag === "vegetarian" && tags.includes("vegan")),
  );
  const heat = HEAT.find((h) => tags.includes(h.tag)) ?? null;
  if (diet.length === 0 && !heat) return null;

  return (
    <span className="fp-diet-set">
      {diet.map((b) => (
        <span
          key={b.tag}
          className="fp-diet"
          data-tone="veg"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.52) }}
          title={b.title}
          aria-label={b.title}
          role="img"
        >
          {b.label}
        </span>
      ))}

      {heat ? (
        /* One label for the group, not one per chilli: a screen reader saying
           "chilli chilli chilli" tells nobody how hot it is. */
        <span className="fp-heat" title={heat.title} aria-label={heat.title} role="img" style={{ fontSize: Math.round(size * 0.72) }}>
          {Array.from({ length: heat.chillies }, (_, i) => (
            <span key={i} aria-hidden="true">🌶</span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
