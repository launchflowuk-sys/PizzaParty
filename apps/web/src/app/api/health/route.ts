import { NextResponse } from "next/server";
import { prisma } from "@launchflow/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await prisma.client.findUnique({ where: { slug: env.clientSlug }, select: { slug: true, configHash: true } });
    return NextResponse.json({ ok: true, client: env.clientSlug, seeded: !!client, configHash: client?.configHash ?? null, time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, client: env.clientSlug, error: (e as Error).message }, { status: 503 });
  }
}
