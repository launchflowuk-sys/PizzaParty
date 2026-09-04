export type LocationLike = { id: string; key: string; name: string; postcodePrefixes: string[]; active: boolean; deliveryFee: number; minOrder: number };

export function normalisePostcode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length < 5 || s.length > 7) return s;
  return `${s.slice(0, -3)} ${s.slice(-3)}`;
}

export function outwardCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length >= 5) return s.slice(0, -3);
  return s; // user typed just the district
}

export function isValidUkPostcode(raw: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(raw.trim());
}

/**
 * Prefix match: a location prefix like "SS13" matches outward "SS13" exactly.
 * A letters-only prefix like "RM" matches every RM district (area-level coverage).
 */
export function matchLocation<T extends LocationLike>(postcode: string, locations: T[]): T | null {
  const outward = outwardCode(postcode);
  if (!outward) return null;
  for (const loc of locations) {
    if (!loc.active) continue;
    for (const p of loc.postcodePrefixes) {
      const prefix = p.toUpperCase().replace(/\s+/g, "");
      if (outward === prefix) return loc;
      if (/^[A-Z]+$/.test(prefix) && outward.startsWith(prefix)) return loc;
    }
  }
  return null;
}
