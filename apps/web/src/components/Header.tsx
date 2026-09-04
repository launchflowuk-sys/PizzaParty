import Link from "next/link";
import { ModeSeg } from "./ModeSeg";
import { BasketBadge } from "./basket/BasketBadge";
import type { Fulfilment } from "@/lib/basket-types";

/* The prototype nav also carries "Build your own" and "Crust Club"; those screens are
   not built yet, so they are held back rather than shipped as dead links - see
   PROGRESS.md. Add each one here as its route lands. */
const LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/deals", label: "Deals" },
  { href: "/shops", label: "Shops" },
];

/** Storefront nav. Ported from the `Farm Pizza.dc.html` prototype: brand flush left,
 *  links, order-mode segmented control, account, then the basket as the primary action. */
export function Header({ name, fulfilment }: { name: string; fulfilment: Fulfilment[] }) {
  return (
    <nav
      className="nav"
      style={{
        position: "sticky", top: 0, zIndex: 10, background: "var(--color-bg)",
        paddingInline: "max(32px, calc((100% - 1200px) / 2 + 32px))",
      }}
    >
      <Link href="/" className="nav-brand" style={{ letterSpacing: "-.01em" }}>
        {name.toUpperCase()}
      </Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} style={{ whiteSpace: "nowrap" }}>{l.label}</Link>
      ))}
      <ModeSeg fulfilment={fulfilment} />
      <Link href="/account" style={{ whiteSpace: "nowrap" }}>Account</Link>
      <BasketBadge />
    </nav>
  );
}
