/**
 * CLI: generate a plausible trading history for a demo shop.
 *
 *   pnpm demo-data farm-pizza            # ~9 months of customers and orders
 *   pnpm demo-data farm-pizza --wipe     # clear generated data first
 *
 * This exists so a demo shows the back office doing its job: a dashboard with
 * takings on it, a customer list worth marketing to, and campaign figures that
 * came from real rows rather than a mock-up.
 *
 * Everything it writes is tagged - customers get an 07700 900xxx number (Ofcom's
 * reserved drama range, so no real phone can collide) and orders carry a
 * `demo: true` flag in the item payload - so --wipe removes exactly what it made
 * and never touches a genuine order.
 *
 * NEVER run this against a live shop.
 */
import { prisma, type OrderStatus } from "@launchflow/db";

const slug = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? process.env.CLIENT_SLUG;
const wipe = process.argv.includes("--wipe");
const DAYS = 270;
const CUSTOMERS = 850;
/** Days of proper trading volume at the end, so the dashboard is not a ghost town. */
const RECENT_DAYS = 21;
/** Ofcom reserves 07700 900000-900999 for fiction. Nothing here can ring a real phone. */
const PHONE_PREFIX = "0770090";

if (!slug) { console.error("Usage: pnpm demo-data <slug> [--wipe]"); process.exit(1); }

/** Deterministic RNG, so re-running produces the same shop rather than a new one. */
let seed = 0x9e3779b9;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
/** Every list here is a non-empty literal, so the index is always in range. */
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)] as T;
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);

const FIRST = ["Dave","Sarah","Mo","Emma","Liam","Aisha","Tony","Chloe","Ryan","Nicola","Kev","Priya","Jack","Leanne","Sam","Hannah","Gary","Amber","Josh","Steph","Darren","Yasmin","Callum","Rachel","Terry","Bev","Owen","Sonia","Craig","Freya","Nathan","Kirsty","Dean","Maria","Luke","Jade","Paul","Toni","Ben","Georgia","Adam","Lisa","Scott","Nadia","Wayne","Ellie","Marcus","Donna","Reece","Katie"];
const LAST = ["Wright","Patel","Osei","Cooper","Byrne","Khan","Adams","Nolan","Fletcher","Hughes","Boateng","Marsh","Doyle","Reid","Kaur","Baxter","Ellis","Chowdhury","Ward","Pike","Hastings","Nkemdirim","Groves","Sharma","Ives","Bramble","Quinn","Lawal","Timms","Ferris"];
/** Grays and Basildon, which is where the two shops actually are. */
const AREAS = [
  { city: "Grays", codes: ["RM17 5","RM17 6","RM16 2","RM16 4","RM20 3","RM20 4"], streets: ["Orsett Road","Bridge Road","Hathaway Road","Lodge Lane","Palmers Avenue","Whitehall Lane","Dell Road","Crammavill Street"] },
  { city: "Basildon", codes: ["SS13 1","SS14 2","SS14 3","SS15 5","SS16 4","SS16 5"], streets: ["Clay Hill Road","Whitmore Way","Broadmayne","Long Riding","Timberlog Lane","Church Road","Rectory Road","Nevendon Road"] },
];

async function main() {
  const client = await prisma.client.findUnique({ where: { slug: slug! }, select: { id: true, name: true } });
  if (!client) throw new Error(`No client "${slug}". Run pnpm seed ${slug} first.`);
  const clientId = client.id;

  if (wipe) {
    const generated = await prisma.customer.findMany({
      where: { clientId, phone: { startsWith: PHONE_PREFIX } }, select: { id: true },
    });
    const ids = generated.map((c) => c.id);
    const orders = await prisma.order.findMany({ where: { customerId: { in: ids } }, select: { id: true } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
    await prisma.marketingSend.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.customer.deleteMany({ where: { id: { in: ids } } });
    console.log(`Wiped ${ids.length} demo customers and ${orders.length} demo orders.`);
  }

  const locations = await prisma.location.findMany({ where: { clientId }, select: { id: true, name: true } });
  const products = await prisma.product.findMany({
    where: { clientId, active: true },
    select: { id: true, name: true, sizes: { select: { key: true, name: true, price: true } } },
  });
  const priced = products.filter((p) => p.sizes.length > 0);
  if (!locations.length || !priced.length) throw new Error("Seed the menu first: pnpm seed " + slug);

  /**
   * Credit an order back to the message that caused it - the same rule the app
   * uses at runtime, repeated here so this script does not have to import
   * server-only code.
   */
  async function attribute(orderId: string, customerId: string, promoCode: string, total: number) {
    const send = await prisma.marketingSend.findFirst({
      where: { clientId, customerId, promoCode: { equals: promoCode, mode: "insensitive" }, redeemedOrderId: "" },
      orderBy: { sentAt: "desc" },
    });
    if (!send) return;
    await prisma.marketingSend.update({
      where: { id: send.id },
      data: { redeemedOrderId: orderId, redeemedAt: new Date(), revenuePence: total },
    });
  }

  /** One basket. Weighted so most orders are a pizza plus something on the side. */
  function basket() {
    const lines: { productId: string; name: string; sizeKey: string; sizeName: string; qty: number; unitPrice: number; lineTotal: number; line: { demo: true } }[] = [];
    for (let i = 0, n = between(1, 4); i < n; i++) {
      const p = pick(priced);
      const size = pick(p.sizes);
      const unitPrice = size.price;
      const qty = rnd() < 0.82 ? 1 : 2;
      lines.push({
        productId: p.id, name: p.name,
        sizeKey: size.key, sizeName: size.name,
        qty, unitPrice, lineTotal: unitPrice * qty,
        line: { demo: true },
      });
    }
    return lines;
  }

  let madeCustomers = 0, madeOrders = 0;
  for (let i = 0; i < CUSTOMERS; i++) {
    const area = pick(AREAS);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const phone = PHONE_PREFIX + String(i).padStart(4, "0");

    // A real takeaway's customer base: a long tail of one-timers, a solid middle,
    // and a handful of regulars who order most weeks.
    const roll = rnd();
    const orderCount = roll < 0.55 ? 1 : roll < 0.85 ? between(2, 3) : roll < 0.97 ? between(4, 8) : between(9, 18);
    // How long since they last ordered. A third have gone quiet - those are the
    // ones the win-back automation exists for.
    const lastGap = roll < 0.55 ? between(3, 240) : between(1, 150);

    const customer = await prisma.customer.upsert({
      where: { clientId_phone: { clientId, phone } },
      create: {
        clientId, phone, name, guest: false,
        email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        marketingOptIn: rnd() < 0.74,
        lastPostcode: `${pick(area.codes)}${String.fromCharCode(65 + between(0, 25))}${String.fromCharCode(65 + between(0, 25))}`,
      },
      update: {},
      select: { id: true, name: true, phone: true, email: true, lastPostcode: true },
    });
    madeCustomers++;

    // Space their orders backwards from the last one.
    let spent = 0, last: Date | null = null;
    for (let o = 0; o < orderCount; o++) {
      const when = daysAgo(Math.min(DAYS, lastGap + o * between(6, 34)));
      const lines = basket();
      const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
      const fulfilment = rnd() < 0.72 ? "delivery" : "collection";
      const deliveryFee = fulfilment === "delivery" ? 199 : 0;
      const total = subtotal + deliveryFee;
      const loc = pick(locations);

      await prisma.order.create({
        data: {
          clientId, locationId: loc.id, customerId: customer.id,
          status: "completed",
          fulfilment: fulfilment as "delivery" | "collection",
          paymentMethod: rnd() < 0.66 ? "card" : "cash",
          customerName: customer.name, customerPhone: customer.phone, customerEmail: customer.email,
          deliveryLine1: fulfilment === "delivery" ? `${between(1, 180)} ${pick(area.streets)}` : "",
          deliveryCity: fulfilment === "delivery" ? area.city : "",
          deliveryPostcode: fulfilment === "delivery" ? customer.lastPostcode : "",
          subtotal, deliveryFee, discount: 0, total,
          placedAt: when, acceptedAt: when,
          completedAt: new Date(when.getTime() + between(22, 55) * 60_000),
          createdAt: when, updatedAt: when,
          items: { create: lines },
        },
      });
      madeOrders++;
      spent += total;
      if (!last || when > last) last = when;
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { ordersCount: orderCount, totalSpent: spent, lastOrderAt: last, loyaltyPoints: Math.floor(spent / 100) },
    });
  }

  // ---------------------------------------------------------------------------
  // Recent trading.
  //
  // The history above spreads thinly over nine months, which leaves today's
  // dashboard reading three orders. A real takeaway does forty-odd on a Friday,
  // so the last few weeks get proper volume drawn from the same customers - and
  // today gets orders still on the pass, so the kitchen and dispatch screens
  // have something in them.
  // ---------------------------------------------------------------------------
  const roster = await prisma.customer.findMany({
    where: { clientId, phone: { startsWith: PHONE_PREFIX } },
    select: { id: true, name: true, phone: true, email: true, lastPostcode: true },
  });
  // Six in ten are still ordering. The rest have drifted off, and stay drifted -
  // otherwise the recent weeks below would sweep the whole list back into
  // "ordered recently" and the win-back automation would have nobody to talk to.
  const active = roster.filter((c) => Number(c.phone.slice(-1)) < 6);

  /** Write one order and keep the customer's running totals honest. */
  async function order(c: (typeof roster)[number], at: Date, status: OrderStatus, promo = "") {
    const area = (c.lastPostcode.startsWith("SS") ? AREAS[1] : AREAS[0])!;
    const lines = basket();
    const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
    const fulfilment = rnd() < 0.72 ? "delivery" : "collection";
    const deliveryFee = fulfilment === "delivery" ? 199 : 0;
    const discount = promo ? Math.round(subtotal * 0.1) : 0;
    const total = subtotal + deliveryFee - discount;
    const done = status === "completed";

    const row = await prisma.order.create({
      data: {
        clientId, locationId: pick(locations).id, customerId: c.id, status,
        fulfilment: fulfilment as "delivery" | "collection",
        paymentMethod: rnd() < 0.66 ? "card" : "cash",
        customerName: c.name, customerPhone: c.phone, customerEmail: c.email,
        deliveryLine1: fulfilment === "delivery" ? `${between(1, 180)} ${pick(area.streets)}` : "",
        deliveryCity: fulfilment === "delivery" ? area.city : "",
        deliveryPostcode: fulfilment === "delivery" ? c.lastPostcode : "",
        subtotal, deliveryFee, discount, promoCode: promo, total,
        placedAt: at,
        acceptedAt: status === "placed" ? null : at,
        etaMinutes: fulfilment === "delivery" ? 45 : 20,
        etaAt: new Date(at.getTime() + (fulfilment === "delivery" ? 45 : 20) * 60_000),
        completedAt: done ? new Date(at.getTime() + between(22, 55) * 60_000) : null,
        createdAt: at, updatedAt: at,
        items: { create: lines },
      },
    });

    // Cancelled and rejected orders are not takings, so they do not count.
    if (status !== "cancelled" && status !== "rejected") {
      await prisma.customer.update({
        where: { id: c.id },
        data: { ordersCount: { increment: 1 }, totalSpent: { increment: total }, lastOrderAt: at },
      });
    }
    madeOrders++;
    return row;
  }

  /** Evening trade: most orders land between five and ten. */
  const eveningOn = (d: number) => {
    const t = daysAgo(d);
    t.setHours(between(16, 22), between(0, 59), 0, 0);
    return t;
  };

  for (let d = RECENT_DAYS; d >= 1; d--) {
    const dow = daysAgo(d).getDay();
    const busy = dow === 5 || dow === 6; // Friday and Saturday carry the week
    const count = busy ? between(48, 72) : between(24, 42);
    for (let n = 0; n < count; n++) {
      const c = pick(active);
      // A small number go wrong, which is normal and worth the owner seeing.
      const r = rnd();
      const status: OrderStatus = r < 0.02 ? "cancelled" : r < 0.035 ? "rejected" : "completed";
      await order(c, eveningOn(d), status);
    }
  }

  // Today. Everything before the last hour is done; the rest is still moving, so
  // the kitchen screen, the dispatch board and the tracker all have live work.
  const now = new Date();
  const finishedToday = now.getHours() >= 17 ? between(18, 34) : between(6, 14);
  for (let n = 0; n < finishedToday; n++) {
    const at = new Date(now.getTime() - between(70, 400) * 60_000);
    await order(pick(active), at, "completed");
  }
  const LIVE: OrderStatus[] = ["placed", "placed", "accepted", "preparing", "preparing", "ready", "out_for_delivery", "out_for_delivery"];
  for (const status of LIVE) {
    await order(pick(active), new Date(now.getTime() - between(2, 55) * 60_000), status);
  }

  // A campaign that already ran, so the marketing screen opens with a result on
  // it rather than four zeroes. Sends go out; a realistic slice of them convert.
  const winBack = await prisma.automation.findFirst({ where: { clientId, trigger: "win_back" } });
  let sends = 0, redemptions = 0, earned = 0;
  if (winBack) {
    const lapsed = await prisma.customer.findMany({
      where: {
        clientId, marketingOptIn: true, phone: { startsWith: PHONE_PREFIX },
        ordersCount: { gt: 0 }, lastOrderAt: { lt: daysAgo(45) },
      },
      take: 120, select: { id: true, name: true, phone: true },
      orderBy: { lastOrderAt: "asc" },
    });

    for (const c of lapsed) {
      const sentAt = daysAgo(between(34, 80));
      const send = await prisma.marketingSend.create({
        data: {
          clientId, automationId: winBack.id, customerId: c.id, channel: "sms",
          promoCode: winBack.promoCode, costPence: 4, status: "sent", sentAt,
        },
      });
      sends++;

      // ~14% come back. Each redemption is a real order carrying the code, then
      // attributed through the same path a live order takes.
      if (rnd() < 0.14) {
        const lines = basket();
        const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
        const discount = Math.round(subtotal * 0.1);
        const total = subtotal + 199 - discount;
        const when = new Date(sentAt.getTime() + between(1, 5) * 86400_000);
        const order = await prisma.order.create({
          data: {
            clientId, locationId: pick(locations).id, customerId: c.id,
            status: "completed", fulfilment: "delivery", paymentMethod: "card",
            customerName: c.name, customerPhone: c.phone,
            subtotal, deliveryFee: 199, discount, promoCode: winBack.promoCode, total,
            placedAt: when, acceptedAt: when, completedAt: when,
            createdAt: when, updatedAt: when,
            items: { create: lines },
          },
        });
        await prisma.customer.update({
          where: { id: c.id },
          data: { ordersCount: { increment: 1 }, totalSpent: { increment: total }, lastOrderAt: when },
        });
        await attribute(order.id, c.id, winBack.promoCode, total);
        redemptions++; earned += total;
        madeOrders++;
      }
      void send;
    }
    await prisma.automation.update({ where: { id: winBack.id }, data: { lastRunAt: daysAgo(34) } });
  }

  console.log(JSON.stringify({
    client: client.name, customers: madeCustomers, orders: madeOrders,
    campaign: { sends, redemptions, spentPence: sends * 4, earnedPence: earned },
  }));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
