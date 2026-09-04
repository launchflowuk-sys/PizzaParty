import { Pill } from "@launchflow/ui";
import { formatDateTime, formatTime, type LocationAvailability } from "@/lib/availability";

export function OpenPill({ a, tz, etaMinutes }: { a: LocationAvailability; tz: string; etaMinutes?: number }) {
  if (a.open) {
    return (
      <span className="inline-flex items-center gap-2 flex-wrap">
        <Pill tone="success"><span className="w-2 h-2 rounded-full bg-success inline-block" aria-hidden />Open now{a.closesAt ? ` · until ${formatTime(a.closesAt, tz)}` : ""}</Pill>
        {etaMinutes ? <Pill tone="neutral">Delivery ~{etaMinutes} min</Pill> : null}
      </span>
    );
  }
  if (a.paused) return <Pill tone="warning">Paused{a.pausedUntil ? ` · back ${formatTime(a.pausedUntil, tz)}` : ""}{a.pauseReason ? ` · ${a.pauseReason}` : ""}</Pill>;
  return <Pill tone="danger">Closed{a.nextOpen ? ` · opens ${formatDateTime(a.nextOpen, tz)}` : ""} · pre-order available</Pill>;
}
