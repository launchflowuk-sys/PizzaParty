/**
 * Who can reach which back-office screen.
 *
 * One matrix, used by three places that must never disagree: the sidebar (what you
 * can see), the page guards (what you can open) and the server actions (what you can
 * change). A permission removed here disappears from all three at once.
 */

export const STAFF_ROLES = ["manager", "shift_lead", "kitchen", "driver", "front_of_house", "kiosk"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABEL: Record<StaffRole, string> = {
  manager: "Manager",
  shift_lead: "Shift lead",
  kitchen: "Kitchen",
  driver: "Driver",
  front_of_house: "Front of house",
  // A self-service ordering screen, not a person: its PIN opens the kiosk and nothing else.
  kiosk: "Kiosk (self-service)",
};

/** Every guarded area of the back office. */
export const SCREENS = [
  "dashboard", "kitchen", "orders", "dispatch", "menu", "deals",
  "promos", "loyalty", "inventory", "customers", "campaigns", "reviews", "marketing",
  "staff", "hours", "zones", "notifications", "launchflow", "help", "pos", "reports", "kiosk",
] as const;
export type Screen = (typeof SCREENS)[number];

export const SCREEN_LABEL: Record<Screen, string> = {
  dashboard: "Dashboard", kitchen: "Kitchen queue", orders: "Orders", dispatch: "Dispatch",
  menu: "Menu & pricing", deals: "Deals", promos: "Promotions", loyalty: "Rewards club", inventory: "Inventory",
  customers: "Customers", campaigns: "Campaigns", reviews: "Reviews", marketing: "Marketing", staff: "Staff",
  hours: "Hours & pause", zones: "Delivery zones", notifications: "Notifications", launchflow: "LaunchFlow", help: "Help", pos: "Till", reports: "Reports & cash", kiosk: "Self-service kiosk",
};

/**
 * Managers hold everything, so they are granted implicitly rather than listed on every
 * row - that way a new screen cannot accidentally lock the manager out.
 */
const GRANTS: Record<Exclude<StaffRole, "manager">, Screen[]> = {
  shift_lead: ["dashboard", "kitchen", "orders", "dispatch", "inventory", "hours", "reviews", "help", "pos", "reports"],
  kitchen: ["kitchen", "help"],
  driver: ["kitchen", "dispatch", "help"],
  front_of_house: ["dashboard", "kitchen", "orders", "help", "pos"],
  // Deliberately nothing else: no till, orders board, kitchen feed, cash, reports or admin.
  kiosk: ["kiosk"],
};

export function can(role: StaffRole, screen: Screen): boolean {
  if (role === "manager") return true;
  return GRANTS[role].includes(screen);
}

/** Where a screen actually lives, since five of them are not under /admin/<screen>. */
export function pathForScreen(screen: Screen): string {
  if (screen === "dashboard") return "/admin";
  if (screen === "kitchen") return "/kitchen";
  // Reports and the cash drawer are worked from the till.
  if (screen === "pos" || screen === "reports") return "/pos";
  if (screen === "kiosk") return "/kiosk";
  return `/admin/${screen}`;
}

/**
 * The first screen this role can open.
 *
 * Needed because turning someone away has to send them somewhere they are
 * allowed to be. Sending every denial to /admin loops forever for a role that
 * cannot see the dashboard - which is most of them.
 */
export function landingFor(role: StaffRole): string {
  if (role === "manager") return "/admin";
  const first = GRANTS[role][0];
  return first ? pathForScreen(first) : "/admin/login";
}

/** Maps a back-office path to the screen it belongs to, for guards and the sidebar. */
export function screenForPath(path: string): Screen | null {
  if (path === "/admin" || path === "/admin/") return "dashboard";
  if (path.startsWith("/kitchen")) return "kitchen";
  if (path.startsWith("/pos")) return "pos";
  if (path.startsWith("/kiosk")) return "kiosk";
  const m = /^\/admin\/([a-z-]+)/.exec(path);
  const slug = m?.[1];
  return SCREENS.includes(slug as Screen) ? (slug as Screen) : null;
}
