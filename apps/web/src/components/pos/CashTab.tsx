"use client";
import { useState } from "react";
import { can, type StaffRole } from "@/lib/permissions";
import { DrawerPanel } from "./DrawerPanel";
import { DriverCashPanel } from "./DriverCashPanel";
import { DayReportPanel } from "./DayReportPanel";
import { StripeCheckPanel } from "./StripeCheckPanel";
import { PriceHistoryPanel } from "./PriceHistoryPanel";

type CashSubTab = "drawer" | "drivers" | "day" | "stripe" | "prices";

/**
 * "Cash & reports" (docs/POS-PLAN.md items 23-27). The drawer is every till
 * role's own float and pay-ins/outs; driver cash and the day report need the
 * "reports" screen (manager + shift_lead); Stripe check and price history are
 * manager only - those two tabs are simply not offered to a shift_lead,
 * matching the routes (reportsGuard(req, "manager")) instead of letting them
 * hit a 403.
 */
export function CashTab({
  staffRole, locationKey, liveEvent, queueOrderIds, onOpenOrder,
}: {
  staffRole: StaffRole;
  locationKey?: string;
  liveEvent: { orderId: string; kind: string } | null;
  queueOrderIds: Set<string>;
  onOpenOrder: (orderId: string) => void;
}) {
  const canReports = can(staffRole, "reports");
  const isManager = staffRole === "manager";
  const [tab, setTab] = useState<CashSubTab>("drawer");

  const tabs: { key: CashSubTab; label: string }[] = [
    { key: "drawer", label: "Drawer" },
    ...(canReports ? ([{ key: "drivers", label: "Driver cash" }, { key: "day", label: "Day report" }] as const) : []),
    ...(isManager ? ([{ key: "stripe", label: "Stripe check" }, { key: "prices", label: "Price history" }] as const) : []),
  ];

  return (
    <div className="pos-cash-wrap">
      <div className="seg" role="group" aria-label="Cash & reports">
        {tabs.map((t) => (
          <label key={t.key} className="seg-opt" style={{ minHeight: 52, padding: "0 18px" }}>
            <input type="radio" name="pos-cash-tab" checked={tab === t.key} onChange={() => setTab(t.key)} />
            {t.label}
          </label>
        ))}
      </div>
      <div className="pos-cash-body">
        {tab === "drawer" ? <DrawerPanel locationKey={locationKey} liveEvent={liveEvent} /> : null}
        {tab === "drivers" && canReports ? <DriverCashPanel liveEvent={liveEvent} /> : null}
        {tab === "day" && canReports ? <DayReportPanel canClose={isManager} queueOrderIds={queueOrderIds} onOpenOrder={onOpenOrder} /> : null}
        {tab === "stripe" && isManager ? <StripeCheckPanel /> : null}
        {tab === "prices" && isManager ? <PriceHistoryPanel /> : null}
      </div>
    </div>
  );
}
