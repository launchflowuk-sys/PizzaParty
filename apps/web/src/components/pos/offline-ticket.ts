/**
 * The kitchen still needs a ticket when an order was taken offline (POS-PLAN
 * item 30). Opens a small popup window with a plain-text-style receipt and
 * calls print() on it - no dependency on components/print (owned elsewhere),
 * and nothing offline-specific to keep in sync with the real receipt.
 */
import type { OfflinePriced } from "./offline-pricing";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function printOfflineTicket(shopName: string, orderLabel: string, priced: OfflinePriced, note: string): void {
  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  const rows = priced.lines
    .map((l) => `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${l.qty}&times; ${escapeHtml(l.name)}</span><span>£${(l.lineTotal / 100).toFixed(2)}</span></div>`)
    .join("");
  win.document.write(`<!doctype html><html><head><title>Offline ticket</title></head>
    <body style="font-family:monospace;padding:16px;max-width:340px;">
      <h2 style="margin:0 0 8px;">OFFLINE TICKET</h2>
      <p style="margin:0 0 8px;">${escapeHtml(shopName)} &middot; ${escapeHtml(orderLabel)}</p>
      <hr/>${rows}<hr/>
      <div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:6px;"><span>Total</span><span>£${(priced.total / 100).toFixed(2)}</span></div>
      ${note ? `<p style="margin-top:10px;">${escapeHtml(note)}</p>` : ""}
      <p style="margin-top:16px;font-size:11px;">Saved offline - not yet on the server.</p>
      <script>window.onload = function () { window.print(); };</script>
    </body></html>`);
  win.document.close();
}
