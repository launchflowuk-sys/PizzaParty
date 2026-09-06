"use client";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Keep the thing somebody is working on where they can see it.
 *
 * The bug this exists to kill, measured on the live site: on a deal, the list
 * of pizzas is 5036px tall. Scroll to 3200 hunting for one, tap it, and the
 * list collapses to the next step - the page is now 3396px. The browser has no
 * choice but to clamp the scroll to the new maximum, 2584, which is the bottom
 * of the document. The customer is looking at the footer, and nothing they did
 * caused it.
 *
 * The old guard tried to be polite - only scroll "if the step is off screen" -
 * and that is exactly why it failed. It measured before the layout had settled,
 * and after the clamp the step often *is* on screen by that test while being
 * nowhere near where the eye is.
 *
 * So: whenever the step changes, put it in the same place every time. A
 * predictable jump is not a jump; it is the page following you.
 */
export function useKeepInView(
  ref: RefObject<HTMLElement | null>,
  key: string,
  opts: { offset?: number } = {},
) {
  const first = useRef(true);

  useEffect(() => {
    // Not on mount. Landing on a page should show its top, not scroll it.
    if (first.current) {
      first.current = false;
      return;
    }

    const el = ref.current;
    if (!el) return;

    // Two frames, deliberately. One gets past React's commit; the second gets
    // past the browser's own layout and scroll clamp, which is the thing being
    // corrected. Measuring in a single frame reads the position the element is
    // about to leave.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top + window.scrollY - (opts.offset ?? 16);
        window.scrollTo({
          top: Math.max(0, top),
          // Explicitly instant. Anything animated here races the layout that
          // just changed and lands somewhere neither of us chose.
          behavior: "auto",
        });
      });
    });

    return () => cancelAnimationFrame(id);
  }, [key, ref, opts.offset]);
}
