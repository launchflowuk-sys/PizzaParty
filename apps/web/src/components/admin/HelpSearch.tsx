"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type HelpEntry = {
  id: string;
  title: string;
  summary: string;
  kind: "guide" | "runbook" | "reference";
  keywords: string[];
  headings: { id: string; text: string }[];
};

/**
 * Searching the help centre.
 *
 * Scored rather than filtered, because the words a shop types are not the words
 * a manual uses. Somebody typing "86" or "run out" means "mark it sold out",
 * and the keyword list on each article is what carries that - it is the actual
 * product here, more than the prose is.
 *
 * Runbooks win ties. If a person is searching help during service, something
 * has gone wrong and they want the fix, not the tour.
 */
function score(entry: HelpEntry, terms: string[]): number {
  const title = entry.title.toLowerCase();
  const summary = entry.summary.toLowerCase();
  let total = 0;

  for (const term of terms) {
    let best = 0;
    if (title === term) best = 120;
    else if (title.startsWith(term)) best = 80;
    else if (title.includes(term)) best = 55;

    for (const k of entry.keywords) {
      if (k === term) best = Math.max(best, 100);
      else if (k.startsWith(term)) best = Math.max(best, 70);
      else if (k.includes(term)) best = Math.max(best, 40);
    }
    for (const h of entry.headings) {
      if (h.text.toLowerCase().includes(term)) best = Math.max(best, 45);
    }
    if (summary.includes(term)) best = Math.max(best, 25);

    // Every word has to land somewhere, or "sold out promo" would match an
    // article about promos that never mentions selling out.
    if (best === 0) return 0;
    total += best;
  }

  if (entry.kind === "runbook") total += 30;
  return total;
}

/** The heading within an article that best answers the search, so we can deep-link. */
function bestHeading(entry: HelpEntry, terms: string[]) {
  return entry.headings.find((h) => terms.some((t) => h.text.toLowerCase().includes(t))) ?? null;
}

const KIND_LABEL = { runbook: "If it goes wrong", guide: "How to", reference: "Reference" } as const;

export function HelpSearch({ entries, phone }: { entries: HelpEntry[]; phone: string }) {
  const [q, setQ] = useState("");
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      box.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const results = useMemo(() => {
    if (!terms.length) return null;
    return entries
      .map((e) => ({ entry: e, s: score(e, terms), heading: bestHeading(e, terms) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 20);
  }, [entries, terms.join(" ")]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const by: Record<string, HelpEntry[]> = { runbook: [], guide: [], reference: [] };
    for (const e of entries) by[e.kind]?.push(e);
    return by;
  }, [entries]);

  return (
    <>
      <div className="fp-panel">
        <header>
          <span>Search</span>
          <span style={{ fontWeight: 700, opacity: .8 }}>{entries.length} articles</span>
        </header>
        <div className="body">
          <input
            ref={box}
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What has gone wrong? — try “sold out”, “refund”, “card machine”, “stop texts”"
            aria-label="Search the help centre"
            style={{ fontSize: 16 }}
          />
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-neutral-700)" }}>
            Press <kbd>/</kbd> from anywhere to jump here.
          </p>
        </div>
      </div>

      {results ? (
        results.length === 0 ? (
          <div className="fp-panel" data-tone="warn">
            <header>Nothing matched &ldquo;{q}&rdquo;</header>
            <div className="body">
              <p style={{ marginTop: 0 }}>
                It may be something this system genuinely cannot do &mdash; that list is worth reading:
              </p>
              <p style={{ margin: "0 0 14px" }}>
                <Link href="/admin/help/what-this-system-does-not-do"><strong>What this system does not do</strong></Link>
              </p>
              <p style={{ margin: 0, fontSize: 14 }}>
                Still stuck? Ring the shop on <strong>{phone}</strong>, or{" "}
                <Link href="/admin/help/who-to-ring">see who to ring</Link>.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <span className="fp-kicker" style={{ marginBottom: 10 }}>{results.length} result{results.length === 1 ? "" : "s"}</span>
            {results.map(({ entry, heading }) => (
              <Link
                key={entry.id}
                href={`/admin/help/${entry.id}${heading ? `#${heading.id}` : ""}`}
                style={{ display: "block", border: "2px solid var(--color-divider)", padding: "12px 14px", marginBottom: 8, color: "inherit" }}
              >
                <span className={`tag tag-${entry.kind === "runbook" ? "danger" : "info"}`}>{KIND_LABEL[entry.kind]}</span>
                <strong style={{ display: "block", marginTop: 6 }}>{entry.title}</strong>
                <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{entry.summary}</span>
                {heading ? (
                  <span style={{ display: "block", marginTop: 6, fontSize: 13 }}>
                    &rarr; <strong>{heading.text}</strong>
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        )
      ) : (
        <div style={{ marginTop: 16 }}>
          {(["runbook", "guide", "reference"] as const).map((kind) =>
            grouped[kind]!.length === 0 ? null : (
              <section key={kind} style={{ marginBottom: 28 }}>
                <span className="fp-kicker" style={{ marginBottom: 10 }}>
                  {kind === "runbook" ? "If something has gone wrong" : kind === "guide" ? "How to" : "Reference"}
                </span>
                <div style={{ borderTop: "2px solid var(--color-divider)" }}>
                  {grouped[kind]!.map((e) => (
                    <Link
                      key={e.id}
                      href={`/admin/help/${e.id}`}
                      style={{ display: "block", padding: "11px 0", borderBottom: "1px solid var(--color-divider)", color: "inherit" }}
                    >
                      <strong>{e.title}</strong>
                      <span style={{ display: "block", fontSize: 13, color: "var(--color-neutral-700)" }}>{e.summary}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </>
  );
}
