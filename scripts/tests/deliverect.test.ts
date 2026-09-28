import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import {
  DeliverectOrder, deliverectStatusFor, mapDeliverectOrder, parseChannels, type MenuIndex,
} from "../../apps/web/src/lib/deliverect-map";
import type { PricedLine } from "../../apps/web/src/lib/basket-types";
import { fulfilmentLabel } from "../../apps/web/src/lib/fulfilment";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/deliverect-order.json", import.meta.url), "utf8"));
const menu: MenuIndex = {
  products: [
    { id: "p-marg", slug: "margherita", name: "Margherita", sizes: [{ key: "ten", name: "10\"" }, { key: "twelve", name: "12\"" }],
      groups: [{ key: "crust", name: "Crust", modifiers: [{ key: "sausage", name: "Sausage crust" }] }, { key: "extra-toppings", name: "Extra toppings", modifiers: [{ key: "bacon", name: "Bacon" }] }] },
    { id: "p-gb", slug: "garlic-bread", name: "Garlic Bread", sizes: [{ key: "regular", name: "Regular" }], groups: [] },
  ],
  deals: [{ id: "d-set", slug: "set-deal", name: "Set Deal" }],
};

test("a Deliveroo order maps onto our menu at the marketplace's prices", () => {
  const m = mapDeliverectOrder(DeliverectOrder.parse(fixture), menu, parseChannels(""), "deliveroo");
  assert.equal(m.source, "deliveroo");
  assert.equal(m.externalRef, "66f7a1b2c3d4e5f600000001");
  assert.equal(m.displayId, "DR-4821");
  assert.equal(m.fulfilment, "collection", "their rider collects it");
  assert.equal(m.courier, "marketplace");
  assert.equal(fulfilmentLabel({ fulfilment: m.fulfilment, source: m.source, courier: m.courier }), "DELIVEROO · RIDER COLLECTS");
  assert.equal(m.paid, true);

  const [pizza, bread, drink] = m.lines as [PricedLine, PricedLine, PricedLine];
  assert.equal(pizza.productId, "p-marg");
  assert.equal(pizza.sizeKey, "twelve");
  assert.equal(pizza.lineTotal, 1200 + 250 + 2 * 100, "options priced in, quantity counted");
  assert.deepEqual(pizza.modifiers.map((x) => [x.groupName, x.name, x.price]), [["Crust", "Sausage crust", 250], ["Extra toppings", "Bacon", 200]]);
  assert.equal(pizza.notes, "well done");
  assert.equal(bread.productId, "p-gb", "a single-size product matches on its bare slug");
  assert.equal(bread.lineTotal, 800);
  assert.equal(drink.productId, undefined, "not on our menu: kept as free text");
  assert.equal(drink.name, "Coca-Cola 330ml");
  assert.equal(drink.lineTotal, 150);
  assert.equal(m.needsAttention, true);
  assert.match(m.problems.join(), /Coca-Cola/);

  // Their total stands; our columns still add up.
  assert.equal(m.total, 2549, "2600 food + 99 service - 150 platform promo");
  assert.equal(m.subtotal, 1650 + 800 + 150);
  assert.equal(m.subtotal + m.deliveryFee - m.discount, m.total);
  assert.equal(m.deliveryFee, 99);
  assert.equal(m.discount, 150);
  assert.deepEqual(m.basket[0], { key: "dx0", kind: "product", qty: 1, name: "Margherita 12\"", notes: "well done", product: "margherita", size: "twelve", modifiers: [{ group: "crust", modifier: "sausage" }, { group: "extra-toppings", modifier: "bacon" }] });
  assert.match(m.customer.phone, /code 123 456 789/);
});

test("own-driver delivery, cash on the door, eat-in, cancel and unknown channels", () => {
  const own = mapDeliverectOrder(DeliverectOrder.parse({ ...fixture, channel: 10, deliveryBy: "restaurant", orderIsAlreadyPaid: false, payment: { amount: 2549, type: 1 } }), menu, parseChannels(""), "deliveroo");
  assert.equal(own.source, "justeat");
  assert.equal(own.fulfilment, "delivery");
  assert.equal(own.courier, null);
  assert.equal(own.paid, false);
  assert.deepEqual(own.address, { line1: "12 High Street", line2: "", city: "Grays", postcode: "RM17 6AB" });

  const eat = mapDeliverectOrder(DeliverectOrder.parse({ ...fixture, orderType: 3, tableNumber: 7 }), menu, parseChannels(""), "deliveroo");
  assert.equal(eat.fulfilment, "eat_in");
  assert.equal(eat.tableNumber, "7");
  assert.equal(fulfilmentLabel(eat), "EAT IN · Table 7");

  assert.equal(mapDeliverectOrder(DeliverectOrder.parse({ ...fixture, status: 110 }), menu, parseChannels(""), "deliveroo").cancelled, true);

  const odd = mapDeliverectOrder(DeliverectOrder.parse({ ...fixture, channel: 999 }), menu, parseChannels("2=deliveroo,7=ubereats"), "ubereats");
  assert.equal(odd.source, "ubereats");
  assert.match(odd.problems[0] ?? "", /Unknown marketplace channel 999/);

  const cheap = mapDeliverectOrder(DeliverectOrder.parse({ ...fixture, payment: { amount: 2000, type: 0 } }), menu, parseChannels(""), "deliveroo");
  assert.equal(cheap.discount, 2600 + 99 - 2000, "a platform promo shows as discount");
});

test("channel map, status codes and the signature scheme", () => {
  assert.deepEqual(parseChannels("2=deliveroo, 7=UberEats, x=justeat, 9=nope"), { 2: "deliveroo", 7: "ubereats" });
  assert.equal(deliverectStatusFor("accepted", null), 20);
  assert.equal(deliverectStatusFor("ready", "marketplace"), 70);
  assert.equal(deliverectStatusFor("out_for_delivery", "marketplace"), null, "their rider: nothing to say");
  assert.equal(deliverectStatusFor("rejected", null), 110);
  assert.equal(deliverectStatusFor("placed", null), null);
  assert.throws(() => DeliverectOrder.parse({ ...fixture, items: [] }));
  // What the webhook route checks: hex HMAC-SHA256 of the raw body.
  const raw = JSON.stringify(fixture);
  assert.equal(createHmac("sha256", "s3cret").update(raw).digest("hex").length, 64);
});
