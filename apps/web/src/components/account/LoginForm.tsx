"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Signing in.
 *
 * One box. Type a mobile number or the email address you order with, and the
 * code goes wherever you typed. Asking somebody to pick a channel before they
 * have typed anything is a decision they should not have to make, and "@" is
 * all the signal needed to work it out.
 *
 * Email is the free route and, for most people, the faster one - it is the
 * address already on their orders, and it does not cost the shop 4p a go.
 */
export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"who" | "code">("who");
  const [channel, setChannel] = useState<"sms" | "email">("email");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const looksLikeEmail = identifier.includes("@");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setMsg("");
    try {
      const r = await fetch("/api/account/otp/send", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const d = (await r.json()) as { error?: string; channel?: "sms" | "email"; devCode?: string };
      if (!r.ok) { setError(d.error ?? "Could not send a code just now."); return; }
      setChannel(d.channel ?? "email");
      setStage("code");
      setMsg(d.devCode
        ? `Development code: ${d.devCode}`
        : d.channel === "sms"
          ? "We have texted you a six-digit code."
          : "If we have an account for that address, the code is on its way. Check your inbox — and the spam folder, just in case.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/account/otp/verify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, code }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) { setError(d.error ?? "That code is not right."); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (stage === "who") {
    return (
      <form onSubmit={send} className="fp-login">
        <label htmlFor="identifier">Mobile number or email</label>
        {/* Always the email keyboard, never the phone pad. Switching on what
            has been typed is circular: a phone pad has no "@", so an email can
            never be started, so looksLikeEmail never becomes true, so the
            keyboard never switches - the field ends up accepting only digits
            while the label offers both. The email keyboard carries letters,
            digits and "@", so it serves a mobile number perfectly well. */}
        <input
          id="identifier"
          className="input"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="07700 900123 or you@example.com"
          value={identifier}
          onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
        />
        <p className="fp-login-hint">
          {looksLikeEmail
            ? "We will email you a six-digit code."
            : identifier.trim()
              ? "We will text you a six-digit code."
              : "Whichever you use, we send a six-digit code — no password to remember."}
        </p>
        <button className="btn btn-primary btn-block" disabled={busy || !identifier.trim()}>
          {busy ? "Sending…" : looksLikeEmail ? "Email me a code" : "Send me a code"}
        </button>
        {error ? <p className="fp-login-err" role="alert">{error}</p> : null}
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="fp-login">
      <label htmlFor="code">Six-digit code</label>
      <input
        id="code"
        className="input fp-login-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
      />
      {msg ? <p className="fp-login-hint">{msg}</p> : null}
      <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Log in"}
      </button>
      <button
        type="button"
        className="fp-login-back"
        onClick={() => { setStage("who"); setCode(""); setError(""); setMsg(""); }}
      >
        {channel === "sms" ? "Use a different number or an email instead" : "Use a different address or your mobile instead"}
      </button>
      {error ? <p className="fp-login-err" role="alert">{error}</p> : null}
    </form>
  );
}
