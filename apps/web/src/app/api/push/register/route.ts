import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { currentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Remember a device so it can be told about its order.
 *
 * Signing in is optional here on purpose. A guest who has just paid for food
 * has the strongest possible claim to know when it is on its way, and making
 * them create an account first to receive that is the wrong trade. The device
 * is recorded either way and attached to a customer the moment there is one.
 *
 * Upserted on the token, which is the device's own identity - so reinstalling
 * the app or a second person signing in on the same phone updates the row
 * rather than accumulating dead ones.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string; platform?: string; deviceId?: string; appVersion?: string;
  };

  const token = (body.token ?? "").trim();
  // Expo's own token shape. Anything else is a client bug or somebody probing.
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token) && !/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
    return NextResponse.json({ error: "Invalid push token." }, { status: 400 });
  }

  const platform = body.platform === "ios" || body.platform === "android" ? body.platform : "";
  const client = await getClientRow();
  const customer = await currentCustomer();

  const data = {
    clientId: client.id,
    customerId: customer?.id ?? null,
    platform,
    deviceId: (body.deviceId ?? "").slice(0, 100),
    appVersion: (body.appVersion ?? "").slice(0, 30),
    lastSeenAt: new Date(),
    // A device coming back is alive again, whatever Expo said last time.
    disabledAt: null,
  };

  await prisma.pushDevice.upsert({ where: { token }, create: { token, ...data }, update: data });
  return NextResponse.json({ ok: true });
}
