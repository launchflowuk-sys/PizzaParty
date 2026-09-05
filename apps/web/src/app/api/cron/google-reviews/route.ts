import { NextResponse, type NextRequest } from "next/server";
import { syncGoogleReviews } from "@/lib/google-reviews";
import { CRON_SECRET_OK } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/**
 * Pull the shop's Google reviews.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/google-reviews
 *
 * Daily is plenty. Google only ever returns five, so running it more often
 * costs API calls and finds nothing new.
 */
export async function POST(req: NextRequest) {
  if (!CRON_SECRET_OK(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const result = await syncGoogleReviews();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export const GET = POST;
