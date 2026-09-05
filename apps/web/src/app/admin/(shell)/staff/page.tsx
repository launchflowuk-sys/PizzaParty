import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { setStaffRole, toggleShift } from "../actions";
import { setStaffPin, addStaff, setStaffActive } from "../staff-actions";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { HelpSpot } from "@/components/admin/HelpSpot";

import { requireScreen } from "@/lib/session";
import { can, ROLE_LABEL, SCREENS, SCREEN_LABEL, STAFF_ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; e?: string }>;
}) {
  await requireScreen("staff");
  const client = await getClientRow();
  const { m, e } = await searchParams;
  const staff = await prisma.staff.findMany({ where: { clientId: client.id }, orderBy: { sortOrder: "asc" } });
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

      <AdminNotice message={m} error={e} back="/admin/staff" />

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
                      <td style={{ fontWeight: 600, opacity: s.active ? 1 : .55 }}>
                        {s.name}
                        {!s.active ? <span className="tag tag-neutral" style={{ marginLeft: 8 }}>Left</span> : null}
                      </td>
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                          <form action={toggleShift}>
                            <input type="hidden" name="id" value={s.id} />
                            <button className="btn btn-secondary" disabled={!s.active}>{s.onShift ? "Clock off" : "Clock on"}</button>
                          </form>
                          <form action={setStaffPin} style={{ display: "flex", gap: 6 }}>
                            <input type="hidden" name="id" value={s.id} />
                            <input
                              name="pin" className="input" inputMode="numeric" autoComplete="off"
                              placeholder="New PIN" aria-label={`New PIN for ${s.name}`}
                              style={{ width: 96 }}
                            />
                            <button className="btn btn-secondary">Set PIN</button>
                          </form>
                          <form action={setStaffActive}>
                            <input type="hidden" name="id" value={s.id} />
                            <button className={s.active ? "btn btn-secondary" : "btn btn-ok"}>
                              {s.active ? "Left" : "Bring back"}
                            </button>
                          </form>
                        </div>
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

      <div className="fp-panel" style={{ marginTop: 20 }}>
        <header><span>Add somebody</span></header>
        <div className="body">
          <form action={addStaff} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Name
              <input name="name" className="input" placeholder="Their name" style={{ display: "block", marginTop: 4, width: 180, fontWeight: 700 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Role
              <select name="role" className="input" defaultValue="kitchen" style={{ display: "block", marginTop: 4, width: 160 }}>
                {STAFF_ROLES.map((v) => <option key={v} value={v}>{ROLE_LABEL[v]}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              PIN
              <HelpSpot title="Can I look a PIN up later?" article="staff-and-roles" anchor="pins">
                No. A PIN is stored scrambled, so nobody can read it back &mdash; not you, not LaunchFlow, not
                anyone with the database. It can be replaced but never recovered, so tell them what it is
                when you set it.
              </HelpSpot>
              <input name="pin" className="input" inputMode="numeric" autoComplete="off" placeholder="4 to 8 numbers" style={{ display: "block", marginTop: 4, width: 140 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-neutral-700)" }}>
              Phone
              <input name="phone" className="input" placeholder="Optional" style={{ display: "block", marginTop: 4, width: 150 }} />
            </label>
            <button className="btn btn-ok">Add</button>
          </form>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)", margin: "12px 0 0", maxWidth: "74ch" }}>
            A PIN decides what somebody can reach, so give a driver a driver&rsquo;s PIN rather than sharing a
            manager one. Runs and repeats like 1234 or 4444 are refused, and no two people may share a PIN
            &mdash; otherwise the wrong name ends up against the work.
          </p>
        </div>
      </div>

    </>
  );
}
