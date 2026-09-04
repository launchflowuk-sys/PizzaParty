import type { Metadata } from "next";
import Link from "next/link";
import { getConfig } from "@/lib/config";
import { getLocations } from "@/lib/menu";
import { availability, formatHours, formatTime } from "@/lib/availability";
import { pageTitle, restaurantJsonLd } from "@/lib/seo";
import { gbp } from "@/lib/money";
import { JsonLd } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  return {
    title: { absolute: pageTitle(cfg, "Our shops") },
    description: `${cfg.name} shop addresses, opening hours and phone numbers in ${cfg.seo.locality.join(" & ")}.`,
    alternates: { canonical: "/shops" },
  };
}

/** Shops screen from `Farm Pizza.dc.html`: a ruled list of shops on the left and the
 *  selected shop's details on the right. The prototype's map is a placeholder there
 *  too - a real map needs a provider key, so the placeholder is kept deliberately. */
export default async function ShopsPage() {
  const cfg = getConfig();
  const locations = await getLocations();
  const now = new Date();

  return (
    <section className="fp-wrap" style={{ padding: "40px 32px 64px" }}>
      <JsonLd data={restaurantJsonLd(cfg, locations)} />
      <span className="fp-kicker" style={{ marginBottom: 12 }}>Shops</span>
      <h1 className="fp-h1" style={{ marginBottom: 28 }}>
        {locations.length === 1 ? "One shop in Essex." : `${locations.length} shops in Essex.`}
      </h1>

      <div className="fp-split-shops">
        <div style={{ borderTop: "2px solid var(--color-divider)" }}>
          {locations.map((l) => {
            const a = availability(l);
            const closes = a.closesAt ? formatTime(a.closesAt, l.timezone) : "";
            return (
              <div key={l.id} style={{ padding: "20px 16px", borderBottom: "2px solid var(--color-divider)", display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, letterSpacing: "-.015em" }}>{l.name}</span>
                  <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{gbp(l.deliveryFee)} delivery</span>
                </div>
                <div style={{ fontSize: 14 }}>{l.address}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
                  <span className={a.open ? "tag tag-accent" : "tag tag-neutral"}>
                    {a.open ? `Open${closes ? ` · closes ${closes}` : ""}` : "Closed"}
                  </span>
                  <span className="tag tag-neutral">Collection ~{l.prepMinutes} min</span>
                  <span style={{ color: "var(--color-neutral-700)" }}>Delivery ~{l.deliveryMinutes} min</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <Link href="/menu" className="btn btn-primary">Order from here</Link>
                  {l.phone ? <a href={`tel:${l.phone.replace(/\s+/g, "")}`} className="btn btn-secondary">{l.phone}</a> : null}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <div
            style={{
              height: 320, border: "2px solid var(--color-text)", position: "relative",
              background:
                "repeating-linear-gradient(0deg,transparent 0 39px,var(--color-neutral-300) 39px 40px)," +
                "repeating-linear-gradient(90deg,transparent 0 39px,var(--color-neutral-300) 39px 40px)," +
                "var(--color-surface)",
            }}
          >
            <span style={{ position: "absolute", left: 12, top: 12, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, color: "var(--color-neutral-700)" }}>
              map · {cfg.seo.locality.join(" · ").toLowerCase()} · placeholder
            </span>
            {locations.map((l, i) => {
              const x = `${18 + i * 32}%`;
              const y = `${34 + (i % 2) * 26}%`;
              return (
                <span key={l.id}>
                  <span style={{ position: "absolute", width: 14, height: 14, left: x, top: y, background: i === 0 ? "var(--color-accent)" : "var(--color-text)", animation: i === 0 ? "fp-pulse 1.4s ease-in-out infinite" : undefined }} />
                  <span style={{ position: "absolute", fontSize: 12, fontWeight: 600, left: `calc(${x} + 22px)`, top: `calc(${y} - 3px)` }}>{l.name}</span>
                </span>
              );
            })}
          </div>

          <div className="fp-shopdetails">
            {locations.map((l) => (
              <div key={l.id} style={{ fontSize: 14 }}>
                <span className="fp-kicker" style={{ marginBottom: 10 }}>{l.name} shop</span>
                <div style={{ borderTop: "2px solid var(--color-divider)" }}>
                  {[
                    ["Phone", l.phone || "—"],
                    ["Address", l.address || "—"],
                    ["Delivery", `${gbp(l.deliveryFee)} · ${gbp(l.minOrder)} minimum`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--color-divider)" }}>
                      <span style={{ color: "var(--color-neutral-700)" }}>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                  {formatHours(l.hours).map((h) => (
                    <div key={h.day} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--color-divider)" }}>
                      <span style={{ color: "var(--color-neutral-700)" }}>{h.day.slice(0, 3)}</span>
                      <span>{h.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--color-neutral-700)", marginTop: 16 }}>
            Times shown are for {new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(now)}.
          </p>
        </div>
      </div>
    </section>
  );
}
