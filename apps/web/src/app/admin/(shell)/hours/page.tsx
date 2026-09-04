import { getLocations } from "@/lib/menu";
import { availability } from "@/lib/availability";
import { pauseLocation, updateHours } from "../actions";

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
          <h1>Hours & pause</h1>
        </div>
      </header>
      <p className="text-sm text-muted mt-1">One range per day. Leave blank for closed. Closing after midnight is fine (e.g. 17:00 → 01:00).</p>
      {locations.map((l) => {
        const a = availability(l);
        return (
          <section key={l.id} className="lf-card p-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-lg">{l.name} <span className={`lf-pill ml-2 ${a.paused ? "bg-warning/30" : a.open ? "bg-success/15" : "bg-line"}`}>{a.paused ? "paused" : a.open ? "open" : "closed"}</span></h2>
              <form action={pauseLocation} className="flex gap-2 items-center text-sm">
                <input type="hidden" name="locationId" value={l.id} />
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
            </form>
          </section>
        );
      })}
    </div>
  );
}
