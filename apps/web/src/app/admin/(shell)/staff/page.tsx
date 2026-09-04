import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { setStaffRole, toggleShift } from "../actions";

export const dynamic = "force-dynamic";

const ROLES: [string, string][] = [
  ["manager", "Manager"],
  ["shift_lead", "Shift lead"],
  ["kitchen", "Kitchen"],
  ["driver", "Driver"],
  ["front_of_house", "Front of house"],
];

/** Which screens each role can reach. The sidebar does not yet read this - there is
 *  one shared admin password, so there is no signed-in role to filter by. It is the
 *  matrix the prototype specifies, ready for per-user sign-in. */
const PERMISSIONS: { label: string; roles: string[] }[] = [
  { label: "Kitchen queue", roles: ["manager", "shift_lead", "kitchen"] },
  { label: "Orders", roles: ["manager", "shift_lead"] },
  { label: "Menu & pricing", roles: ["manager"] },
  { label: "Deals & promotions", roles: ["manager"] },
  { label: "Inventory", roles: ["manager", "shift_lead"] },
  { label: "Dispatch", roles: ["manager", "shift_lead"] },
  { label: "Customers", roles: ["manager"] },
  { label: "Campaigns", roles: ["manager"] },
  { label: "Hours & pause", roles: ["manager", "shift_lead"] },
  { label: "Staff", roles: ["manager"] },
];

export default async function StaffPage() {
  const client = await getClientRow();
  const staff = await prisma.staff.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" } });
  const onShift = staff.filter((s) => s.onShift).length;

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Staff</h1>
        </div>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          {staff.length} on the books · {onShift} on shift
        </span>
      </header>

      <div className="fp-adminsplit">
        <div>
          {staff.length === 0 ? (
            <p style={{ color: "var(--color-neutral-600)", fontSize: 14 }}>
              No staff yet. Add them to <code>config/{client.slug}/ops.json</code> and re-seed.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr><th>Name</th><th>Role</th><th style={{ textAlign: "right" }}>Hours this week</th><th>Tonight</th><th /></tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td>
                        <form action={setStaffRole}>
                          <input type="hidden" name="id" value={s.id} />
                          <select
                            name="role" className="input" defaultValue={s.role}
                            aria-label={`Role for ${s.name}`}
                            style={{ width: "auto", minHeight: 30, padding: "3px 8px" }}
                            // Submitting on change keeps this a one-tap edit, as the prototype has it.
                          >
                            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <button className="btn btn-ghost" style={{ fontSize: 12 }}>Save</button>
                        </form>
                      </td>
                      <td style={{ textAlign: "right" }}>{s.hoursWeek}</td>
                      <td>
                        <span className={s.onShift ? "tag tag-accent" : "tag tag-neutral"}>{s.onShift ? "On shift" : "Off"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <form action={toggleShift}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="btn btn-secondary">{s.onShift ? "Clock off" : "Clock on"}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, margin: "0 0 4px" }}>Role permissions</h3>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 12px" }}>
            What each role is meant to reach. Not yet enforced: the back office uses one shared
            password, so there is no signed-in person to check a role against.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Permission</th>
                  {ROLES.map(([v, l]) => <th key={v} style={{ textAlign: "center" }}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.label}>
                    <td>{p.label}</td>
                    {ROLES.map(([v]) => (
                      <td key={v} style={{ textAlign: "center" }}>
                        <span
                          aria-label={p.roles.includes(v) ? "granted" : "not granted"}
                          style={{
                            display: "inline-block", width: 16, height: 16,
                            border: "2px solid var(--color-accent)",
                            background: p.roles.includes(v) ? "var(--color-accent)" : "transparent",
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
