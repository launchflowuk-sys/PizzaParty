import { NextResponse, type NextRequest } from "next/server";
import { getClientRow } from "@/lib/menu";
import { posGuard } from "@/lib/pos";
import { loadQueue } from "@/lib/pos-queue";

export const dynamic = "force-dynamic";

/** Every order in one place, polled every few seconds. See QueueResponse in lib/pos-queue-types.ts. */
export async function GET(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const client = await getClientRow();
  return NextResponse.json(await loadQueue(client.id, req.nextUrl.searchParams.get("since")));
}
