import Image from "next/image";
import type { FullOrder } from "@/lib/orders";
import { gbp } from "@/lib/money";

/**
 * The paper.
 *
 * Three copies off one component, because they are the same order and letting
 * them drift is how a driver ends up holding a docket that does not match the
 * bag.
 *
 *   kitchen  - what to cook. Big number, the time, items and notes. No prices:
 *              nobody assembling food needs them, and they crowd out the
 *              modifiers that actually change what goes in the box.
 *   customer - the itemised bill that goes in with the food.
 *   driver   - where it goes, who to ring, and whether to collect money. The
 *              cash line is the whole reason this copy exists.
 *
 * Sized for 80mm thermal paper, which is what a takeaway actually has, but it
 * is plain HTML - so it prints just as well to an A4 laser if that is what is
 * plugged in.
 */

export type Copy = "kitchen" | "customer" | "driver";

const TITLE: Record<Copy, string> = {
  kitchen: "Kitchen copy",
  customer: "Receipt",
  driver: "Delivery note",
};

function timeOf(d: Date | null, tz: string): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(d);
}

export function Receipt({
  order,
  copy,
  shop,
}: {
  order: FullOrder;
  copy: Copy;
  shop: { name: string; logo: string; address: string; phone: string; reviewUrl: string };
}) {
  const tz = order.location.timezone;
  const delivery = order.fulfilment === "delivery";
  const cash = order.paymentMethod === "cash";
  const showPrices = copy !== "kitchen";
  const address = [order.deliveryLine1, order.deliveryLine2, order.deliveryCity, order.deliveryPostcode].filter(Boolean);

  return (
    <article className="rc" data-copy={copy}>
      {/* The logo is skipped on the kitchen copy on purpose: it is read at a
          glance across a hot kitchen, and the branding only pushes the order
          number further down the paper. */}
      {copy !== "kitchen" && shop.logo ? (
        <div className="rc-logo">
          <Image src={shop.logo} alt={shop.name} width={140} height={140} unoptimized priority />
        </div>
      ) : null}

      <div className="rc-shop">
        <strong>{shop.name}</strong>
        {copy !== "kitchen" ? (
          <>
            {shop.address ? <span>{shop.address}</span> : null}
            {shop.phone ? <span>{shop.phone}</span> : null}
          </>
        ) : null}
      </div>

      <div className="rc-title">{TITLE[copy]}</div>

      <div className="rc-number">
        <span className="n">#{order.number}</span>
        <span className="t">{delivery ? "DELIVERY" : "COLLECTION"}</span>
      </div>

      <div className="rc-when">
        {order.scheduledFor
          ? `Wanted ${timeOf(order.scheduledFor, tz)}`
          : order.etaAt
            ? `${delivery ? "Out by" : "Ready"} ${timeOf(order.etaAt, tz)}`
            : "ASAP"}
        <span>Placed {timeOf(order.placedAt ?? order.createdAt, tz)}</span>
      </div>

      {/* Whether there is money to collect is the single most important line on
          a driver's copy, so it is a band rather than a row. */}
      <div className={`rc-pay ${cash ? "cash" : "paid"}`}>
        {cash ? `COLLECT ${gbp(order.total)} CASH` : "PAID ONLINE — collect nothing"}
      </div>

      {copy !== "kitchen" || order.notes ? <hr className="rc-rule" /> : null}

      {copy !== "kitchen" ? (
        <div className="rc-who">
          <strong>{order.customerName}</strong>
          <span>{order.customerPhone}</span>
          {delivery && address.length ? (
            <div className="rc-addr">{address.map((l) => <span key={l}>{l}</span>)}</div>
          ) : null}
        </div>
      ) : null}

      <hr className="rc-rule" />

      <table className="rc-items">
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id}>
              <td className="q">{i.qty}</td>
              <td className="d">
                <strong>{i.name}{i.sizeName ? ` (${i.sizeName})` : ""}</strong>
                {i.modifiers.length ? <span className="m">+ {i.modifiers.map((m) => m.name).join(", ")}</span> : null}
                {i.components.map((c) => (
                  <span key={c.id} className="c">
                    {c.name}{c.sizeName ? ` (${c.sizeName})` : ""}
                    {c.modifiers.length ? ` + ${c.modifiers.map((m) => m.name).join(", ")}` : ""}
                  </span>
                ))}
                {i.notes ? <span className="note">NOTE: {i.notes}</span> : null}
              </td>
              {showPrices ? <td className="p">{gbp(i.lineTotal)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>

      {showPrices ? (
        <>
          <hr className="rc-rule" />
          <table className="rc-totals">
            <tbody>
              <tr><td>Subtotal</td><td>{gbp(order.subtotal)}</td></tr>
              {order.deliveryFee ? <tr><td>Delivery</td><td>{gbp(order.deliveryFee)}</td></tr> : null}
              {order.discount ? <tr><td>Discount{order.promoCode ? ` (${order.promoCode})` : ""}</td><td>−{gbp(order.discount)}</td></tr> : null}
              <tr className="big"><td>TOTAL</td><td>{gbp(order.total)}</td></tr>
            </tbody>
          </table>
        </>
      ) : (
        <div className="rc-kitchen-total">{order.items.reduce((n, i) => n + i.qty, 0)} items · {gbp(order.total)} {cash ? "CASH" : "PAID"}</div>
      )}

      {order.notes ? (
        <div className="rc-notes">
          <strong>Order notes</strong>
          <span>{order.notes}</span>
        </div>
      ) : null}

      {copy === "customer" ? (
        <div className="rc-foot">
          <span>Thanks for ordering with {shop.name}.</span>
          <span>Prices include VAT.</span>
          {shop.reviewUrl ? <span className="rc-review">Enjoyed it? Leave us a review — the link is in your confirmation email.</span> : null}
        </div>
      ) : null}

      {copy === "driver" ? (
        <div className="rc-foot">
          <span>Ring the customer if you cannot find the door.</span>
          <span>Mark delivered on the dispatch screen when you are back.</span>
        </div>
      ) : null}
    </article>
  );
}
