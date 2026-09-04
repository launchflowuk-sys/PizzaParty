import Link from "next/link";
import { headers } from "next/headers";

const NAV: [string, string][] = [["/admin", "Dashboard"], ["/admin/orders", "Orders"], ["/admin/menu", "Menu"], ["/admin/deals", "Deals"], ["/admin/promos", "Promos"], ["/admin/hours", "Hours & pause"], ["/admin/zones", "Delivery zones"], ["/admin/customers", "Customers"], ["/admin/campaigns", "Campaigns"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const isLogin = (h.get("x-invoke-path") ?? "").endsWith("/admin/login");
  if (isLogin) return children;
  return (
    <div className="fixed inset-0 z-50 bg-surface-2 overflow-y-auto">
      <div className="flex min-h-full">
        <aside className="w-52 shrink-0 bg-surface border-r border-line p-4 hidden md:block">
          <p className="font-extrabold">Admin</p>
          <nav className="mt-4 space-y-1 text-sm">{NAV.map(([href, label]) => <Link key={href} href={href} className="block px-2 py-1.5 rounded-lg hover:bg-surface-2">{label}</Link>)}</nav>
          <div className="mt-6 text-xs text-muted space-y-1"><Link href="/kitchen" className="block">Kitchen screen ↗</Link><Link href="/" className="block">Storefront ↗</Link><Link href="/admin/launchflow" className="block">LaunchFlow</Link></div>
        </aside>
        <div className="flex-1 min-w-0">
          <nav className="md:hidden flex gap-2 overflow-x-auto hide-scrollbar p-3 bg-surface border-b border-line text-sm">{NAV.map(([href, label]) => <Link key={href} href={href} className="lf-pill bg-surface-2 shrink-0">{label}</Link>)}</nav>
          <div className="p-4 sm:p-6 max-w-5xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
