import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { stripeServerEnabled } from "@/lib/stripe";
import { createOrder, isUniqueViolation, markPlaced } from "@/lib/orders";
import { readJson, walkInCustomer } from "@/lib/pos";
import { KioskBasket, kioskGuard, kioskLimit, kioskOrderCap, priceKiosk } from "@/lib/kiosk";
import { kioskFulfilments, kioskName, kioskOrderPayment, kioskPayments, storedKioskLine, type KioskOrderRef, type KioskPayment } from "@/lib/kiosk-rules";

const Body = KioskBasket.extend({
  name: z.string().max(60).default(""),
  payment: z.enum(["card", "counter"]),
  clientRequestId: z.string().trim().min(8).max(64).regex(/^[\w-]+$/),
});

async function ref(id: string, payment: KioskPayment): Promise<KioskOrderRef> {
  const o = await prisma.order.findUniqueOrThrow({ where: { id }, select: { id: true, number: true, total: true, status: true } });
  return { ...o, payment };
}

/**
 * A kiosk order, through the same createOrder as the till and the website. Prices
 * are the server's alone; no discounts, promo codes or delivery. Pay at the counter
 * goes to the kitchen and the Orders board now, owing cash (staff settle it with
 * Take payment); card waits in pending_payment for /pay. Idempotent on
 * clientRequestId, so a double tap or a lost reply cannot make two orders.
 */
export async function POST(req: NextRequest) {
  const staff = await kioskGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const cfg = getConfig();
  const client = await getClientRow();

  const repeat = await prisma.order.findUnique({ where: { clientId_clientRequestId: { clientId: client.id, clientRequestId: body.clientRequestId } }, select: { id: true, source: true, paymentMethod: true } });
  if (repeat) {
    if (repeat.source !== "kiosk") return NextResponse.json({ error: "Please start a new order." }, { status: 409 });
    return NextResponse.json(await ref(repeat.id, repeat.paymentMethod === "card" ? "card" : "counter"));
  }
  const limited = kioskLimit(req, staff, "order") ?? kioskOrderCap(staff, cfg.pos.kiosk.ordersPerMinute);
  if (limited) return limited;

  if (!kioskFulfilments({ eatIn: cfg.pos.eatIn, fulfilment: cfg.fulfilment }).includes(body.fulfilment)) return NextResponse.json({ error: "That option is not available." }, { status: 400 });
  // The reader a manager assigned lives in the kiosk's signed cookie (setKioskReader).
  const allowed = kioskPayments({ card: cfg.pos.kiosk.card, payAtCounter: cfg.pos.kiosk.payAtCounter, stripe: stripeServerEnabled(), readerChosen: !!staff.reader });
  if (!allowed.includes(body.payment)) return NextResponse.json({ error: "That way to pay is not available." }, { status: 400 });

  const r = await priceKiosk(body);
  if (!r.location) return NextResponse.json({ error: "The shop is not set up yet." }, { status: 503 });
  // Unlike the till, nobody is standing at a kiosk to decide: the kitchen's pause stops it too.
  if (r.availability?.paused) return NextResponse.json({ error: "We've paused new orders for a moment. Please order at the counter." }, { status: 409 });
  if (r.priced.errors.length) return NextResponse.json({ error: r.priced.errors[0], errors: r.priced.errors, removedKeys: r.priced.removedKeys }, { status: 409 });
  if (r.priced.lines.length === 0) return NextResponse.json({ error: "Your order is empty." }, { status: 400 });

  const name = kioskName(body.name);
  const pay = kioskOrderPayment(body.payment, r.priced.total);
  const customer = await walkInCustomer(client.id);
  let order;
  try {
    order = await createOrder({
      clientId: client.id, locationId: r.location.id, customerId: customer.id,
      fulfilment: body.fulfilment, paymentMethod: pay.paymentMethod,
      customerName: name || "Kiosk", customerPhone: "", customerEmail: "",
      postcode: "", notes: "", scheduledFor: null,
      priced: r.priced, lines: body.lines.map(storedKioskLine),
      source: "kiosk", takenBy: staff.name, payment: pay.payment,
      extra: { clientRequestId: body.clientRequestId },
      actor: staff.name,
      eventMessage: `kiosk · ${body.fulfilment === "eat_in" ? "eat in" : "takeaway"} · ${body.payment === "counter" ? "pay at the counter" : "card"}`,
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      const first = await prisma.order.findUnique({ where: { clientId_clientRequestId: { clientId: client.id, clientRequestId: body.clientRequestId } }, select: { id: true } });
      if (first) return NextResponse.json(await ref(first.id, body.payment));
    }
    throw e;
  }
  if (pay.placeNow) await markPlaced(order.id, staff.name);
  return NextResponse.json(await ref(order.id, body.payment));
}
