/** The customer display's line icons. Inline so a tablet on a slow connection never shows a broken image. */
type Name = "dine" | "bag" | "scooter" | "gift" | "chevron" | "arrow" | "plus" | "card" | "contactless" | "apple" | "google" | "cash";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function Icon({ name }: { name: Name }) {
  switch (name) {
    case "dine":
      return <svg viewBox="0 0 24 24" className="cd-icon" aria-hidden="true" {...STROKE}><path d="M5 3v7a2 2 0 0 0 2 2v9M9 3v7a2 2 0 0 1-2 2M7 3v6M17 21V3c-2 1-3 4-3 7s1 4 3 4" /></svg>;
    case "bag":
      return <svg viewBox="0 0 24 24" className="cd-icon" aria-hidden="true" {...STROKE}><path d="M5 8h14l-1 13H6L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
    case "scooter":
      return <svg viewBox="0 0 24 24" className="cd-icon" aria-hidden="true" {...STROKE}><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M9 17h6l2-8h2M13 9h-3l-2 5M15 5h3" /></svg>;
    case "gift":
      return <svg viewBox="0 0 24 24" className="cd-icon cd-icon-gift" aria-hidden="true" {...STROKE}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-6-1.5S10 8 12 8zM12 8c2-4 6-4 6-1.5S14 8 12 8z" /></svg>;
    case "chevron":
      return <svg viewBox="0 0 24 24" className="cd-icon cd-icon-chev" aria-hidden="true" {...STROKE}><path d="M9 5l7 7-7 7" /></svg>;
    case "arrow":
      return <svg viewBox="0 0 24 24" className="cd-icon" aria-hidden="true" {...STROKE} strokeWidth={2.5}><path d="M4 12h15M13 6l6 6-6 6" /></svg>;
    case "plus":
      return <svg viewBox="0 0 24 24" className="cd-icon" aria-hidden="true" {...STROKE} strokeWidth={3}><path d="M12 5v14M5 12h14" /></svg>;
    case "card":
      return <svg viewBox="0 0 24 24" className="cd-icon cd-icon-pay" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" /><rect x="2" y="9" width="20" height="3" fill="#fff" /><rect x="5" y="14.5" width="6" height="2" rx="1" fill="#fff" /></svg>;
    case "contactless":
      return (
        <svg viewBox="0 0 24 24" className="cd-icon cd-icon-pay cd-contactless" aria-hidden="true" {...STROKE}>
          <path d="M7 8.5a5 5 0 0 1 0 7" /><path d="M10.5 6a9 9 0 0 1 0 12" /><path d="M14 3.5a13 13 0 0 1 0 17" />
        </svg>
      );
    case "apple":
      return <svg viewBox="0 0 24 24" className="cd-icon cd-icon-pay" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6-.1 0-2.5-1-2.5-3.8zM14.2 5.8c.6-.8 1.1-1.8.9-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2.1-.5 2.8-1.3z" /></svg>;
    case "google":
      return (
        <svg viewBox="0 0 24 24" className="cd-icon cd-icon-pay" aria-hidden="true">
          <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
          <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
          <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" />
          <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9z" />
        </svg>
      );
    case "cash":
      return <svg viewBox="0 0 24 24" className="cd-icon cd-icon-pay cd-icon-cash" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor" /><circle cx="12" cy="12" r="3" fill="#fff" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></svg>;
  }
}
