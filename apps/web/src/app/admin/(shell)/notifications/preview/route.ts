import { NextResponse, type NextRequest } from "next/server";
import { prisma, NOTIFY_AUDIENCES, NOTIFY_EVENTS, type NotifyAudience, type NotifyEvent } from "@launchflow/db";
import { requireScreen } from "@/lib/session";
import { getClientRow } from "@/lib/menu";
import { orderInclude } from "@/lib/orders";
import { emailFor, smsFor } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

/**
 * See the email before a customer does.
 *
 * Renders a real template against a real order from this shop, so what is on
 * screen is exactly what would land in an inbox - not a mock-up that drifts
 * from the code the moment somebody edits one and not the other.
 *
 * Behind the same permission as the settings screen: these contain customer
 * names, addresses and phone numbers.
 */
export async function GET(req: NextRequest) {
  await requireScreen("notifications");

  const q = req.nextUrl.searchParams;
  const event = String(q.get("event") ?? "order_placed") as NotifyEvent;
  const audience = String(q.get("audience") ?? "customer") as NotifyAudience;

  if (!(NOTIFY_EVENTS as readonly string[]).includes(event) || !(NOTIFY_AUDIENCES as readonly string[]).includes(audience)) {
    return new NextResponse("Unknown event or audience", { status: 400 });
  }

  const client = await getClientRow();
  // Prefer an order with the shape the template is about: a delivery order for
  // the delivery templates, otherwise anything. A collection order rendered
  // through "out for delivery" would look wrong for reasons that are nothing to
  // do with the template.
  const wantsDelivery = event === "order_out_for_delivery" || audience === "driver";
  const order =
    (await prisma.order.findFirst({
      where: { clientId: client.id, status: { not: "pending_payment" }, ...(wantsDelivery ? { fulfilment: "delivery" } : {}) },
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    })) ??
    (await prisma.order.findFirst({
      where: { clientId: client.id, status: { not: "pending_payment" } },
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }));

  if (!order) {
    return new NextResponse(
      `<p style="font:16px/1.6 system-ui;padding:40px">No orders yet, so there is nothing to render this against. Place a test order and come back.</p>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  // Sample values for the two templates that describe something that has to
  // have happened. Clearly marked, because a made-up refusal reason presented
  // as real would be worse than no preview.
  const ctx = {
    order,
    reason: event === "order_rejected" ? "Kitchen closed early (example reason)" : undefined,
    refund: event === "order_refunded" ? order.total : undefined,
  };

  if (q.get("channel") === "sms") {
    const body = smsFor(event, audience, ctx);
    return new NextResponse(
      `<div style="font:15px/1.6 system-ui;padding:40px;max-width:520px;margin:0 auto">
         <p style="color:#777;font-size:13px">Text to ${audience} · ${event}</p>
         ${body
           ? `<div style="background:#DFEDE3;border-radius:16px 16px 16px 4px;padding:14px 18px;white-space:pre-wrap">${body.replace(/</g, "&lt;")}</div>
              <p style="color:#777;font-size:13px;padding-top:10px">${body.length} characters — ${Math.ceil(body.length / 160)} text${body.length > 160 ? "s" : ""} at 160 each.</p>`
           : `<p style="color:#A31A1A">Nothing is sent by text for this combination.</p>`}
       </div>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  const mail = emailFor(event, audience, ctx);
  if (!mail) {
    return new NextResponse(
      `<p style="font:16px/1.6 system-ui;padding:40px">Nothing is sent by email for this combination.</p>`,
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  return new NextResponse(mail.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Never cached and never indexed: it renders a real customer's order.
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
