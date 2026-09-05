import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma, type Prisma } from "@launchflow/db";
import { BasketBody, priceRequest } from "@/lib/checkout";
import { getConfig } from "@/lib/config";
import { getClientRow } from "@/lib/menu";
import { toE164 } from "@/lib/phone";
import { normalisePostcode } from "@/lib/postcode";
import { addEvent, markPlaced } from "@/lib/orders";
import { connectOpts, getStripe, stripeEnabled } from "@/lib/stripe";
import { currentCustomer } from "@/lib/session";
import { env } from "@/lib/env";

const Body = BasketBody.extend({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20),
  email: z.string().trim().email().max(120).or(z.literal("")).default(""),
  address: z.object({ line1: z.string().trim().min(2).max(120), line2: z.string().trim().max(120).default(""), city: z.string().trim().max(80).default(""), postcode: z.string().trim().min(5).max(10) }).optional(),
  notes: z.string().trim().max(300).default(""),
  scheduledFor: z.string().datetime().optional(),
  paymentMethod: z.enum(["card", "cash"]).default("card"),
  marketingOptIn: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check your details.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const body = parsed.data;
  const cfg = getConfig();
  const client = await getClientRow();

  const phone = toE164(body.phone);
  if (!phone) return NextResponse.json({ error: "Please enter a valid UK mobile number." }, { status: 400 });
  if (body.fulfilment === "delivery") {
    if (!body.address) return NextResponse.json({ error: "Delivery address is required." }, { status: 400 });
    body.postcode = normalisePostcode(body.address.postcode);
  }
  if (!cfg.fulfilment.includes(body.fulfilment)) return NextResponse.json({ error: "That option is not available." }, { status: 400 });

  const { priced, location, availability, referrerId } = await priceRequest(body, { customerPhone: phone });
  if (!location) return NextResponse.json({ error: "We don't deliver to that postcode." }, { status: 400 });
  if (priced.errors.length) return NextResponse.json({ error: priced.errors[0], errors: priced.errors, removedKeys: priced.removedKeys }, { status: 409 });
  if (priced.lines.length === 0) return NextResponse.json({ error: "Your basket is empty." }, { status: 400 });

  const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
  if (scheduledFor && scheduledFor.getTime() < Date.now() + 10 * 60_000) return NextResponse.json({ error: "That time slot has passed. Pick another." }, { status: 400 });
  if (!scheduledFor && availability && !availability.open) {
    return NextResponse.json({ error: availability.paused ? `We've paused ordering for a moment${availability.pauseReason ? ` (${availability.pauseReason})` : ""}. Please pick a later time.` : "We're closed right now. Pick a time slot to pre-order." }, { status: 409 });
  }

  const cashAllowed = body.fulfilment === "collection" ? cfg.payments.cashOnCollection : cfg.payments.cashOnDelivery;
  if (body.paymentMethod === "cash" && !cashAllowed) return NextResponse.json({ error: "Cash is not available for this option." }, { status: 400 });
  if (body.paymentMethod === "card" && !stripeEnabled()) return NextResponse.json({ error: "Card payments are not set up yet. Please choose cash or call the shop." }, { status: 503 });

  // Customer: logged-in session wins, else guest by phone
  const sessionCustomer = await currentCustomer();
  const customer = sessionCustomer && sessionCustomer.phone === phone
    ? await prisma.customer.update({ where: { id: sessionCustomer.id }, data: { name: body.name, email: body.email || sessionCustomer.email, marketingOptIn: body.marketingOptIn || sessionCustomer.marketingOptIn } })
    : await prisma.customer.upsert({
        where: { clientId_phone: { clientId: client.id, phone } },
        create: { clientId: client.id, phone, name: body.name, email: body.email, guest: true, marketingOptIn: body.marketingOptIn },
        update: { name: body.name, email: body.email || undefined, marketingOptIn: body.marketingOptIn ? true : undefined },
      });

  // Record who introduced them, once, on their first order. Stored on the
  // customer rather than the order because a person is introduced once, not
  // every time they buy something.
  if (referrerId && referrerId !== customer.id && !customer.referredById && customer.ordersCount === 0) {
    await prisma.customer.update({ where: { id: customer.id }, data: { referredById: referrerId } });
  }

  let addressId: string | null = null;
  if (body.fulfilment === "delivery" && body.address) {
    const existing = await prisma.address.findFirst({ where: { customerId: customer.id, line1: body.address.line1, postcode: body.postcode } });
    const addr = existing ?? (await prisma.address.create({ data: { customerId: customer.id, line1: body.address.line1, line2: body.address.line2, city: body.address.city, postcode: body.postcode, isDefault: true } }));
    addressId = addr.id;
  }

  const promoRow = priced.promoCode ? await prisma.promo.findUnique({ where: { clientId_code: { clientId: client.id, code: priced.promoCode } }, select: { id: true } }) : null;
  const order = await prisma.order.create({
    data: {
      clientId: client.id, locationId: location.id, customerId: customer.id, addressId,
      status: "pending_payment", fulfilment: body.fulfilment, paymentMethod: body.paymentMethod,
      customerName: body.name, customerPhone: phone, customerEmail: body.email,
      deliveryLine1: body.address?.line1 ?? "", deliveryLine2: body.address?.line2 ?? "", deliveryCity: body.address?.city ?? "", deliveryPostcode: body.fulfilment === "delivery" ? body.postcode : "",
      notes: body.notes, scheduledFor,
      subtotal: priced.subtotal, deliveryFee: priced.deliveryFee, discount: priced.discount, promoCode: priced.promoCode, total: priced.total,
      promoId: promoRow?.id,
      payment: { create: { provider: body.paymentMethod === "cash" ? "cash" : "stripe", status: body.paymentMethod === "cash" ? "cash_pending" : "requires_payment", amount: priced.total } },
    },
  });
  for (const [i, l] of priced.lines.entries()) {
    const data: Prisma.OrderItemUncheckedCreateInput = {
      orderId: order.id, productId: l.productId ?? null, dealId: l.dealId ?? null,
      name: l.name, sizeKey: l.sizeKey, sizeName: l.sizeName, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal, notes: l.notes,
      line: body.lines[i] as Prisma.InputJsonValue,
      modifiers: { create: l.modifiers.map((m) => ({ groupName: m.groupName, name: m.name, price: m.price })) },
      components: { create: l.components.map((c) => ({ orderId: order.id, productId: c.productId, name: c.name, sizeKey: c.sizeKey, sizeName: c.sizeName, qty: 1, unitPrice: 0, lineTotal: 0, modifiers: { create: c.modifiers.map((m) => ({ groupName: m.groupName, name: m.name, price: m.price })) } })) },
    };
    await prisma.orderItem.create({ data });
  }
  await addEvent(order.id, "created", "customer", `${body.fulfilment} · ${body.paymentMethod}`);

  if (body.paymentMethod === "cash") {
    await markPlaced(order.id, "customer");
    return NextResponse.json({ orderId: order.id, cash: true });
  }

  try {
    const intent = await getStripe().paymentIntents.create(
      {
        amount: priced.total, currency: "gbp",
        automatic_payment_methods: { enabled: true },
        description: `${cfg.name} order #${order.number}`,
        receipt_email: body.email || undefined,
        metadata: { orderId: order.id, orderNumber: String(order.number), client: env.clientSlug },
      },
      { idempotencyKey: `pi_${order.id}`, ...(connectOpts(cfg.payments.stripeAccountId) ?? {}) },
    );
    await prisma.payment.update({ where: { orderId: order.id }, data: { stripePaymentIntentId: intent.id } });
    return NextResponse.json({ orderId: order.id, clientSecret: intent.client_secret, total: priced.total });
  } catch (e) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    await addEvent(order.id, "cancelled", "system", `Stripe error: ${(e as Error).message}`);
    return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 502 });
  }
}
