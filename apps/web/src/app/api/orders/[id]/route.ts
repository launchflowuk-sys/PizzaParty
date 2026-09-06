import { NextResponse, type NextRequest } from "next/server";
import { getFullOrder, STATUS_LABEL } from "@/lib/orders";
import { currentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * One order, as JSON, for the tracker.
 *
 * Access matches the website: the order id is long, random and unguessable,
 * and holding it is enough. That has to stay true, because guests order
 * without an account and the link in their confirmation text is the only way
 * back to it - requiring a session here would lock out the people most likely
 * to be watching.
 *
 * When a token *is* present the order must belong to that customer. Without
 * that check, a signed-in person could read a stranger's order by id and the
 * app would have quietly widened access rather than narrowed it.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = await getFullOrder(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const customer = await currentCustomer();
  if (customer && order.customerId !== customer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ order: serialiseOrder(order) }, { headers: { "cache-control": "no-store" } });
}

/**
 * Not exported: a route file may only export request handlers, and Next's
 * generated types fail the build on anything else. The history endpoint has
 * its own narrower shape anyway - it needs a caption, not every modifier.
 */
function serialiseOrder(order: NonNullable<Awaited<ReturnType<typeof getFullOrder>>>) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    label: STATUS_LABEL[order.status],
    createdAt: order.createdAt.toISOString(),
    placedAt: order.placedAt?.toISOString() ?? null,
    etaAt: order.etaAt?.toISOString() ?? null,
    etaMinutes: order.etaMinutes,
    scheduledFor: order.scheduledFor?.toISOString() ?? null,
    fulfilment: order.fulfilment,
    paymentMethod: order.paymentMethod,
    paid: order.payment?.status === "succeeded",
    rejectReason: order.rejectReason || "",
    branch: { name: order.location.name, phone: order.location.phone ?? "", timezone: order.location.timezone },
    address: order.fulfilment === "delivery"
      ? { line1: order.deliveryLine1, line2: order.deliveryLine2, city: order.deliveryCity, postcode: order.deliveryPostcode }
      : null,
    customer: { name: order.customerName, phone: order.customerPhone, email: order.customerEmail },
    notes: order.notes || "",
    items: order.items.map((i) => ({
      id: i.id,
      qty: i.qty,
      name: i.name,
      sizeName: i.sizeName || "",
      modifiers: i.modifiers.map((m) => m.name),
      components: i.components.map((c) => ({
        name: c.name,
        sizeName: c.sizeName || "",
        modifiers: c.modifiers.map((m) => m.name),
      })),
      notes: i.notes || "",
      lineTotal: i.lineTotal,
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    promoCode: order.promoCode || "",
    total: order.total,
  };
}
