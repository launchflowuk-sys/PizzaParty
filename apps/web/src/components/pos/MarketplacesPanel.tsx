"use client";
import { useEffect, useState } from "react";
import type { PosMarketplaceStatus } from "@/lib/pos-phase4-types";

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

const CHANNEL_TAG: Record<string, string> = { justeat: "tag-justeat", deliveroo: "tag-deliveroo", ubereats: "tag-ubereats" };

/** Marketplaces card (POS-PLAN item 31), Cash & reports, managers only. */
export function MarketplacesPanel() {
  const [status, setStatus] = useState<PosMarketplaceStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pos/marketplaces")
      .then((r) => { if (!r.ok) throw new Error("Could not load marketplace status."); return r.json() as Promise<PosMarketplaceStatus>; })
      .then((d) => { if (!cancelled) { setStatus(d); setError(""); } })
      .catch((e: unknown) => { if (!cancelled) setError(getErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function copyWebhook(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked - the field is still selectable */ }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <span style={{ fontWeight: 800, fontSize: 17, fontFamily: "var(--font-heading)" }}>Marketplaces</span>

      {loading ? <p>Loading…</p> : null}
      {error ? <p className="fp-error">{error}</p> : null}

      {status && !status.configured ? (
        <div className="pos-osection">
          <span className="tag tag-warn">Not connected — needs a Deliverect account</span>
          <p style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
            Sign up with Deliverect, then give them the webhook URL below to route Just Eat, Deliveroo and Uber Eats orders into this queue.
          </p>
        </div>
      ) : null}

      {status ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {status.channels.map((c) => (
            <div key={c.source} className="pos-oline-top" style={{ alignItems: "center" }}>
              <span className={`tag ${CHANNEL_TAG[c.source] ?? "tag-neutral"}`}>{c.name}</span>
              <span className={`tag ${c.enabled ? "tag-ok" : "tag-neutral"}`}>{c.enabled ? "Enabled" : "Off"}</span>
              <span style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                {c.lastOrderAt ? `Last order ${new Date(c.lastOrderAt).toLocaleString("en-GB")}` : "No orders yet"}
              </span>
            </div>
          ))}

          <label className="field" style={{ marginTop: 6 }}>
            <span>Webhook URL for Deliverect</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" style={{ minHeight: 48, flex: 1 }} readOnly value={status.webhookUrl} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => copyWebhook(status.webhookUrl)}>{copied ? "Copied" : "Copy"}</button>
            </div>
          </label>
        </div>
      ) : null}
    </div>
  );
}
