import Link from "next/link";

/**
 * The answer to what just happened.
 *
 * Menu changes are the one part of the back office that can be refused - the
 * last size, a section with items still in it - and a refusal has to be
 * readable by someone halfway through a shift, not swallowed. Server actions
 * redirect back here with `?m=` for done and `?e=` for refused; both clear on
 * the next navigation, so nothing lingers on the screen.
 */
export function AdminNotice({ message, error, back }: { message?: string; error?: string; back: string }) {
  const text = error || message;
  if (!text) return null;
  const bad = !!error;

  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "12px 16px", marginBottom: 16, borderRadius: 10,
        background: bad ? "var(--danger-bg)" : "var(--ok-bg)",
        boxShadow: `inset 4px 0 0 ${bad ? "var(--danger)" : "var(--ok)"}`,
        color: bad ? "var(--danger)" : "var(--ok)",
        fontSize: 14, fontWeight: 700,
      }}
    >
      <span>{text}</span>
      <Link href={back} style={{ color: "inherit", opacity: .7, fontWeight: 800, textDecoration: "none" }} aria-label="Dismiss">
        &times;
      </Link>
    </div>
  );
}
