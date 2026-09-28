"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { gbp } from "@/lib/money";
import type { PaymentKind } from "@/lib/pos-queue-types";
import type { PosDayReport, PosDrawer } from "@/lib/pos-reports-types";
import { SOURCE_LABEL, fmtTime } from "./queue-ui";
import { PinPad } from "./PinPad";
import { AmountKeypad } from "./AmountKeypad";

const PAYMENT_LABEL: Record<PaymentKind, string> = { card: "Card online", reader: "Card reader", cash: "Cash" };

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}
async function readJson<T>(r: Response): Promise<T | { error: string }> {
  try { return await r.json(); } catch { return { error: "Unexpected response from the server." }; }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pos-osection">
      <span className="pos-osection-label">{title}</span>
      {children}
    </div>
  );
}
function ReportRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="pos-oline-top" style={{ fontWeight: bold ? 800 : 400 }}>
      <span>{label}</span>
      <span>{gbp(value)}</span>
    </div>
  );
}
function DrawerSummary({ drawer }: { drawer: PosDrawer }) {
  return (
    <Section title={`Drawer · ${drawer.locationName}`}>
      <ReportRow label={`Float (${drawer.openedBy})`} value={drawer.float} />
      <ReportRow label="Cash sales" value={drawer.cashSales} />
      <ReportRow label="Cash refunds" value={-drawer.cashRefunds} />
      <ReportRow label="Pay-ins" value={drawer.payIns} />
      <ReportRow label="Driver hand-ins" value={drawer.driverHandIns} />
      <ReportRow label="Pay-outs" value={-drawer.payOuts} />
      <ReportRow label="Expected" value={drawer.expected} bold />
      {drawer.counted !== null ? (
        <>
          <ReportRow label="Counted" value={drawer.counted} />
          {drawer.overShort !== null ? (
            drawer.overShort < 0
              ? <p className="fp-error" style={{ margin: 0 }}>SHORT {gbp(-drawer.overShort)}</p>
              : <p style={{ margin: 0, color: "var(--color-action)" }}>{drawer.overShort === 0 ? "Exact" : `Over ${gbp(drawer.overShort)}`}</p>
          ) : null}
        </>
      ) : <p style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>Drawer still open.</p>}
    </Section>
  );
}

type Closing = null | "counted" | "confirm" | "pin";

/**
 * The end-of-day (Z) report (docs/POS-PLAN.md item 23), plus the manager-only
 * close (item 23's freeze). `queueOrderIds`/`onOpenOrder` let a still-owed row
 * open straight in the Orders panel when it is still in today's live queue.
 */
export function DayReportPanel({
  canClose, queueOrderIds, onOpenOrder,
}: {
  canClose: boolean;
  queueOrderIds: Set<string>;
  onOpenOrder: (orderId: string) => void;
}) {
  const [date, setDate] = useState("");
  const [report, setReport] = useState<PosDayReport | null>(null);
  const [loadError, setLoadError] = useState("");
  const [closing, setClosing] = useState<Closing>(null);
  const [counted, setCounted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [closeError, setCloseError] = useState("");

  const load = useCallback(async (d?: string) => {
    try {
      const url = d ? `/api/pos/reports/day?date=${d}` : "/api/pos/reports/day";
      const r = await fetch(url, { cache: "no-store" });
      const res = await readJson<PosDayReport>(r);
      if (!r.ok || "error" in res) { setLoadError((res as { error?: string }).error ?? "Could not load the day report."); return; }
      setReport(res as PosDayReport);
      setDate((res as PosDayReport).date);
      setLoadError("");
    } catch {
      setLoadError("Could not reach the server.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function closeDay(managerPin: string) {
    setBusy(true); setCloseError("");
    try {
      const body: { date: string; managerPin: string; counted?: number } = { date, managerPin };
      if (!report?.drawers.length) body.counted = counted;
      const r = await fetch("/api/pos/reports/day/close", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await readJson<PosDayReport>(r);
      if (!r.ok || "error" in d) throw new Error((d as { error?: string }).error ?? "Could not close the day.");
      setReport(d as PosDayReport);
      setClosing(null);
    } catch (e) {
      setCloseError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (closing === "counted") {
    return <AmountKeypad initial={0} confirmLabel={(a) => `Counted ${gbp(a)}`} busy={false} error="" onBack={() => setClosing(null)} onConfirm={(a) => { setCounted(a); setClosing("confirm"); }} />;
  }
  if (closing === "confirm") {
    return (
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={() => setClosing(report?.drawers.length ? null : "counted")}>Back</button>
        <h3 style={{ marginTop: 8 }}>Close {date}?</h3>
        <p>Net takings {gbp(report?.netTakings ?? 0)}</p>
        {!report?.drawers.length ? <p>Counted {gbp(counted)}</p> : null}
        {closeError ? <p className="fp-error">{closeError}</p> : null}
        <button type="button" className="btn btn-primary btn-block" style={{ minHeight: 64, marginTop: 16, justifyContent: "center" }} onClick={() => setClosing("pin")}>
          Continue to manager PIN
        </button>
      </div>
    );
  }
  if (closing === "pin") {
    return <PinPad label={`Close ${date}`} busy={busy} error={closeError} onCancel={() => setClosing("confirm")} onSubmit={closeDay} />;
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="field" style={{ maxWidth: 220 }}>
          <span>Date</span>
          <input className="input" style={{ minHeight: 48 }} type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => void load(e.target.value)} />
        </label>
        <a className="btn btn-secondary" style={{ minHeight: 48 }} href={`/admin/reports/day/print?date=${date}&auto=1`} target="_blank" rel="noreferrer">Print Z report</a>
        <a className="btn btn-secondary" style={{ minHeight: 48 }} href={`/api/pos/reports/day?date=${date}&format=csv`}>Download CSV</a>
        {canClose && report && !report.closed ? (
          <button type="button" className="btn btn-primary" style={{ minHeight: 48, marginLeft: "auto" }} onClick={() => { setCloseError(""); setClosing(report.drawers.length ? "confirm" : "counted"); }}>
            Close day
          </button>
        ) : null}
      </div>

      {loadError ? <p className="fp-error" style={{ marginTop: 12 }}>{loadError}</p> : null}

      {!report ? <p style={{ marginTop: 16 }}>Loading…</p> : (
        <>
          {report.closed ? (
            <p className="tag tag-ok" style={{ marginTop: 12, display: "inline-block" }}>
              Closed by {report.closed.by}{report.closed.approvedBy !== report.closed.by ? ` (${report.closed.approvedBy})` : ""} at {fmtTime(report.closed.at)}
            </p>
          ) : (
            <p className="tag tag-warn" style={{ marginTop: 12, display: "inline-block" }}>Not closed — figures may still change</p>
          )}

          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>Sales · {report.sales.orders} orders</span>
            <span className="pos-bignum" style={{ display: "block" }}>{gbp(report.sales.total)}</span>
            <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>avg {gbp(report.sales.averageOrder)}</span>
          </div>

          <Section title="Sales breakdown">
            <ReportRow label="Items" value={report.sales.subtotal} />
            <ReportRow label="Delivery fees" value={report.sales.deliveryFees} />
            <ReportRow label="Promo discounts" value={-report.sales.promoDiscounts} />
            <ReportRow label="Manager discounts" value={-report.sales.managerDiscounts} />
            <ReportRow label="Total" value={report.sales.total} bold />
          </Section>

          <Section title="By channel">
            {report.byChannel.map((c) => <ReportRow key={c.channel} label={`${SOURCE_LABEL[c.channel]} (${c.count})`} value={c.amount} />)}
          </Section>

          <Section title="By staff">
            {report.byStaff.length === 0 ? <p style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>None.</p> : report.byStaff.map((s) => <ReportRow key={s.name} label={`${s.name} (${s.count})`} value={s.amount} />)}
          </Section>

          <Section title="Money in">
            {report.takings.map((t) => <ReportRow key={t.kind} label={`${PAYMENT_LABEL[t.kind]} (${t.count})`} value={t.amount} />)}
          </Section>
          <Section title="Refunds">
            {report.refunds.map((t) => <ReportRow key={t.kind} label={`${PAYMENT_LABEL[t.kind]} (${t.count})`} value={-t.amount} />)}
            <ReportRow label="Net takings" value={report.netTakings} bold />
          </Section>
          {report.marketplaceTakings.count > 0 ? (
            <Section title="Marketplace takings">
              <ReportRow label={`Just Eat / Deliveroo / Uber Eats (${report.marketplaceTakings.count})`} value={report.marketplaceTakings.amount} />
              <p style={{ fontSize: 12, color: "var(--color-neutral-700)", margin: 0 }}>
                Paid to the platform, which pays the shop out later - not in the drawer or Stripe, so kept out of net takings above.
              </p>
            </Section>
          ) : null}
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--color-neutral-700)" }}>
            <span>of which goodwill {gbp(report.goodwill)}</span>
            <span>Tips {gbp(report.tips)}</span>
          </div>

          <Section title={`Voids & cancellations (${report.voids.count + report.cancelled.count})`}>
            {report.voids.lines.length === 0 ? <p style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>No voids.</p> : report.voids.lines.map((v, i) => (
              <ReportRow key={i} label={`#${v.orderNumber} ${v.qty}× ${v.name} — ${v.reason}`} value={v.value} />
            ))}
            <ReportRow label={`Cancelled orders (${report.cancelled.count})`} value={report.cancelled.amount} />
          </Section>

          <Section title={`Still owed (${report.outstanding.count})`}>
            {report.outstanding.orders.length === 0 ? <p style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>None.</p> : report.outstanding.orders.map((o) => (
              queueOrderIds.has(o.orderId) ? (
                <button
                  key={o.orderId} type="button" className="pos-oline-top"
                  style={{ width: "100%", background: "none", border: 0, cursor: "pointer", font: "inherit", color: "inherit", padding: "8px 0" }}
                  onClick={() => onOpenOrder(o.orderId)}
                >
                  <span>#{o.number} {o.customerName} ({SOURCE_LABEL[o.source]})</span><span>{gbp(o.balance)}</span>
                </button>
              ) : <ReportRow key={o.orderId} label={`#${o.number} ${o.customerName} (${SOURCE_LABEL[o.source]})`} value={o.balance} />
            ))}
          </Section>

          {report.adjustments.length ? (
            <Section title="Adjustments to earlier days">
              {report.adjustments.map((a) => <ReportRow key={a.refundId} label={`#${a.orderNumber} (${a.orderDate}) ${PAYMENT_LABEL[a.kind]}`} value={-a.amount} />)}
            </Section>
          ) : null}

          {report.drawers.map((d) => <DrawerSummary key={d.id} drawer={d} />)}

          {report.driverCash.collected || report.driverCash.handedIn || report.driverCash.owed ? (
            <Section title="Driver cash">
              <ReportRow label="Collected" value={report.driverCash.collected} />
              <ReportRow label="Handed in" value={report.driverCash.handedIn} />
              <ReportRow label="Still owed" value={report.driverCash.owed} bold />
            </Section>
          ) : null}

          <Section title="Top sellers">
            {report.topProducts.length === 0 ? <p style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>None.</p> : report.topProducts.map((p) => (
              <ReportRow key={p.name} label={`${p.qty} × ${p.name}`} value={p.revenue} />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
