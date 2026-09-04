import "server-only";
import type { ClientConfig } from "@launchflow/config";
import { env } from "./env";
import { assetUrl, localityPath } from "./config";
import type { Menu, MenuCategory, MenuProduct } from "./menu";
import { productPath } from "./menu";

export function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export function seoVars(cfg: ClientConfig, extra: Record<string, string> = {}) {
  return { name: cfg.name, cuisine: cfg.seo.cuisine, locality: cfg.seo.locality.join(" & "), ...extra };
}

export function pageTitle(cfg: ClientConfig, page: string) {
  return fill(cfg.seo.titleTemplate, seoVars(cfg, { page }));
}

export function abs(path: string) {
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/* ---------- JSON-LD builders ---------- */

type HoursRow = { dayOfWeek: number; opens: string; closes: string };
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function openingHoursSpec(hours: HoursRow[]) {
  return hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY[h.dayOfWeek], opens: h.opens, closes: h.closes }));
}

export function restaurantJsonLd(cfg: ClientConfig, locations: { name: string; address: string; phone: string; lat: number | null; lng: number | null; hours: HoursRow[] }[]) {
  const first = locations[0];
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": abs("/#restaurant"),
    name: cfg.name,
    url: abs("/"),
    image: abs(assetUrl(cfg.brand.og)),
    logo: abs(assetUrl(cfg.brand.logo)),
    telephone: cfg.contact.phone || first?.phone || undefined,
    servesCuisine: cfg.seo.cuisine,
    priceRange: "££",
    acceptsReservations: "False",
    hasMenu: abs("/menu"),
    areaServed: cfg.seo.locality.map((l) => ({ "@type": "City", name: l })),
    address: first?.address ? { "@type": "PostalAddress", streetAddress: first.address, addressCountry: "GB" } : undefined,
    openingHoursSpecification: first ? openingHoursSpec(first.hours) : undefined,
    potentialAction: { "@type": "OrderAction", target: { "@type": "EntryPoint", urlTemplate: abs("/menu"), actionPlatform: ["http://schema.org/MobileWebPlatform", "http://schema.org/DesktopWebPlatform"] }, deliveryMethod: ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet", "http://purl.org/goodrelations/v1#DeliveryModePickUp"] },
  };
}

export function menuJsonLd(cfg: ClientConfig, menu: Menu) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": abs("/menu#menu"),
    name: `${cfg.name} menu`,
    url: abs("/menu"),
    hasMenuSection: menu.categories.map((c) => menuSectionJsonLd(c)),
  };
}

export function menuSectionJsonLd(c: MenuCategory) {
  return {
    "@type": "MenuSection",
    name: c.name,
    description: c.description || undefined,
    url: abs(`/menu/${c.slug}`),
    hasMenuItem: c.products.map((p) => menuItemJsonLd(c, p)),
  };
}

export function menuItemJsonLd(c: MenuCategory, p: MenuProduct) {
  const prices = p.sizes.map((s) => s.price / 100);
  return {
    "@type": "MenuItem",
    name: p.name,
    description: p.description || undefined,
    url: abs(productPath(c, p)),
    image: p.image ? abs(assetUrl(p.image)) : undefined,
    suitableForDiet: p.tags.includes("vegan") ? "https://schema.org/VeganDiet" : p.tags.includes("vegetarian") ? "https://schema.org/VegetarianDiet" : undefined,
    offers: p.sizes.length > 1
      ? { "@type": "AggregateOffer", priceCurrency: "GBP", lowPrice: Math.min(...prices).toFixed(2), highPrice: Math.max(...prices).toFixed(2), offerCount: p.sizes.length, availability: p.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" }
      : { "@type": "Offer", priceCurrency: "GBP", price: (prices[0] ?? 0).toFixed(2), availability: p.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" },
  };
}

export function productJsonLd(cfg: ClientConfig, c: MenuCategory, p: MenuProduct) {
  return { "@context": "https://schema.org", ...menuItemJsonLd(c, p), "@type": "Product", brand: { "@type": "Brand", name: cfg.name }, category: c.name };
}

export function localBusinessJsonLd(cfg: ClientConfig, locality: string, loc: { name: string; address: string; phone: string; lat: number | null; lng: number | null; hours: HoursRow[]; postcodePrefixes: string[] } | null) {
  return {
    "@context": "https://schema.org",
    "@type": ["Restaurant", "LocalBusiness"],
    "@id": abs(`${localityPath(cfg, locality)}#business`),
    name: `${cfg.name} ${locality}`,
    url: abs(localityPath(cfg, locality)),
    image: abs(assetUrl(cfg.brand.og)),
    telephone: loc?.phone || cfg.contact.phone || undefined,
    servesCuisine: cfg.seo.cuisine,
    priceRange: "££",
    address: loc?.address ? { "@type": "PostalAddress", streetAddress: loc.address, addressLocality: locality, addressCountry: "GB" } : { "@type": "PostalAddress", addressLocality: locality, addressCountry: "GB" },
    geo: loc?.lat && loc?.lng ? { "@type": "GeoCoordinates", latitude: loc.lat, longitude: loc.lng } : undefined,
    areaServed: [{ "@type": "City", name: locality }, ...(loc?.postcodePrefixes ?? []).map((p) => ({ "@type": "PostalCodeRangeSpecification", postalCodeBegin: p }))],
    openingHoursSpecification: loc ? openingHoursSpec(loc.hours) : undefined,
    hasMenu: abs("/menu"),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })) };
}
