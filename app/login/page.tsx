"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { isApiError } from "@/lib/api";

function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/games";
}

export default function LoginPage() {
  const { login } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.push(safeNext());
    } catch (err) {
      setError(isApiError(err) ? err.message : "Could not log in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="page-card auth-card" onSubmit={(event) => void onSubmit(event)}>
      <h1>Log in</h1>
      <p className="slip-note">Play-money account. No real-money deposits.</p>
      <label className="field">
        Email
        <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="field">
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" className="btn-cta auth-submit" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="slip-note">
        New here? <Link href="/signup">Join now</Link>
      </p>
    </form>
  );
}
