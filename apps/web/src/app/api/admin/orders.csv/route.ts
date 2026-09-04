import { type NextRequest } from "next/server";
import { prisma, type OrderStatus } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { adminOnly } from "@/lib/kitchen-auth";

const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function GET(req: NextRequest) {
  if (!(await adminOnly(req))) return new Response("Unauthorised", { status: 401 });
  const client = await getClientRow();
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") as OrderStatus | null;
  const from = sp.get("from"); const to = sp.get("to");
  const orders = await prisma.order.findMany({
    where: { clientId: client.id, ...(status ? { status } : { status: { not: "pending_payment" } }), ...(from ? { createdAt: { gte: new Date(from), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } } : {}) },
    orderBy: { createdAt: "desc" }, take: 5000, include: { location: true, items: { where: { parentId: null } }, payment: true },
  });
  const header = ["number", "created_at", "status", "fulfilment", "payment", "payment_status", "location", "customer", "phone", "email", "postcode", "items", "subtotal", "delivery_fee", "discount", "promo", "total"];
  const rows = orders.map((o) => [o.number, o.createdAt.toISOString(), o.status, o.fulfilment, o.paymentMethod, o.payment?.status ?? "", o.location.name, o.customerName, o.customerPhone, o.customerEmail, o.deliveryPostcode, o.items.map((i) => `${i.qty}x ${i.name}${i.sizeName ? ` (${i.sizeName})` : ""}`).join("; "), (o.subtotal / 100).toFixed(2), (o.deliveryFee / 100).toFixed(2), (o.discount / 100).toFixed(2), o.promoCode, (o.total / 100).toFixed(2)]);
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="orders-${client.slug}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
