export type LocationLike = { id: string; key: string; name: string; postcodePrefixes: string[]; active: boolean; deliveryFee: number; minOrder: number };

export type BandLike = {
  name: string; prefixes: string[]; fee: number; minOrder: number; extraMinutes: number; sortOrder: number;
};

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
 * Prefix match: a location prefix like "RM17" matches outward "RM17" exactly.
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

/**
 * Which delivery band covers this postcode.
 *
 * A district that names itself beats an area that merely contains it: with a
 * band on "RM" and another on "RM20", an RM20 address gets the RM20 price. That
 * is the whole point of banding - the far district is listed precisely because
 * it costs more - so a broad catch-all must never win over a specific one.
 *
 * Returns null when nothing matches, and the caller falls back to the shop's
 * own fee.
 */
export function matchBand<T extends BandLike>(postcode: string, bands: T[]): T | null {
  const outward = outwardCode(postcode);
  if (!outward) return null;

  let areaMatch: T | null = null;
  for (const band of [...bands].sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const raw of band.prefixes) {
      const prefix = raw.toUpperCase().replace(/\s+/g, "");
      if (!prefix) continue;
      if (outward === prefix) return band;                       // exact district: decided
      if (/^[A-Z]+$/.test(prefix) && outward.startsWith(prefix)) {
        areaMatch ??= band;                                      // remember, keep looking
      }
    }
  }
  return areaMatch;
}

/** The fee, minimum and extra time actually owed for a postcode. */
export function deliveryTermsFor(
  postcode: string,
  location: { deliveryFee: number; minOrder: number },
  bands: BandLike[],
): { fee: number; minOrder: number; extraMinutes: number; bandName: string } {
  const band = matchBand(postcode, bands);
  if (!band) return { fee: location.deliveryFee, minOrder: location.minOrder, extraMinutes: 0, bandName: "" };
  return {
    fee: band.fee,
    // A band with no minimum of its own inherits the shop's, rather than
    // silently dropping the minimum to zero.
    minOrder: band.minOrder > 0 ? band.minOrder : location.minOrder,
    extraMinutes: band.extraMinutes,
    bandName: band.name,
  };
}
