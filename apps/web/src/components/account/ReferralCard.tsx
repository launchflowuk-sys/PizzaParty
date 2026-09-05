"use client";
import { useState } from "react";

/**
 * The share panel.
 *
 * A referral scheme lives or dies on how little work it is to pass the code on,
 * so the link is one tap to copy and one tap to share. The reward is stated in
 * pounds rather than points, because a customer can picture five pounds off and
 * cannot picture 250 points.
 */
export function ReferralCard({
  code, link, refereeDiscount, referrerReward, minOrder, referred, earned,
}: {
  code: string;
  link: string;
  refereeDiscount: string;
  referrerReward: string;
  minOrder: string;
  referred: number;
  earned: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some in-app browsers. The link is on screen
      // and selectable, so there is nothing to apologise for.
      setCopied(false);
    }
  }

  async function share() {
    const data = { title: "Get money off", text: `Use my code ${code} for ${refereeDiscount} off your first order.`, url: link };
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share(data); return; } catch { /* dismissed */ }
    }
    void copy();
  }

  return (
    <div style={{ border: "2px solid var(--color-text)", padding: 24, display: "grid", gap: 12 }}>
      <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>
        Refer a friend
      </span>
      <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-800)", lineHeight: 1.5 }}>
        They get <strong>{refereeDiscount} off</strong> their first order. Once they order,
        you get <strong>{referrerReward} off</strong> yours. {minOrder} minimum spend on both.
      </p>

      <div style={{ border: "2px solid var(--color-divider)", padding: "10px 12px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, letterSpacing: ".04em", textAlign: "center" }}>
        {code}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={share} style={{ flex: "1 1 auto" }}>
          Share the link
        </button>
        <button type="button" className="btn btn-secondary" onClick={copy} style={{ flex: "0 0 auto" }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-700)", wordBreak: "break-all" }}>{link}</p>

      {referred > 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-neutral-800)", borderTop: "1px solid var(--color-divider)", paddingTop: 12 }}>
          {referred} {referred === 1 ? "friend has" : "friends have"} ordered on your code
          {earned > 0 ? <> &mdash; {earned} reward{earned === 1 ? "" : "s"} sent to you by text.</> : "."}
        </p>
      ) : null}
    </div>
  );
}
