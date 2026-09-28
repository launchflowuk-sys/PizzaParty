import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientRow } from "@/lib/menu";
import { readJson } from "@/lib/pos";
import { posErrorResponse } from "@/lib/pos-queue";
import { closeDay, reportsGuard } from "@/lib/pos-reports";

const Body = z.object({
  date: z.string().max(10).optional(),
  managerPin: z.string().min(1).max(64),
  counted: z.number().int().nonnegative().max(1_000_000).optional(),
});

/** Freeze the day's Z report. Manager PIN; once only; the drawer must be closed first. */
export async function POST(req: NextRequest) {
  const staff = await reportsGuard(req, "manager");
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const client = await getClientRow();
  try {
    return NextResponse.json(await closeDay(client.id, staff, body));
  } catch (e) {
    return posErrorResponse(e);
  }
}
