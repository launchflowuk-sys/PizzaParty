import Link from "next/link";
import Image from "next/image";
import { ModeSeg } from "./ModeSeg";
import { BasketBadge } from "./basket/BasketBadge";
import type { Fulfilment } from "@/lib/basket-types";

/* The prototype nav also carries "Build your own"; that screen is not built yet,
   so it is held back rather than shipped as a dead link - see PROGRESS.md. Add
   it here when its route lands.

   Crust Club is here now that points can be spent, but only when the shop runs
   the scheme: /rewards 404s when it does not, and a nav link to a 404 is worse
   than no link. */
const LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/deals", label: "Deals" },
  { href: "/shops", label: "Shops" },
];

/** Storefront nav. Ported from the `Farm Pizza.dc.html` prototype: brand flush left,
 *  links, order-mode segmented control, account, then the basket as the primary action. */
export function Header({ name, logo, fulfilment, loyalty }: { name: string; logo: string; fulfilment: Fulfilment[]; loyalty: boolean }) {
  const links = loyalty ? [...LINKS, { href: "/rewards", label: "Crust Club" }] : LINKS;
  return (
    <nav
      className="nav"
      style={{
        position: "sticky", top: 0, zIndex: 10, background: "var(--color-bg)",
        paddingInline: "max(32px, calc((100% - 1200px) / 2 + 32px))",
      }}
    >
      {/* The prototype sets the brand as an Archivo wordmark; this shop has a real mark,
          so it takes that slot. Not wrapped in .grayscale - that is for photographs, and a
          brand mark keeps its own colour. */}
      <Link href="/" className="nav-brand" aria-label={`${name} home`} style={{ display: "flex", alignItems: "center", marginRight: "auto" }}>
        {logo ? (
          <Image src={logo} alt={name} width={128} height={128} priority className="fp-logo" unoptimized={logo.endsWith(".svg")} />
        ) : (
          name.toUpperCase()
        )}
      </Link>
      {/* Grouped so the mobile layout can place links and the mode control as their
          own rows instead of letting everything reflow into a crush. */}
      <div className="nav-links">
        {links.map((l) => (
          <Link key={l.href} href={l.href} style={{ whiteSpace: "nowrap" }}>{l.label}</Link>
        ))}
        <Link href="/account" style={{ whiteSpace: "nowrap" }}>Account</Link>
      </div>
      <ModeSeg fulfilment={fulfilment} />
      <BasketBadge />
    </nav>
  );
}
