import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { runAutomation, CRON_SECRET_OK } from "@/lib/marketing";

export const dynamic = "force-dynamic";

/**
 * Runs every active automation. Point a scheduler at this once a day:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/automations
 *
 * Each automation carries its own cooldown and per-run cap, so running this more
 * often than needed cannot double-contact anybody. Paused automations are
 * skipped, and a failure in one does not stop the rest.
 */
export async function POST(req: NextRequest) {
  if (!CRON_SECRET_OK(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const client = await getClientRow();
  const active = await prisma.automation.findMany({
    where: { clientId: client.id, active: true },
    select: { id: true, name: true },
  });

  const results: { name: string; sent?: number; failed?: number; costPence?: number; error?: string }[] = [];
  for (const a of active) {
    try {
      const r = await runAutomation(a.id);
      results.push({ name: a.name, sent: r.sent, failed: r.failed, costPence: r.costPence });
    } catch (e) {
      results.push({ name: a.name, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    ran: results.length,
    totalSent: results.reduce((a, r) => a + (r.sent ?? 0), 0),
    totalCostPence: results.reduce((a, r) => a + (r.costPence ?? 0), 0),
    results,
  });
}

/** GET behaves the same, so a plain scheduler that cannot POST still works. */
export const GET = POST;
