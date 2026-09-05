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
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Which two letters get the accent.
 *
 * One adjacent pair per name, chosen from the name itself so it never moves
 * while a word is being typed and never lands on a space. Deterministic rather
 * than random because the same pizza should look the same every time it comes
 * round, and because randomness in a render is a hydration mismatch waiting to
 * happen.
 */
function accentPair(word: string, salt: number): [number, number] {
  const letters = [...word].map((c, i) => (/[a-z]/i.test(c) ? i : -1)).filter((i) => i >= 0);
  // Need two letters side by side, so only positions with a letter after them.
  const starts = letters.filter((i) => letters.includes(i + 1));
  if (starts.length === 0) return [-1, -1];
  let hash = salt * 2654435761;
  for (const ch of word) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const start = starts[hash % starts.length]!;
  return [start, start + 1];
}

/** The typed text as HTML, with its one accent pair picked out. */
function paintWith(text: string, word: string, salt: number): string {
  const [a, b] = accentPair(word, salt);
  if (a < 0) return escapeHtml(text);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = escapeHtml(text[i]!);
    out += i === a || i === b ? `<span class="fp-hero-h1-hi">${ch}</span>` : ch;
  }
  return out;
}

export function TypewriterTitle({
  prefix,
  items,
  typeMs = 55,
  deleteMs = 22,
  holdMs = 1500,
  as = "h1",
  className,
}: {
  prefix: string;
  items: string[];
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  /** The closing band wants this typing too, but the page already has its h1. */
  as?: "h1" | "h2" | "p";
  className?: string;
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
    const paint = (text: string, i: number) => paintWith(text, words[i] ?? "", i);

    const write = (s: string, wordIndex: number) => {
      // rAF so the text lands in the same frame the browser is already painting
      // rather than forcing an extra layout mid-animation.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { node.innerHTML = paint(s, wordIndex); });
    };

    const step = () => {
      const word = words[index] ?? "";
      if (!deleting && cut < word.length) {
        cut += 1; write(word.slice(0, cut), index); timer = setTimeout(step, typeMs); return;
      }
      if (!deleting) {
        deleting = true; timer = setTimeout(step, holdMs); return;
      }
      if (cut > 0) {
        cut -= 1; write(word.slice(0, cut), index); timer = setTimeout(step, deleteMs); return;
      }
      deleting = false;
      index = (index + 1) % words.length;
      timer = setTimeout(step, typeMs);
    };

    timer = setTimeout(step, holdMs);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [animate, words, typeMs, deleteMs, holdMs]);

  const Tag = as;
  return (
    <Tag className={`fp-hero-h1 ${className ?? ""}`.trim()}>
      <span className="fp-hero-h1-lead">{prefix}</span>
      <span className="fp-hero-h1-swap" aria-hidden="true">
        <span
          className="fp-hero-h1-word"
          ref={wordRef}
          dangerouslySetInnerHTML={{ __html: paintWith(words[0] ?? "", words[0] ?? "", 0) }}
        />
        <span className="fp-hero-caret" data-on={animate ? "1" : undefined} />
      </span>
      {/* Announced once, as a sentence, not a character at a time. */}
      <span className="fp-visually-hidden">{prefix} {words.join(", ")}</span>
    </Tag>
  );
}
