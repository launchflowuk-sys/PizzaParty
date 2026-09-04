"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const r = await fetch("/api/account/otp/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(d.error ?? "Could not send code"); return; }
    setStage("code"); setMsg(d.devCode ? `Dev code: ${d.devCode}` : "Code sent by SMS.");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const r = await fetch("/api/account/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(d.error ?? "Wrong code"); return; }
    router.refresh();
  }
  return stage === "phone" ? (
    <form onSubmit={send} className="lf-card p-4 mt-4 space-y-3">
      <div><label className="lf-label" htmlFor="phone">Mobile number</label><input id="phone" className="lf-input" type="tel" inputMode="tel" autoComplete="tel" required placeholder="07..." value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <button className="lf-btn lf-btn-primary lf-btn-block" disabled={busy}>Text me a code</button>
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
    </form>
  ) : (
    <form onSubmit={verify} className="lf-card p-4 mt-4 space-y-3">
      <div><label className="lf-label" htmlFor="code">6-digit code</label><input id="code" className="lf-input text-center text-2xl tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
      <button className="lf-btn lf-btn-primary lf-btn-block" disabled={busy || code.length !== 6}>Log in</button>
      <button type="button" className="text-sm underline text-muted" onClick={() => setStage("phone")}>Use a different number</button>
      {msg ? <p className="text-sm text-ink-soft">{msg}</p> : null}
    </form>
  );
}
