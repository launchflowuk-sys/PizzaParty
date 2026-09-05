"use client";
import { useState } from "react";

/**
 * Joining the list from the footer.
 *
 * Deliberately a mobile number rather than an email: this is a takeaway, the
 * marketing engine sends SMS, and asking for an email here would collect
 * addresses nothing ever writes to.
 *
 * Consent is the whole point of the box, so it says what it is for, how often,
 * and how to stop, before the number is typed rather than in a line of grey
 * text underneath. Somebody who has to hunt for how to leave was not really
 * asked.
 */
export function SignupForm() {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const r = await fetch("/api/marketing/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (r.ok && d.ok) {
        setState("done");
        setMessage("You are on the list. Text STOP any time to come off it.");
      } else {
        setState("error");
        setMessage(d.error ?? "That did not go through. Try again in a moment.");
      }
    } catch {
      setState("error");
      setMessage("That did not go through. Try again in a moment.");
    }
  }

  if (state === "done") {
    return <p className="fp-signup-done" role="status">{message}</p>;
  }

  return (
    <form className="fp-signup" onSubmit={submit}>
      <label htmlFor="fp-signup-phone" className="fp-visually-hidden">Mobile number</label>
      <input
        id="fp-signup-phone"
        className="input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder="07700 900123"
        value={phone}
        onChange={(e) => { setPhone(e.target.value); if (state === "error") setState("idle"); }}
      />
      <button className="btn btn-primary" disabled={state === "sending"}>
        {state === "sending" ? "Just a second…" : "Keep me posted"}
      </button>
      {state === "error" ? <p className="fp-signup-err" role="status">{message}</p> : null}
    </form>
  );
}
