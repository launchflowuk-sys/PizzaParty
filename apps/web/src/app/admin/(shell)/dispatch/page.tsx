import { prisma } from "@launchflow/db";
import { getClientRow, getLocations } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { assignDriver, setDriverStatus } from "../actions";

import { requireScreen } from "@/lib/session";
import { HelpSpot } from "@/components/admin/HelpSpot";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { available: "Available", on_delivery: "On delivery", off: "Off shift" };
/** Driver states, not order states - a free driver is the one you want to spot. */
const DRIVER_TONE: Record<string, string> = { available: "ok", on_delivery: "busy", off: "neutral" };

/** Dispatch from `Farm Pizza Admin.dc.html`: map placeholder and driver table on the
 *  left, orders waiting on the pass on the right. Assigning a driver marks them out
 *  and starts their return clock. */
export default async function DispatchPage() {
  await requireScreen("dispatch");
  const client = await getClientRow();
  const [drivers, ready, locations] = await Promise.all([
    prisma.driver.findMany({ where: { clientId: client.id, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.order.findMany({
      where: { clientId: client.id, fulfilment: "delivery", status: { in: ["ready", "preparing"] } },
      orderBy: { placedAt: "asc" },
      include: { items: { where: { parentId: null }, select: { qty: true, name: true } } },
    }),
    getLocations(),
  ]);

  const free = drivers.filter((d) => d.status === "available");
  const shopName = locations[0]?.name ?? client.name;
  const orderNoById = new Map(ready.map((o) => [o.id, o.number]));

  return (
    <>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Dispatch</h1>
        </div>
        <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
          {free.length} of {drivers.length} drivers free
        </span>
      </header>

      <div className="fp-adminsplit">
        <div>
          <div
            style={{
              height: 380, border: "2px solid var(--color-text)", position: "relative",
              background:
                "repeating-linear-gradient(0deg,transparent 0 39px,var(--color-neutral-300) 39px 40px)," +
                "repeating-linear-gradient(90deg,transparent 0 39px,var(--color-neutral-300) 39px 40px)," +
                "var(--color-surface)",
            }}
          >
            <span style={{ position: "absolute", left: 12, top: 12, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: "var(--color-neutral-700)" }}>
              map · {shopName.toLowerCase()} · live driver positions · placeholder
              <HelpSpot title="Does this show where the drivers are?" article="dispatch-and-drivers" anchor="the-map-is-not-a-map">
                No — it is a drawing. Each square is a driver somebody marked On delivery, placed by their position
                in the list below, not by where they are. Nothing in this system tracks a driver; ring them.
              </HelpSpot>
            </span>
            <span style={{ position: "absolute", left: "46%", top: "52%", width: 16, height: 16, background: "var(--color-text)" }} />
            <span style={{ position: "absolute", left: "calc(46% + 24px)", top: "calc(52% - 2px)", fontSize: 12, fontWeight: 600 }}>{shopName} shop</span>
            {drivers.filter((d) => d.status === "on_delivery").map((d, i) => {
              const x = `${22 + i * 24}%`; const y = `${28 + (i % 2) * 34}%`;
              return (
                <span key={d.id}>
                  <span style={{ position: "absolute", width: 14, height: 14, background: "var(--color-accent)", animation: "fp-pulse 1.4s ease-in-out infinite", left: x, top: y }} />
                  <span style={{ position: "absolute", fontSize: 12, left: `calc(${x} + 22px)`, top: `calc(${y} - 3px)` }}>{d.name.split(" ")[0]}</span>
                </span>
              );
            })}
          </div>

          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, margin: "24px 0 8px" }}>
            Drivers
            <HelpSpot title="Can I add or remove a driver here?" article="dispatch-and-drivers" anchor="drivers-come-from-config">
              No. Names, vehicles and who is on the list come from your settings file and need a ring to LaunchFlow —
              status is the only thing you can change here. The names showing today are sample entries with made-up
              phone numbers.
            </HelpSpot>
          </h3>
          {drivers.length === 0 ? (
            <p style={{ color: "var(--color-neutral-700)", fontSize: 14 }}>
              No drivers yet. Add them to <code>config/{client.slug}/ops.json</code> and re-seed.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%" }}>
                <thead><tr>
                  <th>Driver</th>
                  <th>Vehicle</th>
                  <th>Status
                    <HelpSpot title="Why is a driver still On delivery?" article="dispatch-and-drivers" anchor="assigning-a-driver">
                      Because nothing clears it but you — press <strong>Set available</strong> on their row when they
                      are back. Until then they stay out of the Assign driver list and the free count reads short, and
                      a driver finishing for the night takes two presses: Set available, then Set off shift.
                    </HelpSpot>
                  </th>
                  <th>Order</th>
                  <th>Back at
                    <HelpSpot title="Is Back at worked out from the distance?" article="dispatch-and-drivers" anchor="back-at-30-minutes">
                      No. It is always the moment you pressed Go plus thirty minutes, whatever the drop — a note to
                      yourself, not a prediction. Do not chase a driver on it, and do not assume they are fine either.
                    </HelpSpot>
                  </th>
                  <th />
                </tr></thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td className="text-muted">{d.vehicle || "—"}</td>
                      <td>
                        <span className={d.status === "on_delivery" ? "tag tag-accent" : d.status === "available" ? "tag tag-neutral" : "tag tag-outline"}>
                          <span className={`tag tag-${DRIVER_TONE[d.status] ?? "neutral"}`}>{STATUS_LABEL[d.status] ?? d.status}</span>
                        </span>
                      </td>
                      <td style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>
                        {d.activeOrderId ? `#${orderNoById.get(d.activeOrderId) ?? d.activeOrderId.slice(0, 6)}` : "—"}
                      </td>
                      <td className="text-muted">
                        {d.backAt ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(d.backAt) : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <form action={setDriverStatus}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="status" value={d.status === "available" ? "off" : "available"} />
                          <button className="btn btn-secondary">{d.status === "available" ? "Set off shift" : "Set available"}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ border: "2px solid var(--color-text)", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, margin: 0 }}>
              Ready to go
              <HelpSpot title="What does pressing Go actually do?" article="dispatch-and-drivers" anchor="what-assigning-does-not-do">
                It marks the driver On delivery, notes the order on their row and starts the Back at clock. It does not
                tell the driver anything and does not move the ticket, so somebody still has to hand over the food and
                press Out for delivery on the kitchen screen. This list holds orders still being prepared as well as
                ready ones, so check the board before sending anyone to the pass.
              </HelpSpot>
            </h3>
            <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{ready.length} waiting</span>
          </div>
          <div style={{ fontSize: 13 }}>
            {ready.length === 0 ? (
              <div style={{ padding: "12px 0", color: "var(--color-neutral-500)" }}>Nothing waiting. The kitchen is ahead of the drivers.</div>
            ) : ready.map((o) => {
              const waited = Math.round((Date.now() - new Date(o.placedAt ?? o.createdAt).getTime()) / 60000);
              return (
                <div key={o.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--color-divider)" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>#{o.number} · {o.customerName}</div>
                    <div style={{ color: "var(--color-neutral-700)" }}>
                      {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · {gbp(o.total)} · waiting {waited} min
                    </div>
                  </div>
                  <form action={assignDriver} style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <select name="driverId" className="input" style={{ width: "auto", minHeight: 36 }} defaultValue="" aria-label={`Assign a driver to order ${o.number}`} required>
                      <option value="" disabled>Assign driver…</option>
                      {free.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <button className="btn btn-primary" disabled={free.length === 0}>Go</button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
