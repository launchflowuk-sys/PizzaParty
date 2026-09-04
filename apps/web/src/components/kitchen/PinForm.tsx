"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PinForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/kitchen/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    if (r.ok) router.push("/kitchen"); else setErr("Wrong PIN");
  }
  return (
    <form onSubmit={submit} className="lf-card p-4 mt-4 space-y-3">
      <input className="lf-input text-center text-3xl tracking-[.5em]" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} maxLength={8} aria-label="PIN" />
      <button className="lf-btn lf-btn-primary lf-btn-block">Open kitchen</button>
      {err ? <p className="text-danger text-sm">{err}</p> : null}
    </form>
  );
}
