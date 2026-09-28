"use client";
import { useMemo } from "react";

/** ASAP, or a slot in 15-minute steps for the next two hours. `value` is an ISO
 *  string, or undefined for ASAP - matches PosCreateOrder.scheduledFor exactly. */
export function TimePicker({ value, onChange, showLabel = true }: { value: string | undefined; onChange: (iso: string | undefined) => void; showLabel?: boolean }) {
  const slots = useMemo(() => {
    const out: { iso: string; label: string }[] = [];
    const now = new Date();
    const start = new Date(now.getTime());
    start.setSeconds(0, 0);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
    for (let i = 1; i <= 8; i++) {
      const d = new Date(start.getTime() + i * 15 * 60000);
      out.push({ iso: d.toISOString(), label: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
    }
    return out;
  }, []);

  return (
    <div>
      {showLabel ? <span style={{ fontSize: 12, color: "var(--color-neutral-700)", display: "block", marginBottom: 6 }}>When</span> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" className={value ? "btn btn-secondary" : "btn btn-primary"} style={{ minHeight: 48 }} onClick={() => onChange(undefined)}>
          ASAP
        </button>
        {slots.map((s) => (
          <button
            key={s.iso}
            type="button"
            className={value === s.iso ? "btn btn-primary" : "btn btn-secondary"}
            style={{ minHeight: 48 }}
            onClick={() => onChange(s.iso)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
