"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useBasket } from "./basket/store";

type Result = { ok: boolean; location?: { key: string; name: string; deliveryFee: number; minOrder: number; open: boolean; etaMinutes: number }; message?: string };

export function PostcodeCheck({ initial = "", compact = false }: { initial?: string; compact?: boolean }) {
  const setPostcodeStore = useBasket((s) => s.setPostcode);
  const setFulfilment = useBasket((s) => s.setFulfilment);
  const router = useRouter();
  const [postcode, setPostcode] = useState(initial);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/postcode/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postcode }) });
      const data = (await r.json()) as Result;
      setRes(data);
      if (data.ok && data.location) {
        setPostcodeStore(postcode.toUpperCase().trim(), data.location.key);
        setFulfilment("delivery");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="lf-input"
          placeholder="Your postcode, e.g. RM17 6QD"
          autoComplete="postal-code"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          aria-label="Postcode"
          required
        />
        <button className="lf-btn lf-btn-primary shrink-0" disabled={busy}>{compact ? "Check" : "Check delivery"}</button>
      </form>
      {res ? (
        <p className={`mt-2 text-sm ${res.ok ? "text-success" : "text-danger"}`} role="status">
          {res.ok && res.location ? (
            <>
              We deliver to you from {res.location.name}. £{(res.location.deliveryFee / 100).toFixed(2)} delivery, £{(res.location.minOrder / 100).toFixed(2)} minimum.{" "}
              <button className="underline font-semibold" onClick={() => router.push("/menu")}>Start your order</button>
            </>
          ) : (
            res.message ?? "Sorry, we don't deliver there yet. Collection is available."
          )}
        </p>
      ) : null}
    </div>
  );
}
