"use client";
import type { PosCategory } from "./pos-client-types";

export const DEALS_KEY = "__deals__";
export const POPULAR_KEY = "__popular__";

export function CategoryRail({
  categories, activeKey, onSelect, hasPopular,
}: {
  categories: PosCategory[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Only worth showing once the bootstrap fetch has told us which slugs sell. */
  hasPopular: boolean;
}) {
  return (
    <nav className="pos-rail" aria-label="Categories">
      <button type="button" className="pos-rail-btn" data-active={activeKey === DEALS_KEY ? "1" : undefined} onClick={() => onSelect(DEALS_KEY)}>
        Deals
      </button>
      {hasPopular ? (
        <button type="button" className="pos-rail-btn" data-active={activeKey === POPULAR_KEY ? "1" : undefined} onClick={() => onSelect(POPULAR_KEY)}>
          Popular
        </button>
      ) : null}
      {categories.map((c) => (
        <button key={c.key} type="button" className="pos-rail-btn" data-active={activeKey === c.key ? "1" : undefined} onClick={() => onSelect(c.key)}>
          {c.name}
        </button>
      ))}
    </nav>
  );
}
