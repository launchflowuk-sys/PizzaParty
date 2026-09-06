import { NextResponse } from "next/server";
import { getConfig, assetUrl } from "@/lib/config";
import { getLocations } from "@/lib/menu";
import { availability } from "@/lib/availability";
import { stripeEnabled } from "@/lib/stripe";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * What the app needs to know before it can draw anything.
 *
 * Fetched once on launch. Everything here is public - it is all on the website
 * already - so there is no auth and it can be cached.
 *
 * `minSupportedVersion` ships from day one even though nothing is below it
 * yet. It is the only lever there will ever be over a customer who never
 * updates: when an endpoint has to change shape, an app built before that
 * change has no other way of being told to stop. Adding the field later means
 * the versions that most need it are exactly the ones that cannot read it.
 */
export async function GET() {
  const cfg = getConfig();
  const locations = await getLocations();

  return NextResponse.json({
    shop: {
      name: cfg.name,
      phone: cfg.contact.phone ?? "",
      email: cfg.contact.email ?? "",
      address: cfg.contact.address ?? "",
      logo: assetUrl(cfg.brand.logo),
      primary: cfg.brand.primary,
      reviewUrl: cfg.contact.reviewUrl ?? "",
    },
    fulfilment: cfg.fulfilment,
    payments: {
      // So the app can hide a card button that would only fail.
      card: stripeEnabled(),
      cashOnCollection: cfg.payments.cashOnCollection,
      cashOnDelivery: cfg.payments.cashOnDelivery,
    },
    loyalty: {
      enabled: cfg.loyalty.enabled,
      pointsPerPound: cfg.loyalty.pointsPerPound,
      name: "Crust Club",
    },
    referral: cfg.referral,
    branches: locations.map((l) => {
      // Reuse the same calculation the website's open/closed pill uses, rather
      // than shipping opening-hours arithmetic to the app and letting the two
      // disagree about whether the shop is taking orders.
      const state = availability(l);
      return {
      key: l.key,
      name: l.name,
      address: l.address ?? "",
      phone: l.phone ?? "",
      lat: l.lat, lng: l.lng,
      timezone: l.timezone,
      deliveryMinutes: l.deliveryMinutes,
      prepMinutes: l.prepMinutes,
      deliveryFee: l.deliveryFee,
      minOrder: l.minOrder,
      open: state.open,
      paused: state.paused,
      pausedUntil: state.pausedUntil?.toISOString() ?? null,
      pauseReason: state.pauseReason,
      nextOpen: state.nextOpen?.toISOString() ?? null,
      closesAt: state.closesAt?.toISOString() ?? null,
      todayHours: state.todayHours.map((h) => ({ opens: h.opens, closes: h.closes })),
    };
    }),
    /** Below this, the app must refuse to run and tell the customer to update. */
    minSupportedVersion: "1.0.0",
    /** Shown as a banner when non-empty. For maintenance, or a forced update. */
    message: "",
    siteUrl: env.siteUrl,
  }, {
    headers: { "cache-control": "public, max-age=60" },
  });
}
