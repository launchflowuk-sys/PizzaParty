import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";

export const dynamic = "force-dynamic";

/**
 * Stop sending to this device.
 *
 * Called on sign-out and when notification permission is withdrawn. Deleted
 * rather than disabled: this is somebody actively asking not to be contacted,
 * and keeping the row would only invite it being reused.
 *
 * No auth. The token is the only thing identifying the device, and requiring a
 * session would mean a signed-out app could never unregister - which is
 * precisely when it needs to.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "No token." }, { status: 400 });

  await prisma.pushDevice.deleteMany({ where: { token } });
  return NextResponse.json({ ok: true });
}
