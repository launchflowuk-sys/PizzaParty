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
/**
 * The three things somebody came here to do, and the two they might.
 *
 * They were five underlined words set the same size with a few pixels between
 * them, which reads as a footer rather than a way to order food. Menu, Deals and
 * Crust Club are buttons with a mark on them now, Menu carries the accent
 * because it is what nearly everybody wants, and Shops and Account stay quiet
 * text because they are errands rather than the point of the visit.
 */
const ICON = {
  menu: "M4 6h16M4 12h16M4 18h10",
  deals: "M20.6 12.6 12.7 4.7A2 2 0 0 0 11.3 4H5a1 1 0 0 0-1 1v6.3a2 2 0 0 0 .6 1.4l7.9 7.9a2 2 0 0 0 2.8 0l5.3-5.3a2 2 0 0 0 0-2.7ZM8 8h.01",
  club: "m12 3 2.6 5.7 6.4.7-4.8 4.2 1.4 6.4L12 16.8 6.4 20l1.4-6.4L3 9.4l6.4-.7Z",
} as const;

const LINKS: { href: string; label: string; icon: keyof typeof ICON; primary?: boolean }[] = [
  { href: "/menu", label: "Menu", icon: "menu", primary: true },
  { href: "/deals", label: "Deals", icon: "deals" },
];

const QUIET = [
  { href: "/shops", label: "Shops" },
  { href: "/account", label: "Account" },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
      strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Storefront nav. Ported from the `Farm Pizza.dc.html` prototype: brand flush left,
 *  links, order-mode segmented control, account, then the basket as the primary action. */
export function Header({ name, logo, fulfilment, loyalty }: { name: string; logo: string; fulfilment: Fulfilment[]; loyalty: boolean }) {
  const links = loyalty
    ? [...LINKS, { href: "/rewards", label: "Crust Club", icon: "club" as const }]
    : LINKS;
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
          <Link key={l.href} href={l.href} className="nav-pill" data-primary={l.primary ? "1" : undefined}>
            <NavIcon d={ICON[l.icon]} />
            {l.label}
          </Link>
        ))}
        <span className="nav-quiet">
          {QUIET.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
        </span>
      </div>
      <ModeSeg fulfilment={fulfilment} />
      <BasketBadge />
    </nav>
  );
}
