import "server-only";
import { prisma } from "@launchflow/db";
import { getConfig } from "./config";
import { env } from "./env";

/**
 * Google reviews.
 *
 * Two things are worth being blunt about before anyone builds on this.
 *
 * First, **Google returns five reviews.** Not the most recent five that you can
 * page through - five, total, chosen by Google. There is no paid tier of the
 * Places API that returns more, and scraping the listing breaks Google's terms.
 * So this is a rolling window of what Google is currently showing, not an
 * archive. `userRatingCount` comes back on the sync for reference, but the
 * count and average on the storefront are worked out from the reviews actually
 * held here (`reviewSummary`), so hiding one moves the storefront figure.
 *
 * Second, **you cannot reply through the API.** Replies are a Business Profile
 * feature and the Places API is read-only, so a reply typed in the back office
 * would go nowhere. Rather than pretend, each Google review carries a link
 * straight to it on Google, where replying actually works. Replies typed here
 * are kept for direct reviews only.
 *
 * Reviews already in the database from ordinary customers are untouched by any
 * of this - they carry `source: "direct"` and no `externalId`.
 */

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

/** Only the fields we use, so Google bills the cheapest SKU it can. */
const FIELD_MASK = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "reviews",
].join(",");

type GoogleReview = {
  name?: string;
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string; photoUri?: string; uri?: string };
  publishTime?: string;
  googleMapsUri?: string;
};

type PlaceResponse = {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: GoogleReview[];
};

export type SyncResult = {
  ok: boolean;
  /** Why it did nothing, when it did nothing. */
  reason?: string;
  fetched: number;
  added: number;
  updated: number;
  placeRating?: number;
  placeTotal?: number;
};

export const googleReviewsConfigured = () =>
  !!env.googlePlacesKey && !!getConfig().contact.googlePlaceId;

/**
 * Pull the current five and fold them into the database.
 *
 * Upserted on Google's own review id, so running this hourly does not
 * accumulate duplicates and an edited review updates in place. A review that
 * drops out of Google's five is left alone rather than deleted - it was real
 * when it arrived, and the shop may have replied to it.
 */
export async function syncGoogleReviews(): Promise<SyncResult> {
  const cfg = getConfig();
  const placeId = cfg.contact.googlePlaceId;
  const key = env.googlePlacesKey;

  if (!key) return { ok: false, reason: "GOOGLE_PLACES_API_KEY is not set", fetched: 0, added: 0, updated: 0 };
  if (!placeId) return { ok: false, reason: "contact.googlePlaceId is not set in client.json", fetched: 0, added: 0, updated: 0 };

  const url = `${PLACES_ENDPOINT}/${encodeURIComponent(placeId)}?languageCode=en-GB`;
  let place: PlaceResponse;
  try {
    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
      // The shop's reviews are not worth a slow page load, so this is only ever
      // called from the cron or the admin button, never from a render.
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: `Google returned ${res.status}: ${body.slice(0, 200)}`, fetched: 0, added: 0, updated: 0 };
    }
    place = (await res.json()) as PlaceResponse;
  } catch (e) {
    return { ok: false, reason: (e as Error).message, fetched: 0, added: 0, updated: 0 };
  }

  const client = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { id: true } });
  if (!client) return { ok: false, reason: "client not seeded", fetched: 0, added: 0, updated: 0 };

  const reviews = place.reviews ?? [];
  let added = 0, updated = 0;

  for (const r of reviews) {
    // Google's `name` is the stable resource id for the review.
    const externalId = r.name;
    if (!externalId) continue;

    const body = (r.text?.text ?? r.originalText?.text ?? "").trim();
    const rating = Math.round(r.rating ?? 0);
    if (rating < 1 || rating > 5) continue;

    const data = {
      customerName: (r.authorAttribution?.displayName ?? "A Google customer").slice(0, 80),
      rating,
      body: body.slice(0, 2000),
      source: "google",
      authorPhoto: r.authorAttribution?.photoUri ?? "",
      externalUrl: r.googleMapsUri ?? place.googleMapsUri ?? "",
      postedAt: r.publishTime ? new Date(r.publishTime) : null,
    };

    const existing = await prisma.review.findFirst({
      where: { clientId: client.id, externalId },
      select: { id: true },
    });

    if (existing) {
      // Deliberately does not touch `hidden` or `featured`: those are the shop's
      // decisions and a sync must not undo them.
      await prisma.review.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.review.create({ data: { ...data, clientId: client.id, externalId } });
      added++;
    }
  }

  return {
    ok: true,
    fetched: reviews.length,
    added,
    updated,
    placeRating: place.rating,
    placeTotal: place.userRatingCount,
  };
}

/** What the storefront shows: the best of what the shop has, nothing hidden. */
export async function publicReviews(limit = 6) {
  const client = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { id: true } });
  if (!client) return [];
  return prisma.review.findMany({
    where: { clientId: client.id, hidden: false, rating: { gte: 4 }, body: { not: "" } },
    orderBy: [{ featured: "desc" }, { postedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true, customerName: true, rating: true, body: true, source: true,
      reply: true, externalUrl: true, postedAt: true, createdAt: true,
    },
  });
}

/** The headline figure, across everything the shop has. */
export async function reviewSummary() {
  const client = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { id: true } });
  if (!client) return { count: 0, average: 0 };
  const agg = await prisma.review.aggregate({
    where: { clientId: client.id, hidden: false },
    _count: true,
    _avg: { rating: true },
  });
  return { count: agg._count, average: Number((agg._avg.rating ?? 0).toFixed(1)) };
}
