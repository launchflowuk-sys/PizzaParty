import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@launchflow/db";
import { STATUS_LABEL } from "@/lib/orders";
import { currentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The signed-in customer's own orders.
 *
 * Signed in required, and scoped by customerId in the query rather than
 * filtered afterwards - a list endpoint that fetches broadly and trims later
 * is one refactor away from leaking somebody else's dinner.
 *
 * A one-line summary rather than full items: this is a list to scroll, and
 * pulling every modifier of every line for twenty orders to render "2 items"
 * is a lot of database for a caption.
 */
export async function GET(req: NextRequest) {
  const customer = await currentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 20));

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id, status: { not: "pending_payment" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, number: true, createdAt: true, status: true, fulfilment: true, total: true,
      items: { where: { parentId: null }, select: { name: true, qty: true } },
    },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      label: STATUS_LABEL[o.status],
      fulfilment: o.fulfilment,
      total: o.total,
      itemCount: o.items.reduce((n, i) => n + i.qty, 0),
      summary: o.items.map((i) => `${i.qty}× ${i.name}`).join(", "),
    })),
  }, { headers: { "cache-control": "no-store" } });
}
