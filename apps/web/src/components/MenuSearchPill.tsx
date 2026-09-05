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
          placeholder="Search the menu — pepperoni, garlic bread, lasagne"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary">Search</button>
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
