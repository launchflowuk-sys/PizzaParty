"use client";
import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useBasket } from "@/components/basket/store";
import { gbp } from "@/lib/money";

export function PayStep({ publishableKey, accountId, clientSecret, orderId, total, onBack }: { publishableKey: string; accountId: string | null; clientSecret: string; orderId: string; total: number; onBack: () => void }) {
  const stripePromise = useMemo(() => loadStripe(publishableKey, accountId ? { stripeAccount: accountId } : undefined), [publishableKey, accountId]);
  const brand = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--brand-primary").trim() : "";
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: brand || "#C8322B", borderRadius: "10px", fontFamily: "Inter, system-ui, sans-serif" } }, loader: "auto" }}>
      <PayForm orderId={orderId} total={total} onBack={onBack} />
    </Elements>
  );
}

function PayForm({ orderId, total, onBack }: { orderId: string; total: number; onBack: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const clear = useBasket((s) => s.clear);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const returnUrl = `${window.location.origin}/order/${orderId}?paid=1`;

  async function confirm() {
    if (!stripe || !elements) return;
    setBusy(true); setError("");
    const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    if (error) { setError(error.message ?? "Payment failed"); setBusy(false); return; }
    clear();
    window.location.assign(returnUrl);
  }

  return (
    <section className="lf-card p-4 space-y-4">
      <p className="font-bold">Pay {gbp(total)}</p>
      <ExpressCheckoutElement
        options={{ buttonType: { applePay: "order", googlePay: "order" }, buttonHeight: 48, layout: { maxColumns: 1, overflow: "never" } }}
        onConfirm={confirm}
        onReady={({ availablePaymentMethods }) => { if (!availablePaymentMethods) setShowCard(true); }}
      />
      {!showCard ? <button className="text-sm underline text-muted" onClick={() => setShowCard(true)}>Pay with card instead</button> : null}
      {showCard ? (
        <>
          <PaymentElement options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }} />
          <button className="lf-btn lf-btn-primary lf-btn-block" disabled={!stripe || busy} onClick={confirm}>{busy ? "Processing…" : `Pay ${gbp(total)}`}</button>
        </>
      ) : null}
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <button className="text-sm underline text-muted" onClick={onBack}>Back</button>
    </section>
  );
}
