import { getConfig } from "@/lib/config";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { shopTimezone } from "@/lib/pos-queue";
import { dateIn, isDate } from "@/lib/pos-report-math";
import { dayReport } from "@/lib/pos-reports";
import { requireScreen } from "@/lib/session";
import { AutoPrint } from "@/components/print/AutoPrint";
import type { PosDayReport } from "@/lib/pos-reports-types";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { web: "Website", app: "App", pos: "Counter", phone: "Phone", card: "Card online", reader: "Card reader", cash: "Cash" };

/**
 * The Z report on 80 mm paper, same paper and classes as the kitchen dockets.
 * Outside the back-office shell so nothing but the report prints.
 * `?date=YYYY-MM-DD` (default today), `?auto=1` prints on load.
 */
export default async function ZReportPrint({ searchParams }: { searchParams: Promise<{ date?: string; auto?: string }> }) {
  await requireScreen("reports");
  const client = await getClientRow();
  const { date: raw, auto } = await searchParams;
  const tz = await shopTimezone(client.id);
  const date = raw && isDate(raw) ? raw : dateIn(tz, new Date());
  const r = await dayReport(client.id, date);
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <div className="rc-page">
      {auto === "1" ? <AutoPrint /> : null}
      <div className="rc-bar">
        <span>Z report · {date}</span>
        <span className="rc-bar-links">
          <a href={`/api/pos/reports/day?date=${date}&format=csv`}>CSV</a>
        </span>
      </div>
      <article className="rc">
        <div className="rc-shop"><strong>{getConfig().name}</strong><span>End of day (Z) report</span></div>
        <div className="rc-title">{r.closed ? `CLOSED ${time(r.closed.at)}` : "NOT CLOSED - FIGURES MAY CHANGE"}</div>
        <div className="rc-when">{date}<span>{time(r.from)} → {time(r.to)}</span></div>
        {r.closed ? <div className="rc-when">Closed by<span>{r.closed.by}{r.closed.approvedBy !== r.closed.by ? ` (${r.closed.approvedBy})` : ""}</span></div> : null}

        <Section title="Sales" rows={[
          ["Orders", String(r.sales.orders)],
          ["Items", gbp(r.sales.subtotal)],
          ["Delivery fees", gbp(r.sales.deliveryFees)],
          ["Promo discounts", `-${gbp(r.sales.promoDiscounts)}`],
          ["Manager discounts", `-${gbp(r.sales.managerDiscounts)}`],
        ]} total={["Sales", gbp(r.sales.total)]} />
        <Totals rows={[["Average order", gbp(r.sales.averageOrder)]]} />

        <Section title="By channel" rows={r.byChannel.map((c) => [`${LABEL[c.channel]} (${c.count})`, gbp(c.amount)])} />
        <Section title="By staff" rows={r.byStaff.map((s) => [`${s.name} (${s.count})`, gbp(s.amount)])} />
        <Section title="Money in" rows={r.takings.map((t) => [`${LABEL[t.kind]} (${t.count})`, gbp(t.amount)])} />
        <Section title="Refunds" rows={r.refunds.map((t) => [`${LABEL[t.kind]} (${t.count})`, `-${gbp(t.amount)}`])} total={["Net takings", gbp(r.netTakings)]} />
        <Totals rows={[["of which goodwill", gbp(r.goodwill)], ["Tips", gbp(r.tips)]]} />

        <Section title="Voids & cancellations" rows={[
          [`Items voided (${r.voids.count})`, gbp(r.voids.amount)],
          [`Orders cancelled (${r.cancelled.count})`, gbp(r.cancelled.amount)],
        ]} />
        <Section title={`Still owed (${r.outstanding.count})`} rows={r.outstanding.orders.map((o) => [`#${o.number} ${o.customerName}`, gbp(o.balance)])} total={r.outstanding.count ? ["Owed", gbp(r.outstanding.amount)] : undefined} />
        {r.adjustments.length ? <Section title="Adjustments to earlier days" rows={r.adjustments.map((a) => [`#${a.orderNumber} (${a.orderDate}) ${LABEL[a.kind]}`, `-${gbp(a.amount)}`])} /> : null}

        {r.drawers.map((d) => <Drawer key={d.id} d={d} time={time} />)}
        <Section title="Driver cash" rows={[["Collected", gbp(r.driverCash.collected)], ["Handed in", gbp(r.driverCash.handedIn)]]} total={["Drivers still owe", gbp(r.driverCash.owed)]} />

        <Section title="Top sellers" rows={r.topProducts.map((p) => [`${p.qty} × ${p.name}`, gbp(p.revenue)])} />
        <div className="rc-foot"><span>Printed {time(new Date().toISOString())}</span></div>
      </article>
    </div>
  );
}

function Drawer({ d, time }: { d: PosDayReport["drawers"][number]; time: (iso: string) => string }) {
  const over = d.overShort === null ? null : d.overShort === 0 ? "Exact" : d.overShort > 0 ? `Over ${gbp(d.overShort)}` : `SHORT ${gbp(-d.overShort)}`;
  return (
    <>
      <Section title={`Drawer · ${d.locationName}`} rows={[
        [`Float (${d.openedBy}, ${time(d.openedAt)})`, gbp(d.float)],
        ["Cash sales", gbp(d.cashSales)],
        ["Cash refunds", `-${gbp(d.cashRefunds)}`],
        ["Pay-ins", gbp(d.payIns)],
        ["Driver hand-ins", gbp(d.driverHandIns)],
        ["Pay-outs", `-${gbp(d.payOuts)}`],
        ...d.movements.map((m): [string, string] => [`  ${m.reason}`, `${m.kind === "pay_out" ? "-" : ""}${gbp(m.amount)}`]),
      ]} total={["Expected", gbp(d.expected)]} />
      {d.counted !== null ? <Totals rows={[["Counted", gbp(d.counted)], [over ?? "", ""]]} /> : <Totals rows={[["Drawer still open", ""]]} />}
    </>
  );
}

function Section({ title, rows, total }: { title: string; rows: [string, string][]; total?: [string, string] }) {
  return (
    <>
      <div className="rc-title">{title}</div>
      {rows.length ? <Totals rows={rows} /> : <Totals rows={[["None", ""]]} />}
      {total ? <table className="rc-totals"><tbody><tr className="big"><td>{total[0]}</td><td>{total[1]}</td></tr></tbody></table> : null}
      <hr className="rc-rule" />
    </>
  );
}

function Totals({ rows }: { rows: [string, string][] }) {
  return (
    <table className="rc-totals">
      <tbody>{rows.map(([k, v], n) => <tr key={n}><td>{k}</td><td>{v}</td></tr>)}</tbody>
    </table>
  );
}
