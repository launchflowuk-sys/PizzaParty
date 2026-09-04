import Link from "next/link";

export function Footer({ name, phone, address, localities }: { name: string; phone: string; address: string; localities: { name: string; path: string }[] }) {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="lf-container py-10 grid gap-8 sm:grid-cols-3 text-sm">
        <div>
          <p className="font-extrabold text-base">{name}</p>
          {address ? <p className="text-muted mt-1">{address}</p> : null}
          {phone ? <a className="block mt-1 text-brand font-semibold" href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</a> : null}
        </div>
        <div>
          <p className="font-bold mb-2">Order</p>
          <ul className="space-y-1 text-ink-soft">
            <li><Link href="/menu">Menu</Link></li>
            <li><Link href="/deals">Deals</Link></li>
            <li><Link href="/account">My account</Link></li>
            {localities.map((l) => <li key={l.path}><Link href={l.path}>{l.name} delivery</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="font-bold mb-2">Info</p>
          <ul className="space-y-1 text-ink-soft">
            <li><Link href="/contact">Contact & opening hours</Link></li>
            <li><Link href="/allergens">Allergens</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="lf-container py-4 text-xs text-muted flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} {name}</span>
          <a href="https://launchflow.uk" rel="noopener" className="font-semibold">Powered by LaunchFlow</a>
        </div>
      </div>
    </footer>
  );
}
