import Link from "next/link";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getConfig } from "@/lib/config";
import { getClientRow } from "@/lib/menu";
import { prisma } from "@launchflow/db";
import { currentStaff } from "@/lib/session";
import { can, ROLE_LABEL, type Screen } from "@/lib/permissions";
import { redirect } from "next/navigation";

/** Back-office nav, in the prototype's order. The square bullet before each label is
 *  the prototype's marker. */
const NAV: { href: string; label: string; screen: Screen }[] = [
  { screen: "dashboard", href: "/admin", label: "Dashboard" },
  { screen: "kitchen", href: "/kitchen", label: "Kitchen queue" },
  { screen: "orders", href: "/admin/orders", label: "Orders" },
  { screen: "dispatch", href: "/admin/dispatch", label: "Dispatch" },
  { screen: "menu", href: "/admin/menu", label: "Menu & pricing" },
  { screen: "deals", href: "/admin/deals", label: "Deals" },
  { screen: "promos", href: "/admin/promos", label: "Promotions" },
  { screen: "loyalty", href: "/admin/loyalty", label: "Rewards club" },
  { screen: "inventory", href: "/admin/inventory", label: "Inventory" },
  { screen: "customers", href: "/admin/customers", label: "Customers" },
  { screen: "campaigns", href: "/admin/campaigns", label: "Campaigns" },
  { screen: "marketing", href: "/admin/marketing", label: "Marketing" },
  { screen: "reviews", href: "/admin/reviews", label: "Reviews" },
  { screen: "staff", href: "/admin/staff", label: "Staff" },
  { screen: "hours", href: "/admin/hours", label: "Hours & pause" },
  { screen: "zones", href: "/admin/zones", label: "Delivery zones" },
  { screen: "notifications", href: "/admin/notifications", label: "Notifications" },
  { screen: "help", href: "/admin/help", label: "Help" },
];

/** Wraps every back-office screen in the chrome. `/admin/login` sits outside this
 *  route group on purpose, so the sign-in page does not render inside the shell -
 *  the previous `x-invoke-path` header check no longer fires in current Next. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");

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
          {NAV.filter((n) => can(staff.role, n.screen)).map((n) => (
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

        <div className="fp-adminwho">
          <div className="who">
            <strong>{staff.name}</strong>
            <span>{ROLE_LABEL[staff.role]}</span>
          </div>
          <div className="links">
            <Link href="/">Open the storefront &rarr;</Link>
            <Link href="/admin/launchflow">LaunchFlow &rarr;</Link>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <main style={{ flex: 1, padding: "24px 32px 48px", minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}
