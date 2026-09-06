import "server-only";
import type { NotifyAudience, NotifyEvent } from "@launchflow/db";
import type { FullOrder } from "@/lib/orders";
import { getConfig } from "@/lib/config";
import { env } from "@/lib/env";
import { brand, button, esc, gbp, lines, panel, say, shell, stars, totals, tracker, type Line } from "./render";

/**
 * What each party is told, at each point, on each channel.
 *
 * One file so the wording stays consistent: the text and the email about the
 * same event should say the same thing, and they drift immediately if they live
 * apart.
 *
 * The type import from lib/orders is type-only on purpose - it is erased at
 * build time, so orders.ts can import this without the two forming a cycle.
 */

export type MailContext = {
  order: FullOrder;
  /** Why the shop refused it. */
  reason?: string;
  /** Pence actually refunded. */
  refund?: number;
};

export type Mail = { subject: string; html: string };

const first = (name: string) => name.trim().split(" ")[0] || "there";

function when(order: FullOrder): string {
  if (!order.etaAt) return order.etaMinutes ? `about ${order.etaMinutes} minutes` : "shortly";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: order.location.timezone,
  }).format(order.etaAt);
}

function address(order: FullOrder): string {
  return [order.deliveryLine1, order.deliveryLine2, order.deliveryCity, order.deliveryPostcode]
    .filter(Boolean).map(esc).join("<br>");
}

/** Order lines in the shape the renderer wants, photographs included. */
function toLines(order: FullOrder): Line[] {
  return order.items.map((i) => ({
    qty: i.qty,
    name: i.name,
    sizeName: i.sizeName || undefined,
    modifiers: i.modifiers.map((m) => m.name),
    components: i.components.map((c) =>
      `${c.name}${c.sizeName ? ` (${c.sizeName})` : ""}${c.modifiers.length ? ` +${c.modifiers.map((m) => m.name).join(", ")}` : ""}`),
    notes: i.notes || undefined,
    total: i.lineTotal,
    image: i.product?.image || undefined,
  }));
}

function money(order: FullOrder) {
  const rows: { label: string; value: string; strong?: boolean }[] = [{ label: "Subtotal", value: gbp(order.subtotal) }];
  if (order.deliveryFee) rows.push({ label: "Delivery", value: gbp(order.deliveryFee) });
  if (order.discount) rows.push({ label: `Discount${order.promoCode ? ` (${order.promoCode})` : ""}`, value: `−${gbp(order.discount)}` });
  rows.push({ label: "Total", value: gbp(order.total), strong: true });
  return totals(rows);
}

/** Where it is going, or that they are coming to get it. */
function fulfilmentPanel(order: FullOrder): string {
  if (order.fulfilment === "delivery") {
    return panel("Delivering to", address(order) + (order.notes ? `<div style="padding-top:8px;color:#8A5A12">${esc(order.notes)}</div>` : ""));
  }
  return panel("Collection from", `${esc(order.location.name)}<br>${esc(order.location.address || "")}`);
}

const track = (order: FullOrder) => `${env.siteUrl}/order/${order.id}`;

/* ─────────────────────────────── customer ─────────────────────────────── */

function customerMail(event: NotifyEvent, ctx: MailContext): Mail | null {
  const { order } = ctx;
  const b = brand();
  const collection = order.fulfilment === "collection";
  const name = first(order.customerName);
  const receipt = lines(toLines(order)) + money(order);

  const wrap = (preheader: string, content: string, subject: string): Mail => ({
    subject,
    html: shell({ preheader, content, b }),
  });

  switch (event) {
    case "order_placed":
      return wrap(
        `Order #${order.number} received — ${gbp(order.total)}`,
        say(`Thanks ${name}, we've got it`,
          `Your order is with the kitchen now. We'll email you the moment it's confirmed${collection ? "" : " and again when the driver sets off"}.`)
        + tracker(0, collection, b)
        + button("Track your order", track(order), b)
        + fulfilmentPanel(order)
        + `<h2 style="margin:26px 0 0;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a">Order #${order.number}</h2>`
        + receipt,
        `Order #${order.number} received — ${b.name}`);

    case "order_accepted":
      return wrap(
        `Confirmed for ${when(order)}`,
        say("Your order is confirmed",
          collection
            ? `The kitchen has it, ${esc(name)}. It'll be ready to collect at <strong>${esc(when(order))}</strong>.`
            : `The kitchen has it, ${esc(name)}. Estimated delivery <strong>${esc(when(order))}</strong>.`)
        + tracker(1, collection, b)
        + button("Track your order", track(order), b)
        + fulfilmentPanel(order),
        `Order #${order.number} confirmed — ${collection ? "ready" : "delivery"} ${when(order)}`);

    case "order_preparing":
      return wrap(
        `Your food is being made`,
        say("It's in the oven", `Not long now, ${esc(name)}.`)
        + tracker(2, collection, b)
        + button("Track your order", track(order), b),
        `Order #${order.number} is being made`);

    case "order_ready":
      if (!collection) return null; // delivery orders get the next one instead
      return wrap(
        `Ready to collect now`,
        say("Ready when you are",
          `Order #${order.number} is boxed and waiting, ${esc(name)}. Come on in.`)
        + tracker(3, true, b)
        + panel("Collect from", `${esc(order.location.name)}<br>${esc(order.location.address || "")}`, "good")
        + (b.phone ? `<p style="margin:0;font-size:15px;color:#444">Running late? Give us a ring on <a href="tel:${esc(b.phone.replace(/\s+/g, ""))}" style="color:${b.primary}">${esc(b.phone)}</a>.</p>` : ""),
        `Order #${order.number} is ready to collect`);

    case "order_out_for_delivery":
      return wrap(
        `On its way — arriving around ${when(order)}`,
        say("Your order is on its way",
          `The driver has left, ${esc(name)}. Arriving around <strong>${esc(when(order))}</strong>.`)
        + tracker(3, false, b)
        + button("Track your order", track(order), b)
        + panel("Delivering to", address(order) + (order.notes ? `<div style="padding-top:8px;color:#8A5A12">${esc(order.notes)}</div>` : "")),
        `Order #${order.number} is on its way`);

    case "order_completed": {
      const cfg = getConfig();
      const points = cfg.loyalty.enabled ? Math.floor((order.subtotal / 100) * cfg.loyalty.pointsPerPound) : 0;
      return wrap(
        `Your receipt for order #${order.number}`,
        say(collection ? "Thanks for coming in" : "Enjoy your food",
          `Here's your receipt, ${esc(name)}. Thanks for ordering with us.`)
        + tracker(4, collection, b)
        + `<h2 style="margin:8px 0 0;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a">Order #${order.number}</h2>`
        + receipt
        + (points > 0 ? panel("Crust Club", `You've earned <strong>${points} points</strong> on this order. <a href="${esc(b.siteUrl)}/rewards" style="color:${b.primary}">See what they're worth</a>.`, "good") : "")
        + (b.reviewUrl
          ? `<div style="border-top:1px solid #ececec;margin-top:26px;padding-top:22px;text-align:center">
               <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#1a1a1a">How did we do?</p>
               <p style="margin:0 0 6px;font-size:14px;color:#666">A quick review genuinely helps a small shop.</p>
               ${stars(b)}
             </div>`
          : "")
        + `<div style="text-align:center;padding-top:6px">${button("Order again", `${b.siteUrl}/menu`, b)}</div>`,
        `Your ${b.name} receipt — order #${order.number}`);
    }

    case "order_rejected":
      return wrap(
        `We couldn't take order #${order.number}`,
        say("We're sorry — we couldn't take this one",
          `Something's gone wrong at our end, ${esc(name)}, and we haven't been able to make your order.`)
        + panel("Reason", ctx.reason ? esc(ctx.reason) : "The kitchen couldn't take the order.", "warn")
        + (order.paymentMethod === "card"
          ? panel("Your money", `<strong>${gbp(order.total)}</strong> is being refunded to the card you paid with. It usually shows within 5 to 10 working days, depending on your bank. You do not need to do anything.`, "good")
          : panel("Your money", "You haven't been charged — this order was going to be paid in cash.", "good"))
        + (b.phone ? `<p style="margin:18px 0 0;font-size:15px;line-height:1.55;color:#444">If you'd rather sort something out, ring us on <a href="tel:${esc(b.phone.replace(/\s+/g, ""))}" style="color:${b.primary}">${esc(b.phone)}</a> and we'll do what we can.</p>` : ""),
        `Order #${order.number} — we couldn't take it`);

    case "order_refunded":
      return wrap(
        `Refund of ${gbp(ctx.refund ?? order.total)} sent`,
        say("Your refund is on its way",
          `We've sent <strong>${gbp(ctx.refund ?? order.total)}</strong> back to the card you paid with for order #${order.number}.`)
        + panel("When it lands", "Usually 5 to 10 working days, depending on your bank. It goes back to the same card automatically — there's nothing for you to do.", "good")
        + (b.phone ? `<p style="margin:18px 0 0;font-size:15px;color:#444">Any questions, ring us on <a href="tel:${esc(b.phone.replace(/\s+/g, ""))}" style="color:${b.primary}">${esc(b.phone)}</a>.</p>` : ""),
        `Refund sent — order #${order.number}`);

    case "review_request":
      if (!b.reviewUrl) return null;
      return wrap(
        `How was your order?`,
        say("How did we do?",
          `Hope you enjoyed it, ${esc(name)}. If you've got twenty seconds, a review helps us more than you'd think.`)
        + stars(b)
        + `<div style="text-align:center">${button("Leave a review", b.reviewUrl, b)}</div>`
        + `<p style="margin:22px 0 0;font-size:14px;line-height:1.55;color:#777;text-align:center">If something wasn't right, please ring us first on <a href="tel:${esc(b.phone.replace(/\s+/g, ""))}" style="color:${b.primary}">${esc(b.phone)}</a> — we'd much rather fix it.</p>`,
        `How was your order from ${b.name}?`);

    default:
      return null;
  }
}

/* ──────────────────────────────── kitchen ──────────────────────────────── */

/**
 * The kitchen gets a docket, not a brochure.
 *
 * Big number, big total, and the items in monospace so quantities line up when
 * it is read at arm's length or printed. This is the one place the plain
 * layout is right rather than lazy.
 */
function kitchenMail(event: NotifyEvent, ctx: MailContext): Mail | null {
  if (event !== "order_placed") return null;
  const { order } = ctx;
  const b = brand();
  const items = order.items.map((i) => {
    const mods = i.modifiers.map((m) => m.name).join(", ");
    const comps = i.components.map((c) => `\n     - ${c.name}${c.sizeName ? ` (${c.sizeName})` : ""}${c.modifiers.length ? ` +${c.modifiers.map((m) => m.name).join(", ")}` : ""}`).join("");
    return `${String(i.qty).padStart(2)} × ${i.name}${i.sizeName ? ` (${i.sizeName})` : ""}${mods ? ` +${mods}` : ""}${i.notes ? `\n     NOTE: ${i.notes}` : ""}${comps}`;
  }).join("\n");

  const head = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:38px;font-weight:800;color:#1a1a1a;line-height:1">#${order.number}</td>
      <td align="right" style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:24px;font-weight:800;color:${b.primary};line-height:1">${gbp(order.total)}</td>
    </tr></table>
    <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:16px;font-weight:700;color:#1a1a1a;padding:10px 0 2px">
      ${order.fulfilment.toUpperCase().replace("_", " ")} · ${order.paymentMethod === "cash" ? "CASH — COLLECT PAYMENT" : "PAID"} · ${order.scheduledFor ? esc(when(order)) : "ASAP"}
    </div>
    <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;color:#444;line-height:1.55">
      ${esc(order.customerName)} · <a href="tel:${esc(order.customerPhone.replace(/\s+/g, ""))}" style="color:${b.primary}">${esc(order.customerPhone)}</a>
      ${order.fulfilment === "delivery" ? `<br>${address(order)}` : ""}
    </div>`;

  return {
    subject: `#${order.number} ${order.fulfilment} ${gbp(order.total)} — ${order.customerName}`,
    html: shell({
      preheader: `#${order.number} · ${order.fulfilment} · ${gbp(order.total)} · ${order.customerName}`,
      b,
      content: head
        + `<pre style="font:14px/1.6 ui-monospace,Menlo,Consolas,monospace;background:#f7f6f3;border:1px solid #e6e4df;border-radius:6px;padding:16px;margin:18px 0;white-space:pre-wrap;color:#1a1a1a">${esc(items)}</pre>`
        + (order.notes ? panel("Order notes", esc(order.notes), "warn") : "")
        + button("Open kitchen screen", `${b.siteUrl}/kitchen`, b),
    }),
  };
}

/* ───────────────────────────── owner / admin ───────────────────────────── */

function adminMail(event: NotifyEvent, ctx: MailContext): Mail | null {
  const { order } = ctx;
  const b = brand();
  const line = (k: string, v: string) =>
    `<tr><td style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;color:#777;padding:4px 16px 4px 0;white-space:nowrap">${esc(k)}</td>
         <td style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;color:#1a1a1a;padding:4px 0;font-weight:600">${v}</td></tr>`;

  const facts = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px">
      ${line("Order", `#${order.number}`)}
      ${line("Customer", `${esc(order.customerName)} · ${esc(order.customerPhone)}`)}
      ${line("Type", `${esc(order.fulfilment)} · ${order.paymentMethod === "cash" ? "cash" : "card"}`)}
      ${line("Total", gbp(order.total))}
      ${order.fulfilment === "delivery" ? line("Address", address(order)) : line("From", esc(order.location.name))}
    </table>`;

  const headline: Partial<Record<NotifyEvent, [string, string]>> = {
    order_placed: ["New order", `A new order has come in at ${esc(order.location.name)}.`],
    order_accepted: ["Order accepted", `#${order.number} has been accepted by the kitchen.`],
    order_ready: ["Order ready", `#${order.number} is ready.`],
    order_out_for_delivery: ["Out for delivery", `#${order.number} has left with a driver.`],
    order_completed: ["Order completed", `#${order.number} has been ${order.fulfilment === "collection" ? "collected" : "delivered"}.`],
    order_rejected: ["Order refused", `#${order.number} was refused${ctx.reason ? `: ${esc(ctx.reason)}` : ""}.`],
    order_refunded: ["Refund issued", `${gbp(ctx.refund ?? order.total)} has been refunded on #${order.number}.`],
  };
  const h = headline[event];
  if (!h) return null;

  const tone = event === "order_rejected" || event === "order_refunded" ? "warn" : "plain";

  return {
    subject: `${h[0]} — #${order.number} ${gbp(order.total)}`,
    html: shell({
      preheader: `#${order.number} · ${gbp(order.total)} · ${order.customerName}`,
      b,
      content: say(h[0], h[1])
        + facts
        + (event === "order_rejected" && ctx.reason ? panel("Reason given", esc(ctx.reason), tone) : "")
        + (event === "order_refunded" ? panel("Refunded", `<strong>${gbp(ctx.refund ?? order.total)}</strong> back to the customer's card.`, tone) : "")
        + button("Open in the back office", `${b.siteUrl}/admin/orders`, b),
    }),
  };
}

/* ──────────────────────────────── driver ──────────────────────────────── */

function driverMail(event: NotifyEvent, ctx: MailContext): Mail | null {
  if (event !== "order_ready" || ctx.order.fulfilment !== "delivery") return null;
  const { order } = ctx;
  const b = brand();
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    [order.deliveryLine1, order.deliveryCity, order.deliveryPostcode].filter(Boolean).join(", "))}`;
  return {
    subject: `Delivery #${order.number} — ${order.deliveryPostcode}`,
    html: shell({
      preheader: `#${order.number} to ${order.deliveryPostcode}`,
      b,
      content: say(`Delivery #${order.number}`, "This one's ready to go.")
        + panel("Drop at", address(order) + (order.notes ? `<div style="padding-top:8px;color:#8A5A12">${esc(order.notes)}</div>` : ""))
        + panel(order.paymentMethod === "cash" ? "Collect on the door" : "Already paid",
                order.paymentMethod === "cash" ? `<strong>${gbp(order.total)}</strong> in cash.` : "Nothing to collect.",
                order.paymentMethod === "cash" ? "warn" : "good")
        + `<p style="margin:0 0 6px;font-size:15px;color:#444">${esc(order.customerName)} · <a href="tel:${esc(order.customerPhone.replace(/\s+/g, ""))}" style="color:${b.primary}">${esc(order.customerPhone)}</a></p>`
        + button("Open directions", maps, b),
    }),
  };
}

/* ─────────────────────────────── dispatchers ─────────────────────────────── */

export function emailFor(event: NotifyEvent, audience: NotifyAudience, ctx: MailContext): Mail | null {
  switch (audience) {
    case "customer": return customerMail(event, ctx);
    case "kitchen": return kitchenMail(event, ctx);
    case "admin": return adminMail(event, ctx);
    case "driver": return driverMail(event, ctx);
    default: return null;
  }
}

/**
 * The same events, in 160 characters.
 *
 * Deliberately shorter than the emails rather than a summary of them: a text is
 * read on a lock screen. Every one that can carry the tracking link does,
 * because that is the question the customer is actually asking.
 */
export function smsFor(event: NotifyEvent, audience: NotifyAudience, ctx: MailContext): string | null {
  const { order } = ctx;
  const cfg = getConfig();
  const shop = cfg.name;
  const collection = order.fulfilment === "collection";
  const link = track(order);

  if (audience === "customer") {
    switch (event) {
      case "order_placed": return `${shop}: thanks ${first(order.customerName)}! Order #${order.number} received (${gbp(order.total)}). Track it: ${link}`;
      case "order_accepted": return collection
        ? `${shop}: order #${order.number} accepted. Ready to collect at ${when(order)}. ${link}`
        : `${shop}: order #${order.number} accepted. Estimated delivery ${when(order)}. ${link}`;
      case "order_preparing": return `${shop}: order #${order.number} is being made now. ${link}`;
      case "order_ready": return collection ? `${shop}: order #${order.number} is ready to collect.` : null;
      case "order_out_for_delivery": return `${shop}: order #${order.number} is on its way, arriving around ${when(order)}. ${link}`;
      case "order_completed": return `${shop}: thanks for your order! Your receipt is on its way by email.`;
      case "order_rejected": return `${shop}: sorry, we couldn't take order #${order.number}${ctx.reason ? ` (${ctx.reason})` : ""}.${order.paymentMethod === "card" ? " Your payment is being refunded." : ""} Call us on ${cfg.contact.phone || "the shop"}.`;
      case "order_refunded": return `${shop}: ${gbp(ctx.refund ?? order.total)} has been refunded to your card for order #${order.number}. Allow 5-10 working days.`;
      case "review_request": return cfg.contact.reviewUrl
        ? `${shop}: hope you enjoyed your order! A quick Google review helps us loads: ${cfg.contact.reviewUrl}`
        : null;
      default: return null;
    }
  }

  if (audience === "kitchen" && event === "order_placed") {
    const addr = order.fulfilment === "delivery" ? ` ${order.deliveryPostcode}` : "";
    return `NEW ORDER #${order.number} ${order.fulfilment.toUpperCase()}${addr} ${gbp(order.total)} ${order.paymentMethod === "cash" ? "CASH" : "PAID"} — ${env.siteUrl}/kitchen`;
  }

  if (audience === "admin") {
    switch (event) {
      case "order_placed": return `${shop}: new order #${order.number}, ${order.fulfilment}, ${gbp(order.total)}.`;
      case "order_rejected": return `${shop}: order #${order.number} REFUSED${ctx.reason ? ` (${ctx.reason})` : ""}, ${gbp(order.total)}.`;
      case "order_refunded": return `${shop}: ${gbp(ctx.refund ?? order.total)} refunded on order #${order.number}.`;
      case "order_completed": return `${shop}: order #${order.number} completed, ${gbp(order.total)}.`;
      default: return null;
    }
  }

  if (audience === "driver" && event === "order_ready" && order.fulfilment === "delivery") {
    const addr = [order.deliveryLine1, order.deliveryPostcode].filter(Boolean).join(", ");
    return `${shop}: delivery #${order.number} ready. ${addr}. ${order.paymentMethod === "cash" ? `COLLECT ${gbp(order.total)} CASH.` : "Paid."} ${order.customerPhone}`;
  }

  return null;
}

/* ───────────────────────────── logging in ───────────────────────────── */

/**
 * Six digits, and as little else as possible.
 *
 * The code is the entire message, so it is the biggest thing on the page and
 * sits in the preheader too - most people read it off the notification and
 * never open the email at all. Letter-spaced so it can be copied by eye
 * without miscounting, and deliberately not a link: a login email that asks
 * you to click something is training people to click links in emails.
 */
export function loginCodeEmail(code: string): Mail {
  const b = brand();
  return {
    subject: `${code} is your ${b.name} code`,
    html: shell({
      preheader: `${code} — expires in 10 minutes`,
      b,
      content:
        say("Here's your code", "Type this in to finish signing in. It works for ten minutes.")
        + `<div style="text-align:center;margin:22px 0 8px">
             <div style="display:inline-block;background:#F7F6F3;border:1px solid #e6e4df;border-radius:8px;padding:16px 26px;
                         font-family:ui-monospace,Menlo,Consolas,monospace;font-size:38px;font-weight:700;
                         letter-spacing:.22em;color:#1a1a1a;line-height:1">${esc(code)}</div>
           </div>`
        + `<p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#777">
             If you did not ask to sign in, you can ignore this email — nobody can get into your
             account without the code above, and it stops working in ten minutes.
           </p>`,
    }),
  };
}
