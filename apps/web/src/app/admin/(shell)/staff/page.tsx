import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { setStaffRole, toggleShift } from "../actions";
import { HelpSpot } from "@/components/admin/HelpSpot";

import { requireScreen } from "@/lib/session";
import { can, ROLE_LABEL, SCREENS, SCREEN_LABEL, STAFF_ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  await requireScreen("staff");
  const client = await getClientRow();
  const staff = await prisma.staff.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" } });
  const onShift = staff.filter((s) => s.onShift).length;

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>
            Staff
            <HelpSpot title="How do I add a starter or take a leaver off?" article="staff-roles" anchor="adding-a-starter-or-removing-a-leaver">
              Not from here &mdash; there is no Add and no Remove. People, their numbers and their PINs live
              in the shop&rsquo;s setup file, so it is a job for LaunchFlow, and a leaver&rsquo;s PIN keeps
              working until they do it.
            </HelpSpot>
          </h1>
        </div>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          {staff.length} on the books · {onShift} on shift
        </span>
      </header>

      <div className="fp-adminsplit">
        <div>
          {staff.length === 0 ? (
            <p style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>
              No staff yet. Add them to <code>config/{client.slug}/ops.json</code> and re-seed.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>
                      Role
                      <HelpSpot title="When does a role change take effect?" article="staff-roles" anchor="changing-someones-role">
                        Not until that person next signs in. Their role is fixed when they key their PIN in
                        and a sign-in lasts up to twelve hours, so take care in your own row &mdash; demote
                        yourself and you carry on as normal today, then lose this screen tomorrow.
                      </HelpSpot>
                    </th>
                    <th style={{ textAlign: "right" }}>
                      Hours this week
                      <HelpSpot title="Is this a timesheet?" article="staff-roles" anchor="hours-this-week-is-decorative">
                        No. It is a fixed number from the shop&rsquo;s setup file. Clock on and Clock off only
                        flip the Tonight tag &mdash; no time is recorded and this figure never moves.
                      </HelpSpot>
                    </th>
                    <th>Tonight</th>
                    <th />
                  </tr>
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
                            {STAFF_ROLES.map((v) => <option key={v} value={v}>{ROLE_LABEL[v]}</option>)}
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
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, margin: "0 0 4px" }}>
            Role permissions
            <HelpSpot title="Is every filled square really open to that role?" article="staff-roles" anchor="the-five-roles">
              One row is not what it looks like: LaunchFlow shows filled for Manager, but that screen needs
              LaunchFlow&rsquo;s own key on top of the sign-in, so a manager alone is still turned away.
            </HelpSpot>
          </h3>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "0 0 12px" }}>
            Enforced. This is the same matrix the sidebar and every page guard read, so a
            square that is empty here means that role cannot open the screen, cannot see it
            in the sidebar, and is redirected if they type the URL.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Permission</th>
                  {STAFF_ROLES.map((v) => <th key={v} style={{ textAlign: "center" }}>{ROLE_LABEL[v]}</th>)}
                </tr>
              </thead>
              <tbody>
                {SCREENS.map((sc) => (
                  <tr key={sc}>
                    <td>{SCREEN_LABEL[sc]}</td>
                    {STAFF_ROLES.map((v) => (
                      <td key={v} style={{ textAlign: "center" }}>
                        <span
                          aria-label={can(v, sc) ? `${ROLE_LABEL[v]} can reach ${SCREEN_LABEL[sc]}` : `${ROLE_LABEL[v]} cannot reach ${SCREEN_LABEL[sc]}`}
                          style={{
                            display: "inline-block", width: 16, height: 16,
                            border: "2px solid var(--color-accent)",
                            background: can(v, sc) ? "var(--color-accent)" : "transparent",
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
