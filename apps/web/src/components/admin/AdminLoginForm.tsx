"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = next.startsWith("/admin/launchflow") ? { key: v } : { password: v };
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) router.push(next); else setErr("Wrong password");
  }
  return (
    <form onSubmit={submit} className="lf-card p-4 mt-4 space-y-3">
      <input className="lf-input" type="password" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder={next.startsWith("/admin/launchflow") ? "Agency key" : "Password"} aria-label="Password" />
      <button className="lf-btn lf-btn-primary lf-btn-block">Log in</button>
      {err ? <p className="text-danger text-sm">{err}</p> : null}
    </form>
  );
}
