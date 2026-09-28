import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { getConfig } from "@/lib/config";
import { toE164 } from "@/lib/phone";
import { normalisePostcode } from "@/lib/postcode";
import { gbp } from "@/lib/money";
import { addEvent, createOrder, markPlaced } from "@/lib/orders";
import { orderRef, posGuard, PosBasketBody, pricePos, readJson, walkInCustomer } from "@/lib/pos";
import type { BasketLine } from "@/lib/basket-types";
import type { PosOrderRef } from "@/lib/pos-types";

const Body = PosBasketBody.extend({
  source: z.enum(["pos", "phone"]),
  customer: z.object({
    name: z.string().trim().max(80).default(""),
    phone: z.string().trim().max(20).optional(),
    email: z.string().trim().email().max(120).or(z.literal("")).optional(),
  }),
  address: z.object({ line1: z.string().trim().min(2).max(120), line2: z.string().trim().max(120).default(""), city: z.string().trim().max(80).default(""), postcode: z.string().trim().min(5).max(10) }).optional(),
  notes: z.string().trim().max(300).default(""),
  scheduledFor: z.string().datetime().optional(),
  payment: z.enum(["cash", "reader", "later"]),
});

/**
 * A counter or phone order. Unlike the website, the till may take an order
 * while online ordering is paused or the shop shows closed - staff decide.
 * "later" goes to the kitchen at once with the money owed; cash and reader
 * orders wait in pending_payment until /pay covers the total.
 */
export async function POST(req: NextRequest) {
  const staff = await posGuard(req);
  if (staff instanceof NextResponse) return staff;
  const body = await readJson(req, Body);
  if (body instanceof NextResponse) return body;
  const cfg = getConfig();
  const client = await getClientRow();

  if (!cfg.fulfilment.includes(body.fulfilment)) return NextResponse.json({ error: "That option is not available." }, { status: 400 });
  const phone = body.customer.phone ? toE164(body.customer.phone) : null;
  if (body.customer.phone && !phone) return NextResponse.json({ error: "That phone number does not look right." }, { status: 400 });
  if (body.fulfilment === "delivery") {
    if (!body.address) return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });
    if (!phone) return NextResponse.json({ error: "A delivery needs a phone number for the driver." }, { status: 400 });
    body.postcode = normalisePostcode(body.address.postcode);
  }
  const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
  if (scheduledFor && scheduledFor.getTime() < Date.now()) return NextResponse.json({ error: "That time has passed." }, { status: 400 });

  const r = await pricePos(body, client.id, staff.id, phone ?? undefined);
  if (r.error) return r.error;
  if (!r.location) return NextResponse.json({ error: "We do not deliver to that postcode." }, { status: 400 });
  if (r.priced.errors.length) return NextResponse.json({ error: r.priced.errors[0], errors: r.priced.errors, removedKeys: r.priced.removedKeys }, { status: 409 });
  if (r.priced.lines.length === 0) return NextResponse.json({ error: "The basket is empty." }, { status: 400 });

  const customer = phone
    ? await prisma.customer.upsert({
        where: { clientId_phone: { clientId: client.id, phone } },
        create: { clientId: client.id, phone, name: body.customer.name, email: body.customer.email ?? "", guest: true },
        update: { name: body.customer.name || undefined, email: body.customer.email || undefined },
      })
    : await walkInCustomer(client.id);

  // Order.discount holds every penny off, so subtotal + delivery - discount = total still holds.
  const priced = { ...r.pos, discount: r.pos.discount + r.pos.manualDiscount };
  const order = await createOrder({
    clientId: client.id, locationId: r.location.id, customerId: customer.id,
    fulfilment: body.fulfilment, paymentMethod: body.payment === "reader" ? "card" : "cash",
    customerName: body.customer.name || customer.name, customerPhone: phone ?? "", customerEmail: body.customer.email || (phone ? customer.email : ""),
    address: body.address, postcode: body.postcode, notes: body.notes, scheduledFor,
    priced, lines: body.lines as BasketLine[],
    source: body.source, takenBy: staff.name,
    payment: body.payment === "later" ? { provider: "cash", status: "cash_pending", amount: priced.total } : undefined,
    actor: staff.name, eventMessage: `${body.source} · ${body.fulfilment} · ${body.payment}`,
  });
  if (body.discount && r.pos.manualDiscount > 0) {
    await addEvent(order.id, "discount", staff.name, `-${gbp(r.pos.manualDiscount)} ${body.discount.reason} (approved by ${r.approvedBy})`, {
      kind: body.discount.kind, value: body.discount.value, pence: r.pos.manualDiscount, reason: body.discount.reason, approvedBy: r.approvedBy,
    });
  }
  // Pay later goes to the kitchen now; so does anything the discount made free.
  if (body.payment === "later" || priced.total === 0) await markPlaced(order.id, staff.name);

  const ref: PosOrderRef = await orderRef(order.id);
  return NextResponse.json(ref);
}
