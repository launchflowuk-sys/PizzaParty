import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { addEvent, getFullOrder, orderText, printPayload } from "@/lib/orders";
import { postPrinter } from "@/lib/notify";
import { posGuard, readJson } from "@/lib/pos";
import { printUrl, type PosReprintResult } from "@/lib/pos-queue-types";

const Body = z.object({ copy: z.enum(["kitchen", "customer", "driver"]) });

/** Send a copy to the printer webhook if there is one; always hand back the browser print page. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const { id } = await params;
  const client = await getClientRow();
  if (!(await prisma.order.findFirst({ where: { id, clientId: client.id }, select: { id: true } }))) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const url = getConfig().notifications.printerWebhook;
  let printer: PosReprintResult["printer"] = null;
  if (url) {
    const order = (await getFullOrder(id))!;
    printer = await postPrinter(url, { id, number: order.number, copy: body.copy, reprint: true, text: orderText(order), order: printPayload(order) });
  }
  await addEvent(id, "reprint", staff.name, `${body.copy}${printer ? ` · printer ${printer.ok ? "ok" : printer.error ?? "failed"}` : ""}`);
  const res: PosReprintResult = { printUrl: printUrl(id, body.copy), printer };
  return NextResponse.json(res);
}
