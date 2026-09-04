import Link from "next/link";

export function CategoryChips({ categories, active, anchor }: { categories: { slug: string; name: string }[]; active?: string; anchor?: boolean }) {
  return (
    <nav aria-label="Categories" className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-surface-2/95 backdrop-blur">
      <ul className="flex gap-2 overflow-x-auto hide-scrollbar">
        {categories.map((c) => (
          <li key={c.slug} className="shrink-0">
            <Link
              href={anchor ? `/menu#${c.slug}` : `/menu/${c.slug}`}
              className={`lf-pill border ${active === c.slug ? "bg-ink text-white border-ink" : "bg-surface border-line text-ink"}`}
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
