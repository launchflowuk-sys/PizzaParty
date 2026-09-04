import Link from "next/link";
import { BasketBadge } from "./basket/BasketBadge";

export function Header({ name, logo, phone }: { name: string; logo: string; phone: string }) {
  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-line">
      <div className="lf-container flex items-center justify-between h-14 gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0" aria-label={`${name} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} width={140} height={36} className="h-9 w-auto" />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link href="/menu" className="px-3 py-2 rounded-full hover:bg-surface-2">Menu</Link>
          <Link href="/deals" className="px-3 py-2 rounded-full hover:bg-surface-2">Deals</Link>
          {phone ? <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hidden sm:inline px-3 py-2 rounded-full hover:bg-surface-2">Call</a> : null}
          <Link href="/account" className="px-3 py-2 rounded-full hover:bg-surface-2" aria-label="Account">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
          </Link>
          <BasketBadge />
        </nav>
      </div>
    </header>
  );
}
