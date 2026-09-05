"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Find an item on a 68-product menu without scrolling.
 *
 * The one thing staff do on this screen in a hurry is mark something sold out,
 * usually mid-service with a queue building. Scrolling seven categories to find
 * "Chicken Strips" is the difference between doing it now and doing it later.
 *
 * Filters the rendered rows rather than re-fetching, so it responds on the
 * keystroke and the open/closed state of each category is preserved.
 */
export function MenuFilter({ total }: { total: number }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(total);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    let visible = 0;

    for (const row of document.querySelectorAll<HTMLElement>("[data-menu-item]")) {
      const hay = row.dataset.search ?? "";
      const match = !term || hay.includes(term);
      row.hidden = !match;
      if (match) visible++;
    }

    // A category with nothing left in it is noise, and it has to spring open
    // when a search does match inside it or the result is invisible.
    for (const group of document.querySelectorAll<HTMLDetailsElement>("[data-menu-group]")) {
      const hits = group.querySelectorAll<HTMLElement>("[data-menu-item]:not([hidden])").length;
      group.hidden = term ? hits === 0 : false;
      if (term && hits > 0) group.open = true;
      const badge = group.querySelector<HTMLElement>("[data-menu-count]");
      if (badge) {
        const inGroup = badge.dataset.menuCountValue ?? "";
        badge.textContent = term ? `${hits} of ${inGroup}` : inGroup;
      }
    }

    setShown(visible);
  }, [q, total]);

  // "/" focuses the box, the way every search field a shop already uses does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fp-panel" style={{ position: "sticky", top: 0, zIndex: 5 }}>
      <header>
        <span>Find an item</span>
        <span style={{ fontWeight: 700 }}>{shown} of {total}</span>
      </header>
      <div className="body" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <input
          ref={input}
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a name or a topping —  press /  to jump here"
          aria-label="Filter the menu"
          style={{ flex: "1 1 240px", minWidth: 0 }}
        />
        {q ? <button type="button" className="btn btn-secondary" onClick={() => setQ("")}>Clear</button> : null}
      </div>
    </div>
  );
}
