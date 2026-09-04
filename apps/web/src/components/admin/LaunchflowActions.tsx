"use client";
import { useState } from "react";
export function LaunchflowActions() {
  const [out, setOut] = useState("");
  async function run(action: string) {
    setOut("…");
    const r = await fetch("/api/admin/launchflow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    setOut(JSON.stringify(await r.json(), null, 2));
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button className="lf-btn lf-btn-primary" onClick={() => run("reseed")}>Reload config → DB</button>
        <button className="lf-btn lf-btn-ghost" onClick={() => run("revalidate")}>Clear menu cache</button>
        <button className="lf-btn lf-btn-ghost" onClick={() => run("test-notify")}>Test kitchen notifications</button>
        <button className="lf-btn lf-btn-ghost" onClick={() => run("review-requests")}>Run review-request job</button>
      </div>
      {out ? <pre className="lf-card p-3 mt-3 text-xs whitespace-pre-wrap">{out}</pre> : null}
    </div>
  );
}
