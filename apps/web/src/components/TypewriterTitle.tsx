"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The rotating half of the hero headline.
 *
 * The line reads "Tonight, it's <something>", so the moving part is always a
 * noun that finishes the sentence - it parses at every frame, including
 * mid-word, rather than being a slogan with a hole in it.
 *
 * Written against a DOM ref rather than state on purpose. A character every
 * 55ms is eighteen React renders a second, and this sits on top of a full-bleed
 * photograph where every one of those renders competes with compositing. The
 * text node is the only thing that changes, so that is the only thing touched.
 */
export function TypewriterTitle({
  prefix,
  items,
  typeMs = 55,
  deleteMs = 22,
  holdMs = 1500,
}: {
  prefix: string;
  items: string[];
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
}) {
  const words = items.filter(Boolean);
  const wordRef = useRef<HTMLSpanElement>(null);
  const [animate, setAnimate] = useState(false);

  // Decided on the client, so the server-rendered HTML always carries a real
  // headline: no empty flash, and it still reads with JavaScript off.
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAnimate(!q.matches && words.length > 1);
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, [words.length]);

  useEffect(() => {
    const node = wordRef.current;
    if (!animate || !node) return;

    let index = 0;
    let cut = words[0]?.length ?? 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    let frame = 0;

    const write = (s: string) => {
      // rAF so the text lands in the same frame the browser is already painting
      // rather than forcing an extra layout mid-animation.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { node.textContent = s; });
    };

    const step = () => {
      const word = words[index] ?? "";
      if (!deleting && cut < word.length) {
        cut += 1; write(word.slice(0, cut)); timer = setTimeout(step, typeMs); return;
      }
      if (!deleting) {
        deleting = true; timer = setTimeout(step, holdMs); return;
      }
      if (cut > 0) {
        cut -= 1; write(word.slice(0, cut)); timer = setTimeout(step, deleteMs); return;
      }
      deleting = false;
      index = (index + 1) % words.length;
      timer = setTimeout(step, typeMs);
    };

    timer = setTimeout(step, holdMs);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [animate, words, typeMs, deleteMs, holdMs]);

  return (
    <h1 className="fp-hero-h1">
      <span className="fp-hero-h1-lead">{prefix}</span>
      <span className="fp-hero-h1-swap" aria-hidden="true">
        <span className="fp-hero-h1-word" ref={wordRef}>{words[0] ?? ""}</span>
        <span className="fp-hero-caret" data-on={animate ? "1" : undefined} />
      </span>
      {/* Announced once, as a sentence, not a character at a time. */}
      <span className="fp-visually-hidden">{prefix} {words.join(", ")}</span>
    </h1>
  );
}
