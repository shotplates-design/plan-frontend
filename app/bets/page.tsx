"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { api, isApiError } from "@/lib/api";
import { formatAmerican, formatCents, formatWhen } from "@/lib/format";
import type { BetOut } from "@/lib/types";

export default function BetsPage() {
  const { user, ready } = useApp();
  const [bets, setBets] = useState<BetOut[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    let cancel = false;
    void (async () => {
      try {
        const page = await api.listBets({ limit: 50, offset: 0 });
        if (cancel) return;
        setBets(page.items);
        setTotal(page.total);
      } catch (err) {
        if (cancel) return;
        setError(isApiError(err) ? err.message : "Could not load bets.");
        setBets([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [ready, user]);

  if (!ready) return <p className="loading-note">Loading…</p>;
  if (!user) {
    return (
      <div className="page-card">
        <h1>My bets</h1>
        <p>Log in to see play-money tickets.</p>
        <Link href="/login?next=/bets" className="btn-cta auth-submit">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="board-title">My bets</h1>
      <p className="slip-note">{total} ticket{total === 1 ? "" : "s"} · play money</p>
      {error ? <p className="error-text">{error}</p> : null}
      {bets === null ? <p className="loading-note">Loading bets…</p> : null}
      {bets && bets.length === 0 ? <div className="page-card">No bets yet. Add a pick from the board.</div> : null}
      {bets?.map((bet) => (
        <article key={bet.id} className="page-card bet-card">
          <div className="bet-card-top">
            <strong className="status-pill">{bet.status}</strong>
            <span>{bet.type}</span>
            <span>{formatWhen(bet.placed_at)}</span>
          </div>
          <div className="bet-card-money">
            <span>Stake {formatCents(bet.stake_cents)}</span>
            <span>{formatAmerican(bet.odds_american)}</span>
            <span>To win {formatCents(bet.potential_payout_cents - bet.stake_cents)}</span>
            {bet.payout_cents != null ? <span>Payout {formatCents(bet.payout_cents)}</span> : null}
          </div>
          <ul className="bet-legs">
            {bet.legs.map((leg) => (
              <li key={leg.id}>
                <span>{leg.market}</span> {leg.selection_name}
                {leg.line ? ` ${leg.line}` : ""} {formatAmerican(leg.odds_american)}
                <span className="slip-note">
                  {" "}
                  {leg.game.away_abbr} @ {leg.game.home_abbr} · {leg.result}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
