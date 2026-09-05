"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { gbpShort } from "@/lib/money";

export type SearchItem = {
  slug: string;
  name: string;
  category: string;
  href: string;
  fromPrice: number;
  sizeNote: string;
  soldOut: boolean;
};

const MAX_RESULTS = 8;

/**
 * The search bar on the hero.
 *
 * A takeaway customer usually arrives knowing what they want - "pepperoni",
 * "garlic bread", "lasagne" - and making them find the category first is a step
 * they did not ask for. Results drop down as they type, grouped by category and
 * priced, so the whole job can be done from the one box.
 *
 * Matching is name-first: someone typing "chick" means chicken in the name, not
 * every pizza whose description happens to mention it, so name hits sort above
 * description hits rather than being mixed in.
 */
function rank(item: SearchItem, term: string): number {
  const name = item.name.toLowerCase();
  if (name === term) return 100;
  if (name.startsWith(term)) return 80;
  if (name.includes(term)) return 60;
  if (item.category.toLowerCase().includes(term)) return 30;
  return 0;
}

export function MenuSearchPill({
  suggestions = [],
  items = [],
}: {
  suggestions?: string[];
  items?: SearchItem[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const term = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (term.length < 2) return [];
    return items
      .map((it) => ({ it, score: rank(it, term) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name))
      .slice(0, MAX_RESULTS)
      .map((r) => r.it);
  }, [items, term]);

  /**
   * One heading per category, not one per run.
   *
   * Results come back sorted by how well they match, which interleaves
   * categories - so collecting only adjacent runs produced "Chicken, Pizzas,
   * Chicken, Pizzas" down the list. Each category appears once, in the order it
   * first scored, with its best match at the top of it.
   */
  const groups = useMemo(() => {
    const byCategory = new Map<string, SearchItem[]>();
    for (const it of results) {
      const bucket = byCategory.get(it.category);
      if (bucket) bucket.push(it);
      else byCategory.set(it.category, [it]);
    }
    return [...byCategory].map(([category, items]) => ({ category, items }));
  }, [results]);

  // Flat again, so the arrow keys can walk the list the way it looks.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setActive(-1), [term]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function go(value: string) {
    const v = value.trim();
    setOpen(false);
    router.push(v ? `/menu?q=${encodeURIComponent(v)}` : "/menu");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % flat.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? flat.length - 1 : i - 1)); }
    else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const pick = flat[active];
      if (pick) { setOpen(false); router.push(pick.href); }
    }
  }

  const showDropdown = open && term.length >= 2;

  return (
    <div className="fp-herosearch" ref={wrap}>
      <form
        className="fp-herosearch-bar"
        role="search"
        onSubmit={(e) => { e.preventDefault(); go(q); }}
      >
        <label htmlFor="hero-search" className="fp-visually-hidden">Search the menu</label>
        <input
          id="hero-search"
          name="q"
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search the menu"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="hero-search-results"
          aria-autocomplete="list"
        />
        <button type="submit" aria-label="Search the menu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />
          </svg>
        </button>
      </form>

      {showDropdown ? (
        <div className="fp-searchdrop" id="hero-search-results" role="listbox">
          {flat.length === 0 ? (
            <p className="fp-searchdrop-empty">
              Nothing matches &ldquo;{q.trim()}&rdquo;. Try a topping, or{" "}
              <Link href="/menu" onClick={() => setOpen(false)}>browse the whole menu</Link>.
            </p>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.category}>
                  <div className="fp-searchdrop-cat">{g.category}</div>
                  {g.items.map((it) => {
                    const i = flat.indexOf(it);
                    return (
                      <Link
                        key={it.slug}
                        href={it.href}
                        role="option"
                        aria-selected={i === active}
                        className="fp-searchdrop-row"
                        data-active={i === active ? "1" : undefined}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => setOpen(false)}
                      >
                        <span className="fp-searchdrop-name">
                          {it.name}
                          {it.soldOut ? <span className="tag tag-neutral" style={{ marginLeft: 8 }}>Sold out</span> : null}
                          <span className="fp-searchdrop-note">{it.sizeNote}</span>
                        </span>
                        <span className="fp-searchdrop-price">{gbpShort(it.fromPrice)}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
              <button type="button" className="fp-searchdrop-all" onClick={() => go(q)}>
                See everything matching &ldquo;{q.trim()}&rdquo; &rarr;
              </button>
            </>
          )}
        </div>
      ) : null}

      {suggestions.length > 0 && !showDropdown ? (
        <div className="fp-herosearch-chips">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => go(s)}>{s}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
