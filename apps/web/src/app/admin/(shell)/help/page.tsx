import { requireScreen, currentAgency } from "@/lib/session";
import { helpFor, toIndex, helpVars, fillVars } from "@/lib/help";
import { getConfig } from "@/lib/config";
import { HelpSearch } from "@/components/admin/HelpSearch";

export const dynamic = "force-dynamic";

/** The help centre. What everything does, and what to do when it goes wrong. */
export default async function HelpIndex() {
  const staff = await requireScreen("help");
  const isAgency = await currentAgency();
  const [articles, vars] = await Promise.all([
    helpFor(staff.role, { isAgency }),
    helpVars(),
  ]);
  const cfg = getConfig();

  // Fill {shop}/{phone} in the index too, or a search for the shop's name misses.
  const entries = toIndex(articles).map((e) => ({
    ...e,
    title: fillVars(e.title, vars),
    summary: fillVars(e.summary, vars),
  }));

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Help</h1>
        </div>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          Written for {cfg.name}
        </span>
      </header>

      <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 20px", maxWidth: "78ch" }}>
        You are seeing the articles for your own sign-in. Somebody with a different
        role sees a different list, so nothing here mentions a screen you cannot open.
      </p>

      <HelpSearch entries={entries} phone={cfg.contact.phone} />
    </>
  );
}
