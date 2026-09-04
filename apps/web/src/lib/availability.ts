export type HoursRow = { dayOfWeek: number; opens: string; closes: string };
export type LocationAvailability = {
  open: boolean;
  paused: boolean;
  pausedUntil: Date | null;
  pauseReason: string;
  nextOpen: Date | null;
  closesAt: Date | null;
  todayHours: HoursRow[];
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Wall-clock parts of `date` in `tz`. */
export function zonedParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour12: false, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday!);
  const hour = Number(p.hour) % 24;
  return { dow, minutes: hour * 60 + Number(p.minute), y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

/** Build a UTC Date for wall-clock y-m-d hh:mm in tz. */
export function zonedToUtc(y: number, m: number, d: number, minutes: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  const parts = zonedParts(guess, tz);
  const wall = Date.UTC(parts.y, parts.m - 1, parts.d, Math.floor(parts.minutes / 60), parts.minutes % 60);
  const offset = wall - guess.getTime();
  return new Date(guess.getTime() - offset);
}

function addDays(y: number, m: number, d: number, n: number) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
}

/**
 * Is the location open at `now`? Handles ranges past midnight ("18:00"–"01:00")
 * by also checking yesterday's rows.
 */
export function isOpenAt(hours: HoursRow[], now: Date, tz: string): { open: boolean; closesAt: Date | null } {
  const p = zonedParts(now, tz);
  for (const h of hours.filter((h) => h.dayOfWeek === p.dow)) {
    const o = toMin(h.opens), c = toMin(h.closes);
    if (c > o) {
      if (p.minutes >= o && p.minutes < c) return { open: true, closesAt: zonedToUtc(p.y, p.m, p.d, c, tz) };
    } else if (p.minutes >= o) {
      const t = addDays(p.y, p.m, p.d, 1);
      return { open: true, closesAt: zonedToUtc(t.y, t.m, t.d, c, tz) };
    }
  }
  const yDow = (p.dow + 6) % 7;
  for (const h of hours.filter((h) => h.dayOfWeek === yDow)) {
    const o = toMin(h.opens), c = toMin(h.closes);
    if (c <= o && p.minutes < c) return { open: true, closesAt: zonedToUtc(p.y, p.m, p.d, c, tz) };
  }
  return { open: false, closesAt: null };
}

export function nextOpening(hours: HoursRow[], now: Date, tz: string): Date | null {
  const p = zonedParts(now, tz);
  for (let i = 0; i < 8; i++) {
    const day = addDays(p.y, p.m, p.d, i);
    const rows = hours.filter((h) => h.dayOfWeek === day.dow).sort((a, b) => toMin(a.opens) - toMin(b.opens));
    for (const h of rows) {
      const opensAt = zonedToUtc(day.y, day.m, day.d, toMin(h.opens), tz);
      if (opensAt.getTime() > now.getTime()) return opensAt;
    }
  }
  return null;
}

export function availability(
  loc: { hours: HoursRow[]; timezone: string; pausedUntil: Date | null; pauseReason: string; active: boolean },
  now = new Date(),
): LocationAvailability {
  const p = zonedParts(now, loc.timezone);
  const { open, closesAt } = isOpenAt(loc.hours, now, loc.timezone);
  const paused = !!loc.pausedUntil && loc.pausedUntil.getTime() > now.getTime();
  return {
    open: loc.active && open && !paused,
    paused,
    pausedUntil: paused ? loc.pausedUntil : null,
    pauseReason: paused ? loc.pauseReason : "",
    nextOpen: open ? null : nextOpening(loc.hours, now, loc.timezone),
    closesAt,
    todayHours: loc.hours.filter((h) => h.dayOfWeek === p.dow),
  };
}

/** Pre-order slots (15-min steps) for today + tomorrow, starting at least `leadMinutes` from now and ending 15 min before close. */
export function preorderSlots(hours: HoursRow[], now: Date, tz: string, leadMinutes: number, days = 2): Date[] {
  const p = zonedParts(now, tz);
  const earliest = now.getTime() + leadMinutes * 60_000;
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(p.y, p.m, p.d, i);
    for (const h of hours.filter((h) => h.dayOfWeek === day.dow)) {
      const o = toMin(h.opens);
      let c = toMin(h.closes);
      if (c <= o) c += 24 * 60;
      for (let t = o; t <= c - 15; t += 15) {
        const slot = zonedToUtc(day.y, day.m, day.d, t, tz);
        if (slot.getTime() >= earliest) out.push(slot);
      }
    }
  }
  return out;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatHours(hours: HoursRow[]): { day: string; text: string }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const rows = hours.filter((h) => h.dayOfWeek === dow).sort((a, b) => toMin(a.opens) - toMin(b.opens));
    return { day: DAY_NAMES[dow]!, text: rows.length ? rows.map((r) => `${r.opens}–${r.closes}`).join(", ") : "Closed" };
  });
}

export function formatTime(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function formatDateTime(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
