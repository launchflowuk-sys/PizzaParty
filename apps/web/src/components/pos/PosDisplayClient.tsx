"use client";
import { useEffect, useState } from "react";
import { gbp } from "@/lib/money";
import { POS_DISPLAY_CHANNEL, type PosDisplayMessage } from "@/lib/pos-phase4-types";
import type { PosBootstrap } from "@/lib/pos-types";
import "./pos.css";

const IDLE_AFTER_PAID_MS = 8000;
const DEFAULT_PROMO = "Ask about today's deals!";

type Screen = PosDisplayMessage;

/**
 * Customer-facing display (POS-PLAN item 29). Driven purely by BroadcastChannel
 * messages from the till - the one fetch here is just for the shop name shown
 * on the idle screen, since this window shares no React state with the till.
 */
export function PosDisplayClient() {
  const [shopName, setShopName] = useState("");
  const [screen, setScreen] = useState<Screen>({ type: "idle", shopName: "" });

  useEffect(() => {
    fetch("/api/pos/bootstrap")
      .then((r) => r.json() as Promise<PosBootstrap>)
      .then((d) => { setShopName(d.shopName); setScreen((s) => (s.type === "idle" ? { type: "idle", shopName: d.shopName } : s)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(POS_DISPLAY_CHANNEL);
    let idleTimer: number | undefined;
    ch.onmessage = (e) => {
      const msg = e.data as PosDisplayMessage;
      clearTimeout(idleTimer);
      setScreen(msg);
      if (msg.type === "paid") idleTimer = window.setTimeout(() => setScreen({ type: "idle", shopName }), IDLE_AFTER_PAID_MS);
    };
    return () => { clearTimeout(idleTimer); ch.close(); };
  }, [shopName]);

  return (
    <div className="pos-display-root">
      {screen.type === "idle" ? (
        <div className="pos-display-idle">
          <span className="pos-display-shop">{screen.shopName || shopName || "Welcome"}</span>
          <span className="pos-display-promo">{DEFAULT_PROMO}</span>
        </div>
      ) : screen.type === "basket" ? (
        <div className="pos-display-basket">
          <span className="pos-display-shop small">{screen.shopName}</span>
          <div className="pos-display-lines">
            {screen.lines.length === 0 ? <p className="pos-display-promo">{DEFAULT_PROMO}</p> : null}
            {screen.lines.map((l, i) => (
              <div key={i} className="pos-display-line">
                <span>{l.qty}× {l.name}{l.detail ? ` — ${l.detail}` : ""}</span>
                <span>{gbp(l.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="pos-display-total">
            <span>Total</span>
            <span>{gbp(screen.total)}</span>
          </div>
        </div>
      ) : screen.type === "paying" ? (
        <div className="pos-display-pay">
          {screen.method === "cash" && typeof screen.change === "number" && screen.change > 0 ? (
            <>
              <span className="pos-display-label">Change</span>
              <span className="pos-display-bignum">{gbp(screen.change)}</span>
            </>
          ) : (
            <>
              <span className="pos-display-label">Please pay</span>
              <span className="pos-display-bignum">{gbp(screen.total)}</span>
            </>
          )}
        </div>
      ) : (
        <div className="pos-display-pay">
          <span className="pos-display-label">Thank you!</span>
          <span className="pos-display-bignum">Order #{screen.orderNumber}</span>
        </div>
      )}
    </div>
  );
}
