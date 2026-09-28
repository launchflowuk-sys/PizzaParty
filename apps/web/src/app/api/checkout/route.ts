import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@launchflow/db";
import { BasketBody, priceRequest } from "@/lib/checkout";
import { getConfig } from "@/lib/config";
import { getClientRow } from "@/lib/menu";
import { toE164 } from "@/lib/phone";
import { normalisePostcode } from "@/lib/postcode";
import { addEvent, createOrder, markPlaced } from "@/lib/orders";
import type { BasketLine } from "@/lib/basket-types";
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

  const order = await createOrder({
    clientId: client.id, locationId: location.id, customerId: customer.id,
    fulfilment: body.fulfilment, paymentMethod: body.paymentMethod,
    customerName: body.name, customerPhone: phone, customerEmail: body.email,
    address: body.address, postcode: body.postcode, notes: body.notes, scheduledFor,
    priced, lines: body.lines as BasketLine[],
    // The app says so on every request; anything else is the website.
    source: req.headers.get("x-lf-client") === "mobile" ? "app" : "web",
    payment: { provider: body.paymentMethod === "cash" ? "cash" : "stripe", status: body.paymentMethod === "cash" ? "cash_pending" : "requires_payment", amount: priced.total },
    actor: "customer", eventMessage: `${body.fulfilment} · ${body.paymentMethod}`,
  });

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
    await prisma.payment.updateMany({ where: { orderId: order.id, provider: "stripe" }, data: { stripePaymentIntentId: intent.id } });
    return NextResponse.json({ orderId: order.id, clientSecret: intent.client_secret, total: priced.total });
  } catch (e) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    await addEvent(order.id, "cancelled", "system", `Stripe error: ${(e as Error).message}`);
    return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 502 });
  }
}
