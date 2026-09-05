import "server-only";
import { getConfig, assetUrl } from "@/lib/config";
import { env } from "@/lib/env";

/**
 * The bits every email is built from.
 *
 * Email is not the web. There is no flexbox, no grid, no external stylesheet
 * and no web font that can be relied on; Outlook still renders through Word.
 * So: tables with `role="presentation"`, every style inline, one 600px column,
 * and a system font stack. This file exists so that is written once and the
 * templates never have to think about it again.
 *
 * Images are absolute URLs against the live site, because a mail client has no
 * idea what our origin is. They are also always accompanied by text - a good
 * half of recipients see images blocked until they click, and an email whose
 * meaning depends on a picture says nothing to them.
 */

const WIDTH = 600;

/** Never a web font. A missing web font in Outlook falls back to Times. */
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type Brand = {
  name: string;
  logoUrl: string;
  primary: string;
  onPrimary: string;
  siteUrl: string;
  address: string;
  phone: string;
  reviewUrl: string;
};

export function brand(): Brand {
  const cfg = getConfig();
  return {
    name: cfg.name,
    logoUrl: abs(assetUrl(cfg.brand.logo)),
    primary: cfg.brand.primary || "#C0301B",
    onPrimary: "#ffffff",
    siteUrl: env.siteUrl,
    address: cfg.contact.address || "",
    phone: cfg.contact.phone || "",
    reviewUrl: cfg.contact.reviewUrl || "",
  };
}

/** Mail clients cannot resolve a root-relative path. */
export function abs(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${env.siteUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/* ────────────────────────────── components ────────────────────────────── */

/**
 * A button that survives Outlook.
 *
 * A padded `<a>` collapses to a text link in Word's renderer, so the padding
 * lives on a table cell and the anchor fills it. Ugly, and the only thing that
 * works everywhere.
 */
export function button(label: string, href: string, b: Brand): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px"><tr>
    <td bgcolor="${b.primary}" style="border-radius:6px" align="center">
      <a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:16px;font-weight:700;color:${b.onPrimary};text-decoration:none;border-radius:6px">${esc(label)}</a>
    </td></tr></table>`;
}

/** A heading and some prose. The workhorse. */
export function say(heading: string, body: string): string {
  return `<h1 style="margin:0 0 10px;font-family:${FONT};font-size:26px;line-height:1.2;font-weight:700;color:#1a1a1a">${esc(heading)}</h1>
    <p style="margin:0 0 18px;font-family:${FONT};font-size:16px;line-height:1.55;color:#444">${body}</p>`;
}

/**
 * Where the order has got to.
 *
 * Five boxes, the ones already passed filled in. This is the thing people
 * actually open the email for - it answers "where is my food" without them
 * having to click anything, which is the whole point of sending it.
 */
export function tracker(step: number, collection: boolean, b: Brand): string {
  const steps = collection
    ? ["Placed", "Accepted", "Preparing", "Ready", "Collected"]
    : ["Placed", "Accepted", "Preparing", "On its way", "Delivered"];
  const cells = steps.map((label, i) => {
    const done = i <= step;
    return `<td width="20%" align="center" style="padding:0 2px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td height="6" bgcolor="${done ? b.primary : "#e2e2e2"}" style="border-radius:3px;font-size:0;line-height:0">&nbsp;</td>
      </tr></table>
      <div style="font-family:${FONT};font-size:11px;line-height:1.3;padding-top:7px;color:${done ? "#1a1a1a" : "#9a9a9a"};font-weight:${done ? "700" : "400"}">${esc(label)}</div>
    </td>`;
  }).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 24px"><tr>${cells}</tr></table>`;
}

export type Line = {
  qty: number;
  name: string;
  sizeName?: string;
  modifiers?: string[];
  components?: string[];
  notes?: string;
  total: number;
  image?: string;
};

/** The order itself, with a photograph against each line. */
export function lines(items: Line[]): string {
  const rows = items.map((i) => {
    const img = i.image
      ? `<img src="${esc(abs(i.image))}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:6px;object-fit:cover;border:0">`
      : `<div style="width:56px;height:56px;border-radius:6px;background:#f0efec"></div>`;
    const detail = [
      i.sizeName || "",
      ...(i.modifiers ?? []),
    ].filter(Boolean).join(" · ");
    const comps = (i.components ?? []).map((c) => `<div style="font-family:${FONT};font-size:13px;color:#777;line-height:1.5">+ ${esc(c)}</div>`).join("");
    return `<tr>
      <td width="56" valign="top" style="padding:14px 14px 14px 0">${img}</td>
      <td valign="top" style="padding:14px 0;font-family:${FONT}">
        <div style="font-size:15px;font-weight:600;color:#1a1a1a;line-height:1.35">${i.qty} × ${esc(i.name)}</div>
        ${detail ? `<div style="font-size:13px;color:#777;line-height:1.5;padding-top:2px">${esc(detail)}</div>` : ""}
        ${comps}
        ${i.notes ? `<div style="font-size:13px;color:#8A5A12;line-height:1.5;padding-top:3px">Note: ${esc(i.notes)}</div>` : ""}
      </td>
      <td valign="top" align="right" style="padding:14px 0;font-family:${FONT};font-size:15px;font-weight:600;color:#1a1a1a;white-space:nowrap">${gbp(i.total)}</td>
    </tr>`;
  }).join(`<tr><td colspan="3" style="border-top:1px solid #ececec;font-size:0;line-height:0">&nbsp;</td></tr>`);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>`;
}

export function totals(rows: { label: string; value: string; strong?: boolean }[]): string {
  const body = rows.map((r) => `<tr>
    <td style="font-family:${FONT};font-size:${r.strong ? "18px" : "14px"};font-weight:${r.strong ? "700" : "400"};color:${r.strong ? "#1a1a1a" : "#666"};padding:${r.strong ? "10px 0 0" : "3px 0"}">${esc(r.label)}</td>
    <td align="right" style="font-family:${FONT};font-size:${r.strong ? "18px" : "14px"};font-weight:${r.strong ? "700" : "400"};color:${r.strong ? "#1a1a1a" : "#666"};padding:${r.strong ? "10px 0 0" : "3px 0"};white-space:nowrap">${esc(r.value)}</td>
  </tr>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:2px solid #1a1a1a;margin-top:6px;padding-top:8px">${body}</table>`;
}

/** A boxed aside: the delivery address, a refusal reason, a refund amount. */
export function panel(title: string, body: string, tone: "plain" | "warn" | "good" = "plain"): string {
  const bg = tone === "warn" ? "#FBF1DF" : tone === "good" ? "#EFF4F0" : "#F7F6F3";
  const line = tone === "warn" ? "#E4C88E" : tone === "good" ? "#B4CDBC" : "#e6e4df";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0">
    <tr><td bgcolor="${bg}" style="border:1px solid ${line};border-radius:6px;padding:16px 18px;font-family:${FONT}">
      <div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#8a8a8a;font-weight:700;padding-bottom:5px">${esc(title)}</div>
      <div style="font-size:15px;line-height:1.55;color:#1a1a1a">${body}</div>
    </td></tr></table>`;
}

/** Five stars, each linking straight out to the review page. */
export function stars(b: Brand): string {
  if (!b.reviewUrl) return "";
  const one = (n: number) => `<a href="${esc(b.reviewUrl)}" style="text-decoration:none;font-size:30px;line-height:1;color:${b.primary};padding:0 3px" aria-label="${n} star${n > 1 ? "s" : ""}">&#9733;</a>`;
  return `<div style="text-align:center;padding:6px 0 14px">${[1, 2, 3, 4, 5].map(one).join("")}</div>`;
}

/* ──────────────────────────────── the shell ──────────────────────────────── */

/**
 * Wrap content in the shop's own chrome.
 *
 * `preheader` is the grey line a phone shows next to the subject in the inbox
 * list. Left unset, clients scrape the first text they find, which here would
 * be the logo's alt text - so it is always given explicitly and then hidden.
 */
export function shell(opts: { preheader: string; content: string; b: Brand; unsubscribe?: string }): string {
  const { b, content, preheader } = opts;
  const year = new Date().getFullYear();

  const foot = [
    b.address ? esc(b.address) : "",
    b.phone ? `<a href="tel:${esc(b.phone.replace(/\s+/g, ""))}" style="color:#666;text-decoration:none">${esc(b.phone)}</a>` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const nav: [string, string][] = [
    ["Menu", `${b.siteUrl}/menu`],
    ["Deals", `${b.siteUrl}/deals`],
    ["My account", `${b.siteUrl}/account`],
    ["Contact", `${b.siteUrl}/contact`],
  ];
  const navHtml = nav.map(([l, h]) => `<a href="${esc(h)}" style="color:#666;text-decoration:none;padding:0 8px">${esc(l)}</a>`).join("");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(b.name)}</title>
</head>
<body style="margin:0;padding:0;background:#f0efec;-webkit-font-smoothing:antialiased">
<div style="display:none;font-size:1px;color:#f0efec;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${esc(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f0efec"><tr><td align="center" style="padding:24px 12px">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${WIDTH}" style="width:100%;max-width:${WIDTH}px">

    <tr><td bgcolor="${b.primary}" align="center" style="padding:22px 24px;border-radius:8px 8px 0 0">
      ${b.logoUrl
        ? `<img src="${esc(b.logoUrl)}" width="72" height="72" alt="${esc(b.name)}" style="display:block;border:0;width:72px;height:72px;border-radius:50%;background:#fff">`
        : `<div style="font-family:${FONT};font-size:22px;font-weight:800;color:${b.onPrimary};letter-spacing:-.01em">${esc(b.name.toUpperCase())}</div>`}
    </td></tr>

    <tr><td bgcolor="#ffffff" style="padding:30px 28px">${content}</td></tr>

    <tr><td bgcolor="#ffffff" align="center" style="padding:0 28px 26px;border-radius:0 0 8px 8px">
      <div style="border-top:1px solid #ececec;padding-top:18px;font-family:${FONT};font-size:13px;line-height:1.7;color:#666">
        <div style="padding-bottom:8px">${navHtml}</div>
        ${foot ? `<div>${foot}</div>` : ""}
        <div style="padding-top:10px;color:#999;font-size:12px">© ${year} ${esc(b.name)}. Prices include VAT.</div>
        ${opts.unsubscribe ? `<div style="padding-top:8px;font-size:12px"><a href="${esc(opts.unsubscribe)}" style="color:#999">Stop these emails</a></div>` : ""}
      </div>
    </td></tr>

  </table>

</td></tr></table>
</body></html>`;
}
