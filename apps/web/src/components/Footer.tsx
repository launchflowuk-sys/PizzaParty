import Link from "next/link";
import Image from "next/image";
import { PaymentBadges } from "@/components/PaymentBadges";
import { SignupForm } from "@/components/SignupForm";

const COL: React.CSSProperties = { display: "grid", gap: 8, alignContent: "start" };

/**
 * The last thing anybody sees.
 *
 * It was three columns of grey links on the page ground, which read as the
 * bottom of a document rather than the end of a shop. It carries the shop's
 * mark now, one thing worth doing (hearing about the deals), and an honest
 * statement of what can be paid with.
 *
 * The payment marks are real files or nothing - see PaymentBadges. A drawn
 * approximation of a Visa logo is worse than no logo: it is recognisably fake,
 * which undoes the only reason the badge is there.
 */
export function Footer({
  name,
  phone,
  address,
  localities,
  loyalty,
  logo,
  payments,
}: {
  name: string;
  phone: string;
  address: string;
  localities: { name: string; path: string }[];
  loyalty: boolean;
  logo: string;
  /** Which payment marks the shop actually has files for. */
  payments: string[];
}) {
  return (
    <footer>
      <div className="fp-wrap fp-footer-top">
        <div className="fp-footer-brand">
          {logo ? (
            <Image src={logo} alt={name} width={92} height={92} className="fp-footer-logo" unoptimized={logo.endsWith(".svg")} />
          ) : (
            <span className="fp-footer-wordmark">{name.toUpperCase()}</span>
          )}
          {address ? <span className="fp-footer-addr">{address}</span> : null}
          {phone ? (
            <a href={`tel:${phone.replace(/\s+/g, "")}`} className="fp-footer-tel">{phone}</a>
          ) : null}
        </div>

        <div style={COL}>
          <span className="fp-footer-h">Order</span>
          <Link href="/menu">Menu</Link>
          <Link href="/deals">Deals</Link>
          {loyalty ? <Link href="/rewards">Crust Club</Link> : null}
          <Link href="/shops">Shops</Link>
          <Link href="/account">My account</Link>
        </div>

        <div style={COL}>
          <span className="fp-footer-h">Delivering to</span>
          {localities.map((l) => <Link key={l.path} href={l.path}>{l.name}</Link>)}
        </div>

        <div style={COL}>
          <span className="fp-footer-h">Info</span>
          <Link href="/contact">Contact &amp; opening hours</Link>
          <Link href="/allergens">Allergens</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>

      {/* One thing worth doing down here. Deliberately not a pop-up. */}
      <div className="fp-footer-signup">
        <div className="fp-wrap fp-footer-signup-inner">
          <div>
            <span className="fp-footer-h">Hear about the deals first</span>
            <p>A text when something good is on. Never more than once a week, and one word stops it.</p>
          </div>
          <SignupForm />
        </div>
      </div>

      <div className="fp-footer-bottom">
        <div className="fp-wrap fp-footer-bottom-inner">
          <PaymentBadges available={payments} />
          <div className="fp-footer-legal">
            <span>&copy; {new Date().getFullYear()} {name}. Prices include VAT.</span>
            <span className="fp-footer-lf">
              Powered by <strong>LaunchFlow</strong>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
