import "server-only";
import { env } from "./env";
import { getConfig } from "./config";

/**
 * Address lookup, through Google Places.
 *
 * A takeaway is not delivering to a postcode, it is delivering to a door. Typed
 * addresses arrive misspelt, abbreviated, missing the flat number, or with the
 * wrong postcode entirely - and the driver finds out at eleven at night, on the
 * pavement, with the food going cold.
 *
 * Two decisions worth stating.
 *
 * **The key stays on the server.** Google's own examples put a browser key in
 * the page and lock it to a referrer, which anybody can spoof; the meter is the
 * shop's either way. Both calls are proxied through our own routes, so the key
 * is never in the HTML and the shop cannot wake up to somebody else's bill.
 *
 * **One session token per lookup.** Google bills autocomplete keystrokes and the
 * final details call as one session when they share a token, and separately when
 * they do not. The token is minted in the browser and passed through, then
 * discarded once the address is chosen.
 *
 * Results are restricted to the United Kingdom and biased towards the shop, so
 * "12 High" offers the High Street two miles away before the one in Aberdeen.
 */

const AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS = "https://places.googleapis.com/v1/places";

export const placesEnabled = () => !!env.googlePlacesKey;

export type Suggestion = { id: string; main: string; secondary: string };

/** A UK address, in the shape the checkout form and the Address table use. */
export type ResolvedAddress = {
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
};

/** Where to bias results towards: the shop itself, when it has coordinates. */
function bias(): Record<string, unknown> | null {
  const loc = getConfig().locations.find((l) => l.lat != null && l.lng != null);
  if (!loc?.lat || !loc?.lng) return null;
  return {
    circle: { center: { latitude: loc.lat, longitude: loc.lng }, radius: 20000 },
  };
}

export async function suggestAddresses(query: string, sessionToken: string): Promise<Suggestion[]> {
  if (!env.googlePlacesKey || query.trim().length < 3) return [];

  const body: Record<string, unknown> = {
    input: query,
    includedRegionCodes: ["gb"],
    // Addresses only. Without this the list fills with restaurants and bus
    // stops, which is not what somebody typing their own street wants.
    includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
    sessionToken,
  };
  const b = bias();
  if (b) body.locationBias = b;

  try {
    const res = await fetch(AUTOCOMPLETE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.googlePlacesKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      suggestions?: { placePrediction?: { placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }[];
    };
    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .map((p) => ({
        id: p.placeId!,
        main: p.structuredFormat?.mainText?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }))
      .slice(0, 6);
  } catch {
    return [];
  }
}

/**
 * Turn a chosen suggestion into the fields the form needs.
 *
 * Google returns components, not lines, so the first line is assembled from the
 * building and the street. `subpremise` is the flat or unit number and goes
 * first when it exists - it is the part most often missing from a typed address
 * and the part a driver most needs.
 */
export async function resolveAddress(placeId: string, sessionToken: string): Promise<ResolvedAddress | null> {
  if (!env.googlePlacesKey || !placeId) return null;

  try {
    const url = `${DETAILS}/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": env.googlePlacesKey,
        "X-Goog-FieldMask": "addressComponents,location,formattedAddress",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
      location?: { latitude?: number; longitude?: number };
    };

    const parts = data.addressComponents ?? [];
    const get = (type: string) => parts.find((c) => c.types?.includes(type))?.longText ?? "";

    const sub = get("subpremise");
    const premise = get("premise");
    const number = get("street_number");
    const route = get("route");

    // "Flat 2, 14 High Street" rather than "High Street" and a puzzled driver.
    const street = [number || premise, route].filter(Boolean).join(" ");
    const line1 = [sub && `Flat ${sub}`, street].filter(Boolean).join(", ") || route || "";

    return {
      line1,
      line2: get("neighborhood") || get("sublocality") || "",
      city: get("postal_town") || get("locality") || "",
      postcode: get("postal_code"),
      lat: data.location?.latitude ?? null,
      lng: data.location?.longitude ?? null,
    };
  } catch {
    return null;
  }
}
