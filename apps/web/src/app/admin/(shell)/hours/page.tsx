import { getLocations } from "@/lib/menu";
import { availability } from "@/lib/availability";
import { pauseLocation, updateHours } from "../actions";
import { HelpSpot } from "@/components/admin/HelpSpot";

import { requireScreen } from "@/lib/session";

export const dynamic = "force-dynamic";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AdminHours() {
  await requireScreen("hours");
  const locations = await getLocations();
  return (
    <div>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>
            Hours &amp; pause
            <HelpSpot title="Can I close for one afternoon, or one date?" article="hours-and-pause" anchor="you-cannot-split-a-day">
              No. There is one opening and one closing per day, and no one-off dates &mdash; the only way to
              shut for Christmas Day is to clear that day&rsquo;s times, which closes it every week until you
              put them back.
            </HelpSpot>
          </h1>
        </div>
      </header>
      <p className="text-sm text-muted mt-1">One range per day. Leave blank for closed. Closing after midnight is fine (e.g. 17:00 → 01:00).</p>
      {locations.map((l) => {
        const a = availability(l);
        return (
          <section key={l.id} className="lf-card p-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-lg">{l.name} <span className={`lf-pill ml-2 ${a.paused ? "bg-warning/30" : a.open ? "bg-success/15" : "bg-line"}`}>{a.paused ? "paused" : a.open ? "open" : "closed"}</span>
                <HelpSpot title="What does paused actually stop?" article="hours-and-pause" anchor="what-a-pause-does-not-do">
                  New orders, and nothing else. Anything already on the kitchen board still has to be
                  cooked, and customers can still book a pre-order slot for later. Nothing reminds you a
                  pause is on, so decide who is going to resume it.
                </HelpSpot>
              </h2>
              <form action={pauseLocation} className="flex gap-2 items-center text-sm">
                <input type="hidden" name="locationId" value={l.id} />
                <HelpSpot title="Why does this dropdown say Resume?" article="hours-and-pause" anchor="pausing">
                  It always starts on Resume, so typing a reason and pressing Apply without changing it
                  clears a pause rather than starting one. Pause today runs a full 24 hours from the
                  moment you press it, not until closing time.
                </HelpSpot>
                <select name="minutes" className="lf-input"><option value="0">Resume</option><option value="15">Pause 15 min</option><option value="30">Pause 30 min</option><option value="60">Pause 1 hour</option><option value="1440">Pause today</option></select>
                <input name="reason" placeholder="Reason (shown to customers)" className="lf-input" />
                <button className="lf-btn lf-btn-ghost">Apply</button>
              </form>
            </div>
            <form action={updateHours} className="mt-3">
              <input type="hidden" name="locationId" value={l.id} />
              <table className="text-sm"><tbody>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => { const h = l.hours.find((x) => x.dayOfWeek === d); return (
                  <tr key={d}><td className="pr-3 py-1 font-semibold">{DAYS[d]}</td><td className="py-1"><input name={`opens${d}`} type="time" defaultValue={h?.opens ?? ""} className="lf-input w-32" /></td><td className="px-2">→</td><td className="py-1"><input name={`closes${d}`} type="time" defaultValue={h?.closes ?? ""} className="lf-input w-32" /></td></tr>
                ); })}
              </tbody></table>
              <button className="lf-btn lf-btn-primary mt-3">Save hours</button>
              <HelpSpot title="What does this do to the days I did not touch?" article="hours-and-pause" anchor="a-typo-saves-as-closed">
                Saving rewrites all seven days from what is on screen, and any day whose two times are not
                both filled in properly is saved as closed &mdash; with nothing to warn you. Read the grid
                back after every save.
              </HelpSpot>
            </form>
          </section>
        );
      })}
    </div>
  );
}
