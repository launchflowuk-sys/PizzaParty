"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The search bar on the hero.
 *
 * A takeaway customer usually arrives knowing what they want - "pepperoni",
 * "garlic bread", "lasagne" - and making them find the category first is a step
 * they did not ask for. This hands them straight to the matching items.
 *
 * It navigates rather than filtering in place, because the hero is on the home
 * page and the results belong on the menu, where the basket controls are.
 */
export function MenuSearchPill({ suggestions = [] }: { suggestions?: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(term: string) {
    const value = term.trim();
    router.push(value ? `/menu?q=${encodeURIComponent(value)}` : "/menu");
  }

  return (
    <div className="fp-herosearch">
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
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the menu"
          autoComplete="off"
        />
        {/* Icon only. A word here forced the bar to wrap onto two rows on a
            phone, which is what made it look bolted together. */}
        <button type="submit" aria-label="Search the menu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />
          </svg>
        </button>
      </form>

      {suggestions.length > 0 ? (
        <div className="fp-herosearch-chips">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => go(s)}>{s}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
