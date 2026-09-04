"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One field, two credentials. A 4-8 digit entry is tried as a staff PIN so the person
 * gets their own role; anything else is the shop's shared password. The agency key has
 * its own path when arriving at /admin/launchflow.
 */
export function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isAgency = next.startsWith("/admin/launchflow");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const value = v.trim();
    const body = isAgency ? { key: value } : /^\d{4,8}$/.test(value) ? { pin: value } : { password: value };
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) { router.push(next); router.refresh(); }
      else setErr(isAgency ? "Wrong agency key" : "Wrong password or PIN");
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 380, marginTop: 24 }}>
      <div className="field">
        <label htmlFor="cred">{isAgency ? "Agency key" : "Password or staff PIN"}</label>
        <input
          id="cred" className="input" type="password" autoFocus
          inputMode={isAgency ? "text" : "numeric"}
          value={v} onChange={(e) => setV(e.target.value)}
          placeholder={isAgency ? "Agency key" : "Password or PIN"}
        />
      </div>
      <button className="btn btn-primary btn-block" disabled={busy || !v.trim()}>
        {busy ? "Checking…" : "Log in"}
      </button>
      {err ? <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--color-accent-700)" }}>{err}</p> : null}
      {!isAgency ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--color-neutral-600)", lineHeight: 1.5 }}>
          Staff sign in with their own PIN, which decides what they can reach. The shop
          password gives full manager access.
        </p>
      ) : null}
    </form>
  );
}
