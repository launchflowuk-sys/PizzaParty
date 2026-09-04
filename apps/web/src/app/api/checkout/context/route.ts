import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getLocations } from "@/lib/menu";
import { availability, preorderSlots } from "@/lib/availability";
import { env } from "@/lib/env";
import { stripeEnabled } from "@/lib/stripe";
import { currentCustomer } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getConfig();
  const [locations, customer] = await Promise.all([getLocations(), currentCustomer()]);
  const now = new Date();
  return NextResponse.json({
    name: cfg.name,
    fulfilment: cfg.fulfilment,
    cashOnCollection: cfg.payments.cashOnCollection,
    cashOnDelivery: cfg.payments.cashOnDelivery,
    stripe: stripeEnabled() ? { publishableKey: env.stripePublishableKey, accountId: cfg.payments.stripeAccountId || null } : null,
    locations: locations.map((l) => {
      const a = availability(l, now);
      return {
        key: l.key, name: l.name, address: l.address, deliveryFee: l.deliveryFee, minOrder: l.minOrder, prepMinutes: l.prepMinutes, deliveryMinutes: l.deliveryMinutes,
        open: a.open, paused: a.paused, pausedUntil: a.pausedUntil, pauseReason: a.pauseReason, nextOpen: a.nextOpen, timezone: l.timezone,
        slots: preorderSlots(l.hours, now, l.timezone, l.prepMinutes + 15).slice(0, 96).map((d) => d.toISOString()),
      };
    }),
    customer: customer ? { name: customer.name, phone: customer.phone, email: customer.email, addresses: customer.addresses.map((a) => ({ id: a.id, line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode })) } : null,
  });
}
