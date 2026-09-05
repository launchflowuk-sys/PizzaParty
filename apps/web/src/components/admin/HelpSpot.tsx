"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * A help marker beside a control.
 *
 * The help centre answers "how does this work"; a hotspot answers "what does
 * THIS button do", at the moment somebody is looking at it and hesitating.
 * Those are different questions and sending someone to a search box to answer
 * the second one is how help centres end up unused.
 *
 * The passage is passed in from the server, already filtered by role, so a
 * marker never reveals something the person is not allowed to know.
 */
export function HelpSpot({
  title,
  children,
  article,
  anchor,
  label = "What is this?",
}: {
  title: string;
  /** The short answer, shown in place. Keep it to a sentence or two. */
  children: React.ReactNode;
  /** Article id for the full explanation. */
  article?: string;
  anchor?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="fp-helpspot" ref={wrap}>
      <button
        type="button"
        className="fp-helpspot-dot"
        aria-expanded={open}
        aria-label={`${label}: ${title}`}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>

      {open ? (
        <span className="fp-helpspot-sheet" role="dialog" aria-label={title}>
          <strong>{title}</strong>
          <span className="fp-helpspot-body">{children}</span>
          {article ? (
            <Link href={`/admin/help/${article}${anchor ? `#${anchor}` : ""}`} onClick={() => setOpen(false)}>
              Read the full guide &rarr;
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
