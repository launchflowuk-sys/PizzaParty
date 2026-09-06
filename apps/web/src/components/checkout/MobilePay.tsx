"use client";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { gbp } from "@/lib/money";

/**
 * The card form the app shows.
 *
 * Deliberately not the website's checkout: no header, no basket, no way to
 * navigate anywhere. Somebody is three taps into paying and the only two
 * outcomes this page offers are "paid" and "went back to the app".
 */
export function MobilePay({
  orderId, number, clientSecret, publishableKey, accountId, total, brand, done,
}: {
  orderId: string; number: number; clientSecret: string; publishableKey: string;
  accountId: string | null; total: number; brand: string; done?: boolean;
}) {
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey, accountId ? { stripeAccount: accountId } : undefined) : null),
    [publishableKey, accountId],
  );

  // Nothing to pay. Hand straight back to the app.
  useEffect(() => {
    if (done) window.location.replace(`farmpizza://order/${orderId}`);
  }, [done, orderId]);

  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "24px 16px 64px", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <p style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#6b6560", margin: 0 }}>
        Order #{number}
      </p>
      <h1 style={{ fontSize: 28, margin: "4px 0 20px", color: "#1C1A17" }}>Pay {gbp(total)}</h1>

      {done || !stripePromise ? (
        <p style={{ color: "#6b6560" }}>Taking you back to the app…</p>
      ) : (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: "stripe", variables: { colorPrimary: brand || "#C82323", borderRadius: "10px" } },
            loader: "auto",
          }}
        >
          <Form orderId={orderId} total={total} />
        </Elements>
      )}
    </main>
  );
}

function Form({ orderId, total }: { orderId: string; total: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * Where Stripe sends a card that needed a bank's 3-D Secure page.
   *
   * It has to be an https URL - a custom scheme is refused - so it points back
   * at this route, which will find the payment already succeeded and bounce to
   * the app itself.
   */
  const returnUrl = typeof window !== "undefined" ? `${window.location.origin}/pay/${orderId}` : "";

  async function confirm() {
    if (!stripe || !elements) return;
    setBusy(true); setError("");
    const r = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    if (r.error) { setError(r.error.message ?? "That payment did not go through."); setBusy(false); return; }
    window.location.replace(`farmpizza://order/${orderId}`);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ExpressCheckoutElement
        options={{ buttonType: { applePay: "order", googlePay: "order" }, buttonHeight: 48, layout: { maxColumns: 1, overflow: "never" } }}
        onConfirm={confirm}
      />
      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }} />
      <button
        onClick={confirm}
        disabled={!stripe || busy}
        style={{
          width: "100%", minHeight: 52, borderRadius: 10, border: 0, cursor: "pointer",
          background: busy ? "#9a958f" : "#0F7A3D", color: "#fff", fontSize: 17, fontWeight: 700,
        }}
      >
        {busy ? "Processing…" : `Pay ${gbp(total)}`}
      </button>
      {error ? <p role="alert" style={{ color: "#B3261E", fontSize: 14, margin: 0 }}>{error}</p> : null}
      <a href={`farmpizza://order/${orderId}`} style={{ color: "#6b6560", fontSize: 14, textAlign: "center" }}>
        Cancel and go back
      </a>
    </div>
  );
}
