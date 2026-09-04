import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { env } from "@/lib/env";
import { sendReviewRequests } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Hit every 5 minutes: `Authorization: Bearer $CRON_SECRET`.
 * - sends review-request SMS for orders completed > reviewDelayMinutes ago
 * - cancels abandoned pending_payment orders older than 2h
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const sent = await sendReviewRequests();
  const stale = await prisma.order.updateMany({ where: { status: "pending_payment", createdAt: { lt: new Date(Date.now() - 2 * 3600_000) } }, data: { status: "cancelled" } });
  return NextResponse.json({ ok: true, reviewRequestsSent: sent, abandonedCancelled: stale.count });
}
