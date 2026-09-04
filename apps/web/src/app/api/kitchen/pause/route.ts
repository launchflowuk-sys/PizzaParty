import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { kitchenOrAdmin } from "@/lib/kitchen-auth";

const Body = z.object({ locationKey: z.string(), minutes: z.number().int().min(0).max(24 * 60), reason: z.string().max(80).default("") });

/** Pause ordering for a location. minutes = 0 resumes. */
export async function POST(req: NextRequest) {
  if (!(await kitchenOrAdmin(req))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const client = await getClientRow();
  const { locationKey, minutes, reason } = parsed.data;
  const loc = await prisma.location.update({
    where: { clientId_key: { clientId: client.id, key: locationKey } },
    data: { pausedUntil: minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null, pauseReason: minutes > 0 ? reason : "" },
  });
  return NextResponse.json({ ok: true, pausedUntil: loc.pausedUntil });
}
