import type { Metadata } from "next";
import { getConfig } from "@/lib/config";
import { getLocations } from "@/lib/menu";
import { availability, formatHours } from "@/lib/availability";
import { pageTitle } from "@/lib/seo";
import { OpenPill } from "@/components/OpenPill";

export const dynamic = "force-dynamic";
export function generateMetadata(): Metadata { const cfg = getConfig(); return { title: { absolute: pageTitle(cfg, "Contact & Opening Hours") }, alternates: { canonical: "/contact" } }; }

export default async function ContactPage() {
  const cfg = getConfig();
  const locations = await getLocations();
  return (
    <div className="lf-container max-w-3xl">
      <h1 className="lf-h1 pt-8">Contact & opening hours</h1>
      {cfg.contact.phone ? <p className="mt-3">Call us: <a className="text-brand font-semibold" href={`tel:${cfg.contact.phone.replace(/\s+/g, "")}`}>{cfg.contact.phone}</a></p> : null}
      {cfg.contact.email ? <p className="mt-1">Email: <a className="text-brand font-semibold" href={`mailto:${cfg.contact.email}`}>{cfg.contact.email}</a></p> : null}
      <div className="grid gap-4 mt-6 sm:grid-cols-2">
        {locations.map((l) => (
          <div key={l.id} className="lf-card p-5">
            <h2 className="text-lg font-extrabold">{l.name}</h2>
            <div className="mt-2"><OpenPill a={availability(l)} tz={l.timezone} /></div>
            {l.address ? <p className="text-muted mt-2">{l.address}</p> : null}
            {l.phone ? <a className="block mt-1 text-brand font-semibold" href={`tel:${l.phone.replace(/\s+/g, "")}`}>{l.phone}</a> : null}
            <table className="mt-3 text-sm w-full"><tbody>{formatHours(l.hours).map((h) => <tr key={h.day}><td className="py-0.5 font-semibold">{h.day}</td><td className="py-0.5 text-right">{h.text}</td></tr>)}</tbody></table>
            <p className="text-xs text-muted mt-3">Delivers to {l.postcodePrefixes.join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
