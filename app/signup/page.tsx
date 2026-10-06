"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { isApiError } from "@/lib/api";

export default function SignupPage() {
  const { signup } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signup({ email: email.trim(), password, displayName });
      router.push("/games");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Could not create the account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="page-card auth-card" onSubmit={(event) => void onSubmit(event)}>
      <h1>Join Plan</h1>
      <p className="slip-note">Creates a play-money wallet. Your sportsbook skin is saved with the account.</p>
      <label className="field">
        Email
        <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="field">
        Display name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} />
      </label>
      <label className="field">
        Password
        <input
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" className="btn-cta auth-submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="slip-note">
        Already joined? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}
