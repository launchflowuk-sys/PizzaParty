import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard, readJson } from "@/lib/pos";
import { currentDrawer, driversCash, settleDriver, SettleBody } from "@/lib/pos-cash";
import { posErrorResponse, shopTimezone } from "@/lib/pos-queue";
import { pickDate, reportPeriod } from "@/lib/pos-reports";
import type { PosDriverSettleResult } from "@/lib/pos-reports-types";

/** A driver hands their doorstep cash in: a drawer pay-in linked to them, capped at what they owe. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, SettleBody);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const client = await getClientRow();
  try {
    const locationKey = await settleDriver(client.id, id, staff, body);
    const tz = await shopTimezone(client.id);
    const { from, to } = await reportPeriod(client.id, tz, pickDate(null, tz));
    const driver = (await driversCash(client.id, from, to)).find((d) => d.id === id);
    const drawer = await currentDrawer(client.id, locationKey, from);
    const res: PosDriverSettleResult = { driver: driver!, drawer: drawer! };
    return NextResponse.json(res);
  } catch (e) {
    return posErrorResponse(e);
  }
}
