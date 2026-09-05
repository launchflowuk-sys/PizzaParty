import Link from "next/link";
import { notFound } from "next/navigation";
import { requireScreen, currentAgency } from "@/lib/session";
import { helpArticle, helpVars, fillVars, slugifyHeading } from "@/lib/help";
import { renderMarkdown } from "@/lib/markdown";
import { SCREEN_LABEL, can, pathForScreen, type Screen } from "@/lib/permissions";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * One help article.
 *
 * Headings get anchors so search can land on the paragraph rather than the top
 * of a thousand words, and every screen the article covers gets a button —
 * reading how to do something and then having to go and find it is the bit
 * that makes people give up.
 */
export default async function HelpArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireScreen("help");
  const isAgency = await currentAgency();

  const article = await helpArticle(id, staff.role, { isAgency });
  if (!article) notFound();

  const vars = await helpVars();
  const cfg = getConfig();

  // Anchors are added before rendering so they survive into the HTML.
  const withAnchors = article.body.replace(/^##\s+(.+)$/gm, (_m, text: string) => `## <a id="${slugifyHeading(text.trim())}"></a>${text}`);
  const html = renderMarkdown(fillVars(withAnchors, vars));
  const screens = article.screens.filter((s) => can(staff.role, s as Screen));

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>
            <Link href="/admin/help">Help</Link>
            {article.kind === "runbook" ? " · If something has gone wrong" : ""}
          </span>
          <h1>{fillVars(article.title, vars)}</h1>
        </div>
      </header>

      {screens.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)", alignSelf: "center" }}>Go to:</span>
          {screens.map((s) => (
            <Link key={s} href={pathForScreen(s as Screen)} className="btn btn-secondary">
              {SCREEN_LABEL[s as Screen]}
            </Link>
          ))}
        </div>
      ) : null}

      <article
        className="lf-prose"
        style={{ maxWidth: "72ch", fontSize: 15, lineHeight: 1.65 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {article.kind === "runbook" ? (
        <div className="fp-panel" data-tone="danger" style={{ marginTop: 28, maxWidth: "72ch" }}>
          <header>If it is still wrong</header>
          <div className="body" style={{ fontSize: 14 }}>
            Ring the shop on <strong>{cfg.contact.phone}</strong>. If it is the website itself,
            ring LaunchFlow with the time it started and one order number that went wrong.
          </div>
        </div>
      ) : null}

      <p style={{ marginTop: 24, fontSize: 12, color: "var(--color-neutral-700)" }}>
        {article.updated ? <>Last checked {article.updated}. </> : null}
        <Link href="/admin/help">Back to help</Link>
      </p>
    </>
  );
}
