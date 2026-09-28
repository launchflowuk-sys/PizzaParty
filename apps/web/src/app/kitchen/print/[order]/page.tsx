import { notFound } from "next/navigation";
import { getFullOrder } from "@/lib/orders";
import { getConfig, assetUrl } from "@/lib/config";
import { Receipt, type Copy } from "@/components/print/Receipt";
import { AutoPrint } from "@/components/print/AutoPrint";
import { ChangeTicket } from "@/components/print/ChangeTicket";
import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import type { ChangeData } from "@/lib/pos-edit";

export const dynamic = "force-dynamic";

/**
 * A page whose only job is to be printed.
 *
 * Deliberately a real page rather than a popup built in JavaScript: it can be
 * opened on its own, looked at, printed twice, or sent to a different printer,
 * and it works the same whether the kitchen has a thermal printer on USB, a
 * network laser in the office, or nothing but a phone and AirPrint.
 *
 * Under /kitchen so the middleware's kitchen cookie guards it - these carry a
 * customer's name, address and phone number.
 *
 * `?copy=` picks which of the three. `?auto=1` prints on load, which is what
 * the kitchen screen uses for a new order.
 */

const COPIES: Copy[] = ["kitchen", "customer", "driver"];

type Params = {
  params: Promise<{ order: string }>;
  searchParams: Promise<{ copy?: string; auto?: string; event?: string }>;
};

export default async function PrintOrder({ params, searchParams }: Params) {
  const { order: id } = await params;
  const { copy: rawCopy, auto, event } = await searchParams;

  const order = await getFullOrder(id);
  // Held to this shop: a signed-in session elsewhere must not print another shop's customer.
  if (!order || order.clientId !== (await getClientRow()).id) notFound();

  // `?copy=changes&event=` prints only what an edit added or voided, so the
  // kitchen is not handed the whole order twice.
  if (rawCopy === "changes") {
    const e = event ? await prisma.orderEvent.findFirst({ where: { id: event, orderId: id, type: "amended" } }) : null;
    if (!e) notFound();
    return (
      <div className="rc-page">
        {auto === "1" ? <AutoPrint /> : null}
        <div className="rc-bar"><span>Order #{order.number} · changes</span><PrintLinks id={id} /></div>
        <ChangeTicket order={order} changes={e.data as unknown as ChangeData} at={e.createdAt} by={e.actor} />
      </div>
    );
  }

  const cfg = getConfig();
  const shop = {
    name: cfg.name,
    logo: assetUrl(cfg.brand.logo),
    address: cfg.contact.address ?? "",
    phone: cfg.contact.phone ?? "",
    reviewUrl: cfg.contact.reviewUrl ?? "",
  };

  // "all" prints the set in one go: what to cook, what goes in the bag, and
  // what the driver carries. Each starts on its own sheet.
  const wanted: Copy[] = rawCopy === "all"
    ? (order.fulfilment === "delivery" ? ["kitchen", "customer", "driver"] : ["kitchen", "customer"])
    : COPIES.includes(rawCopy as Copy) ? [rawCopy as Copy] : ["kitchen"];

  return (
    <div className="rc-page">
      {auto === "1" ? <AutoPrint /> : null}

      {/* Not printed - only for somebody looking at this on screen. */}
      <div className="rc-bar">
        <span>Order #{order.number} · {wanted.length === 1 ? wanted[0] : "all copies"}</span>
        <PrintLinks id={id} />
      </div>

      {wanted.map((c) => <Receipt key={c} order={order} copy={c} shop={shop} />)}
    </div>
  );
}

/** Switch copies without going back to the queue. */
function PrintLinks({ id }: { id: string }) {
  return (
    <span className="rc-bar-links">
      {COPIES.map((c) => (
        <a key={c} href={`/kitchen/print/${id}?copy=${c}`}>{c}</a>
      ))}
      <a href={`/kitchen/print/${id}?copy=all`}>all</a>
    </span>
  );
}
