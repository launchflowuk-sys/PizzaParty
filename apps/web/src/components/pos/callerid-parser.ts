/**
 * Parses one line of USB caller-ID box output into a phone number, or null.
 * Pure, no I/O - read by useCallerId's Web Serial loop, and unit tested
 * directly (scripts/tests/pos-callerid.test.ts).
 *
 * Handles the common formats a Bellcore/BT-style box prints:
 *  - "NMBR=07902810090" / "NMBR = 07902 810090" (the caller-ID line itself)
 *  - "CALL 07902810090"
 *  - a bare line of digits: "07902810090"
 * Everything else (RING, DATE=, TIME=, blank lines) is not a number and
 * returns null - length alone rules them out.
 *
 * ponytail: one regex for the common keyword-prefixed formats, not a per-box
 * config - add a format here if a specific caller-ID box needs one.
 */
export function parseCallerIdLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const keyed = /^(?:NMBR|NUMBER|CALL|CLI)\s*[=:]?\s*(\+?\d[\d ]{8,})$/i.exec(trimmed);
  const raw = (keyed ? keyed[1]! : trimmed).replace(/[^\d+]/g, "");
  return /^\+?\d{10,15}$/.test(raw) ? raw : null;
}
