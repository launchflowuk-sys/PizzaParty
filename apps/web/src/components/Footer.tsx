import Link from "next/link";

const COL: React.CSSProperties = { display: "grid", gap: 6, alignContent: "start" };
const HEAD: React.CSSProperties = { fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-700)", marginBottom: 6 };

/** Storefront footer on the Modernist system: a 2px rule, then flush-left columns.
 *  No card, no rounding - the rule and the alignment do the organising. */
export function Footer({ name, phone, address, localities }: { name: string; phone: string; address: string; localities: { name: string; path: string }[] }) {
  return (
    <footer style={{ marginTop: 64, borderTop: "2px solid var(--color-divider)" }}>
      <div className="fp-wrap fp-footer" style={{ padding: "40px 32px" }}>
        <div style={COL}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, letterSpacing: "-.01em" }}>{name.toUpperCase()}</span>
          {address ? <span style={{ color: "var(--color-neutral-700)" }}>{address}</span> : null}
          {phone ? <a href={`tel:${phone.replace(/\s+/g, "")}`} style={{ fontWeight: 600 }}>{phone}</a> : null}
        </div>

        <div style={COL}>
          <span style={HEAD}>Order</span>
          <Link href="/menu">Menu</Link>
          <Link href="/deals">Deals</Link>
          <Link href="/shops">Shops</Link>
          <Link href="/account">My account</Link>
          {localities.map((l) => <Link key={l.path} href={l.path}>{l.name} delivery</Link>)}
        </div>

        <div style={COL}>
          <span style={HEAD}>Info</span>
          <Link href="/contact">Contact &amp; opening hours</Link>
          <Link href="/allergens">Allergens</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div className="fp-wrap" style={{ padding: "16px 32px", fontSize: 12, color: "var(--color-neutral-600)", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span>&copy; {new Date().getFullYear()} {name}. Prices include VAT.</span>
          <span>Powered by LaunchFlow</span>
        </div>
      </div>
    </footer>
  );
}
