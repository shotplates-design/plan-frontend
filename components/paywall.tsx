"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { api, isApiError } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { FALLBACK_PACKS } from "@/lib/paywall";
import type { PackOut } from "@/lib/types";

function perTry(cents: number): string {
  if (cents >= 100) return `${formatCents(Math.round(cents))}/try`;
  const rounded = Math.round(cents * 10) / 10;
  return `${rounded}¢/try`;
}

export function PaywallModal() {
  const { paywallOpen, paywallReason, paywallPacks, closePaywall, usage, setUsage, user } = useApp();
  const [packs, setPacks] = useState<PackOut[]>(paywallPacks ?? []);
  const [freeTries, setFreeTries] = useState(usage?.free_limit ?? 10);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!paywallOpen) return;
    let cancel = false;
    setError(null);
    if (paywallPacks && paywallPacks.length) {
      setPacks(paywallPacks);
      setFallback(false);
    }
    void (async () => {
      try {
        const plans = await api.plans();
        if (cancel) return;
        setPacks(plans.packs);
        setFreeTries(plans.free_tries);
        setFallback(false);
        if (plans.usage) setUsage(plans.usage);
      } catch (err) {
        if (cancel) return;
        if (!paywallPacks?.length) {
          setPacks(FALLBACK_PACKS);
          setFallback(true);
        }
        if (isApiError(err) && err.code !== "NETWORK") setError(err.message);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [paywallOpen, paywallPacks, setUsage]);

  if (!paywallOpen) return null;

  const reasonCopy =
    paywallReason === "prop_locked"
      ? "Opening the full hit-rate split uses a try. You are out of tries for now."
      : `Accounts start with ${freeTries} free tries. One try opens a prop for the day; buying a pack adds more.`;

  async function buy(pack: PackOut) {
    setLoadingKey(pack.key);
    setError(null);
    try {
      const session = await api.checkout({ pack: pack.key });
      window.location.assign(session.checkout_url);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Checkout could not be started.");
      setLoadingKey(null);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={closePaywall}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="paywall-title">Buy more tries</h2>
          <button type="button" className="slip-sel-remove" onClick={closePaywall} aria-label="Close">
            ×
          </button>
        </div>
        <p>{reasonCopy}</p>
        {user && usage ? (
          <p className="slip-note">
            {usage.tries_remaining == null ? "Unlimited tries" : `${usage.tries_remaining} tries left`}
            {usage.free_remaining >= 0 ? ` · ${usage.free_remaining} free` : ""}
          </p>
        ) : null}
        <div className="pack-list">
          {packs.map((pack) => (
            <div key={pack.key} className="pack-card">
              <div>
                <strong>{pack.name}</strong>
                <div className="slip-note">
                  {pack.tries} tries · {formatCents(pack.unit_amount)} · {perTry(pack.price_per_try_cents)}
                  {pack.savings_pct ? ` · Save ${pack.savings_pct}%` : ""}
                </div>
              </div>
              <button type="button" className="btn-cta" disabled={loadingKey !== null} onClick={() => void buy(pack)}>
                {loadingKey === pack.key ? "Redirecting…" : "Checkout"}
              </button>
            </div>
          ))}
        </div>
        {fallback ? (
          <p className="slip-note">Showing the listed prices (30 for $3, 100 for $5). Checkout uses the live pack key.</p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
        <p className="slip-note">Stripe test mode only. Play-money bets are separate from tries.</p>
      </div>
    </div>
  );
}
