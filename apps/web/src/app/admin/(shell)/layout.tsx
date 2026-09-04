import Link from "next/link";
import { getConfig } from "@/lib/config";
import { getClientRow } from "@/lib/menu";
import { prisma } from "@launchflow/db";

/** Back-office nav. `mark` is the square bullet the prototype puts before each label;
 *  it fills accent for the current screen. Screens the prototype has but this build
 *  does not yet (inventory, dispatch, staff, reviews) are absent rather than dead. */
const NAV: { href: string; label: string }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/kitchen", label: "Kitchen queue" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/menu", label: "Menu & pricing" },
  { href: "/admin/deals", label: "Deals" },
  { href: "/admin/promos", label: "Promotions" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/hours", label: "Hours & pause" },
  { href: "/admin/zones", label: "Delivery zones" },
];

/** Wraps every back-office screen in the chrome. `/admin/login` sits outside this
 *  route group on purpose, so the sign-in page does not render inside the shell -
 *  the previous `x-invoke-path` header check no longer fires in current Next. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cfg = getConfig();
  const client = await getClientRow();
  const live = await prisma.order.count({
    where: { clientId: client.id, status: { in: ["placed", "accepted", "preparing", "ready", "out_for_delivery"] } },
  });

  return (
    <div className="fp-admin">
      <aside className="fp-adminrail">
        <div style={{ marginBottom: 16 }}>
          <div className="nav-brand" style={{ margin: 0, letterSpacing: "-.01em" }}>{cfg.name.toUpperCase()}</div>
          <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent-700)", marginTop: 2 }}>
            Back office
          </div>
        </div>

        <nav className="nav" style={{ flexDirection: "column", alignItems: "stretch", gap: 0, padding: 0, borderBottom: "2px solid var(--color-divider)" }}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 6px", borderTop: "1px solid var(--color-divider)", whiteSpace: "nowrap", color: "inherit" }}
            >
              <span style={{ width: 8, height: 8, flex: "none", background: "var(--color-neutral-400)" }} />
              <span style={{ flex: 1 }}>{n.label}</span>
              {n.href === "/kitchen" && live > 0 ? <span className="tag tag-accent">{live}</span> : null}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: "auto", fontSize: 12, color: "var(--color-neutral-700)", lineHeight: 1.5 }}>
          <Link href="/" style={{ fontSize: 12 }}>Open the storefront &rarr;</Link>
          <br />
          <Link href="/admin/launchflow" style={{ fontSize: 12 }}>LaunchFlow &rarr;</Link>
        </div>
      </aside>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <main style={{ flex: 1, padding: "24px 32px 48px", minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
