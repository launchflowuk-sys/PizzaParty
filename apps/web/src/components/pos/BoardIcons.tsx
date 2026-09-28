/** Small source badge for the order board (POS-PLAN item 36) - kiosk/counter/phone/web/app.
 *  Inline so a shop TV on a slow connection never shows a broken image. Anything else
 *  (a marketplace order taken as collection) falls back to a generic receipt. */
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case "kiosk":
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M9 21h6M12 17v4" /></svg>;
    case "pos":
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><rect x="3" y="9" width="18" height="10" rx="2" /><path d="M7 9V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M8 14h2M14 14h2" /></svg>;
    case "phone":
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C10.5 21 3 13.5 3 6a2 2 0 0 1 2-2z" /></svg>;
    case "app":
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 18h4" /></svg>;
    case "web":
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><path d="M6 2h9l3 3v17H6z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>;
  }
}

/** Icons for the bottom sell band - kiosk / app / loyalty. Kept separate from SourceIcon
 *  above (order-source badges on cards) since these read at a larger size in the band. */
export function BandIcon({ name }: { name: "kiosk" | "app" | "gift" }) {
  switch (name) {
    case "kiosk":
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><rect x="4" y="3" width="16" height="14" rx="2" /><path d="M9 21h6M12 17v4" /></svg>;
    case "app":
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 18h4" /></svg>;
    case "gift":
      return <svg viewBox="0 0 24 24" className="bd-icon" aria-hidden="true" {...STROKE}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-6-1.5S10 8 12 8zM12 8c2-4 6-4 6-1.5S14 8 12 8z" /></svg>;
  }
}
