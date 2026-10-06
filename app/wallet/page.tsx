"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { api, isApiError } from "@/lib/api";
import { formatCents, formatWhen } from "@/lib/format";
import type { WalletTransactionOut } from "@/lib/types";

export default function WalletPage() {
  const { user, ready, wallet, refreshWallet, setUsage } = useApp();
  const [rows, setRows] = useState<WalletTransactionOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    let cancel = false;
    void (async () => {
      const sessionId = new URLSearchParams(window.location.search).get("session_id") ?? undefined;
      try {
        if (sessionId) {
          const usage = await api.usage(sessionId);
          if (cancel) return;
          setUsage(usage.usage);
          if (usage.synced_purchase) {
            setSyncNote(`Added ${usage.synced_purchase.tries} tries from ${usage.synced_purchase.pack}.`);
          }
        }
        await refreshWallet();
        const page = await api.transactions({ limit: 50, offset: 0 });
        if (cancel) return;
        setRows(page.items);
      } catch (err) {
        if (cancel) return;
        setError(isApiError(err) ? err.message : "Could not load the wallet.");
        setRows([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [ready, user, refreshWallet, setUsage]);

  if (!ready) return <p className="loading-note">Loading…</p>;
  if (!user) {
    return (
      <div className="page-card">
        <h1>Wallet</h1>
        <p>Log in to see your play-money balance.</p>
        <Link href="/login?next=/wallet" className="btn-cta auth-submit">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="board-title">Wallet</h1>
      <div className="page-card">
        <p className="wallet-balance">{wallet ? formatCents(wallet.balance_cents) : "…"}</p>
        <p className="slip-note">Play money only ({wallet?.currency || "PLAY"}). No deposits or withdrawals.</p>
        {syncNote ? <p className="success-text">{syncNote}</p> : null}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <h2 className="section-title">Transactions</h2>
      {rows === null ? <p className="loading-note">Loading transactions…</p> : null}
      {rows && rows.length === 0 ? <p className="slip-note">No ledger entries yet.</p> : null}
      {rows?.map((row) => (
        <div key={row.id} className="page-card tx-row">
          <div>
            <strong>{row.type.replaceAll("_", " ")}</strong>
            <div className="slip-note">{row.description || formatWhen(row.created_at)}</div>
          </div>
          <div className="tx-amt">
            <div>{formatCents(row.amount_cents)}</div>
            <div className="slip-note">Bal {formatCents(row.balance_after_cents)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
