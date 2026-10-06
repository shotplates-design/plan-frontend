"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers";
import { api, isApiError, isUnreachable } from "@/lib/api";
import {
  centsToDollarInput,
  dollarsToCents,
  formatAmerican,
  formatCents,
  parlayAmerican,
  profitCents,
} from "@/lib/format";
import type { SlipLeg } from "@/lib/slip";
import type { BetQuoteOut } from "@/lib/types";

type Tab = "singles" | "parlay";

function toLeg(leg: SlipLeg) {
  return {
    selection_key: leg.key,
    odds_american: leg.price,
    line: leg.line,
  };
}

export function BetSlip({ onClose }: { onClose?: () => void }) {
  const { theme, user, wallet, slip, removeLeg, setLegStake, clearLegs, apiMode, noteDemo, refreshWallet } = useApp();
  const skin = theme ?? "fanduel";
  const [tab, setTab] = useState<Tab>("singles");
  const [parlayStake, setParlayStake] = useState(1000);
  const [quotes, setQuotes] = useState<Record<string, BetQuoteOut>>({});
  const [parlayQuote, setParlayQuote] = useState<BetQuoteOut | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [acceptOdds, setAcceptOdds] = useState(false);
  const gen = useRef(0);

  const sameGame = new Set(slip.map((leg) => leg.gameId)).size < slip.length;

  useEffect(() => {
    if (!user || apiMode === "demo" || slip.length === 0) {
      setQuotes({});
      setParlayQuote(null);
      return;
    }
    const id = ++gen.current;
    const handle = setTimeout(() => {
      void (async () => {
        if (tab === "parlay") {
          if (slip.length < 2 || sameGame) {
            if (gen.current === id) setParlayQuote(null);
            return;
          }
          try {
            const quote = await api.quoteBet({
              type: "parlay",
              stake_cents: parlayStake,
              legs: slip.map(toLeg),
            });
            if (gen.current !== id) return;
            setParlayQuote(quote);
            setQuoteError(null);
          } catch (err) {
            if (gen.current !== id) return;
            setParlayQuote(null);
            if (isUnreachable(err)) noteDemo();
            else setQuoteError(isApiError(err) ? err.message : "Could not quote that parlay.");
          }
          return;
        }
        const next: Record<string, BetQuoteOut> = {};
        let network = false;
        let error: string | null = null;
        await Promise.all(
          slip.map(async (leg) => {
            try {
              next[leg.key] = await api.quoteBet({
                type: "single",
                stake_cents: leg.wagerCents,
                legs: [toLeg(leg)],
              });
            } catch (err) {
              if (isUnreachable(err)) network = true;
              else if (isApiError(err) && !error) error = err.message;
            }
          }),
        );
        if (gen.current !== id) return;
        if (network) noteDemo();
        setQuotes(next);
        setQuoteError(error);
      })();
    }, 280);
    return () => clearTimeout(handle);
  }, [user, apiMode, slip, tab, parlayStake, sameGame, noteDemo]);

  const oddsMoved =
    tab === "parlay"
      ? Boolean(parlayQuote?.any_odds_changed)
      : slip.some((leg) => quotes[leg.key]?.any_odds_changed);

  async function place() {
    if (!user) return;
    setPlacing(true);
    setFormError(null);
    setMessage(null);
    try {
      if (tab === "parlay") {
        const bet = await api.placeBet({
          type: "parlay",
          stake_cents: parlayStake,
          accept_odds_changes: acceptOdds,
          idempotency_key: crypto.randomUUID(),
          legs: slip.map(toLeg),
        });
        clearLegs(slip.map((leg) => leg.key));
        setMessage(`Parlay placed. Ticket ${bet.id.slice(0, 8)}.`);
        await refreshWallet();
        return;
      }
      const placed: string[] = [];
      const errors: string[] = [];
      for (const leg of slip) {
        if (leg.wagerCents <= 0) {
          errors.push(`${leg.desc}: enter a stake.`);
          continue;
        }
        try {
          await api.placeBet({
            type: "single",
            stake_cents: leg.wagerCents,
            accept_odds_changes: acceptOdds,
            idempotency_key: crypto.randomUUID(),
            legs: [toLeg(leg)],
          });
          placed.push(leg.key);
        } catch (err) {
          if (isApiError(err) && err.status === 409) setAcceptOdds(false);
          errors.push(`${leg.desc}: ${isApiError(err) ? err.message : "Could not place."}`);
        }
      }
      if (placed.length) {
        clearLegs(placed);
        await refreshWallet();
        setMessage(`Placed ${placed.length} bet${placed.length === 1 ? "" : "s"}.`);
      }
      if (errors.length) setFormError(errors.join(" "));
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        setFormError(err.message);
      } else {
        setFormError(isApiError(err) ? err.message : "Could not place that bet.");
      }
    } finally {
      setPlacing(false);
    }
  }

  const emptyCopy =
    skin === "draftkings"
      ? "YOUR PICKS WILL SHOW UP HERE. Select picks to see bet types."
      : "Betslip empty. Add selections to place bet.";

  const singlesStake = slip.reduce((sum, leg) => sum + leg.wagerCents, 0);
  const stakeNeeded = tab === "parlay" ? parlayStake : singlesStake;
  const shortBalance = Boolean(user && wallet && stakeNeeded > wallet.balance_cents);
  const parlayBlocked = tab === "parlay" && (slip.length < 2 || sameGame);
  const canPlace =
    Boolean(user) && apiMode !== "demo" && slip.length > 0 && !parlayBlocked && !shortBalance && !placing && (!oddsMoved || acceptOdds);

  return (
    <div className="slip-panel">
      <div className="slip-header">
        Betslip
        <span className="slip-count">{slip.length}</span>
        {onClose ? (
          <button type="button" className="slip-close" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
      <div className="slip-tabs">
        <button type="button" className={tab === "singles" ? "active" : ""} onClick={() => setTab("singles")}>
          Singles
        </button>
        <button type="button" className={tab === "parlay" ? "active" : ""} onClick={() => setTab("parlay")}>
          Parlays
        </button>
        <button type="button" disabled title="Teasers are not in the API">
          Teasers
        </button>
      </div>
      <div className="slip-body">
        {slip.length === 0 ? (
          <div className="slip-empty">
            <div className="slip-empty-icon">▣</div>
            <div>{emptyCopy}</div>
          </div>
        ) : (
          slip.map((leg) => {
            const quote = quotes[leg.key];
            const price = tab === "singles" && quote ? quote.odds_american : leg.price;
            const profit =
              tab === "singles" && quote ? quote.potential_profit_cents : profitCents(leg.wagerCents, leg.price);
            return (
              <div key={leg.key} className="slip-sel">
                <button type="button" className="slip-sel-remove" aria-label="Remove" onClick={() => removeLeg(leg.key)}>
                  ×
                </button>
                <div className="slip-sel-market">{leg.market}</div>
                <div className="slip-sel-desc">{leg.desc}</div>
                <div className="slip-sel-price">{formatAmerican(leg.price)}</div>
                {quote?.any_odds_changed ? (
                  <div className="odds-changed">Now {formatAmerican(quote.odds_american)}</div>
                ) : null}
                {tab === "singles" ? (
                  <div className="slip-wager-row">
                    <label>
                      Wager
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={centsToDollarInput(leg.wagerCents)}
                        onChange={(event) => setLegStake(leg.key, dollarsToCents(event.target.value))}
                      />
                    </label>
                    <label>
                      To Win
                      <input type="text" readOnly value={formatCents(profit)} />
                    </label>
                  </div>
                ) : (
                  <div className="slip-sel-market">Included at {formatAmerican(price)}</div>
                )}
              </div>
            );
          })
        )}
        {tab === "parlay" && slip.length > 0 ? (
          <div className="parlay-box">
            {slip.length < 2 ? <p>Add another pick to build a parlay.</p> : null}
            {sameGame && slip.length >= 2 ? (
              <p>Same-game parlays are not offered. Place those legs as singles.</p>
            ) : null}
            {slip.length >= 2 && !sameGame ? (
              <>
                <div className="slip-sel-price">
                  Parlay {formatAmerican(parlayQuote?.odds_american ?? parlayAmerican(slip.map((leg) => leg.price)))}
                </div>
                <div className="slip-wager-row">
                  <label>
                    Wager
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={centsToDollarInput(parlayStake)}
                      onChange={(event) => setParlayStake(dollarsToCents(event.target.value))}
                    />
                  </label>
                  <label>
                    To Win
                    <input
                      type="text"
                      readOnly
                      value={formatCents(
                        parlayQuote?.potential_profit_cents ??
                          profitCents(parlayStake, parlayAmerican(slip.map((leg) => leg.price))),
                      )}
                    />
                  </label>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {slip.length > 0 ? (
        <div className="slip-footer">
          {user && wallet ? (
            <div className="balance-line">
              Play balance {formatCents(wallet.balance_cents)}
              {wallet.is_play_money === false ? "" : " · play money"}
            </div>
          ) : null}
          {quoteError ? <p className="error-text">{quoteError}</p> : null}
          {formError ? <p className="error-text">{formError}</p> : null}
          {message ? (
            <p className="success-text">
              {message} <Link href="/bets">My bets</Link>
            </p>
          ) : null}
          {oddsMoved ? (
            <label className="accept-odds">
              <input type="checkbox" checked={acceptOdds} onChange={(event) => setAcceptOdds(event.target.checked)} />
              Accept odds changes
            </label>
          ) : null}
          {shortBalance ? <p className="error-text">Not enough play balance for that stake.</p> : null}
          {apiMode === "demo" ? <p className="slip-note">Demo data — connect the API to place bets.</p> : null}
          {!user ? (
            <Link href="/login" className="slip-auth-cta">
              {skin === "fanduel" ? "Log in or join to bet" : "Log In to place bet"}
            </Link>
          ) : (
            <button type="button" className="slip-auth-cta" disabled={!canPlace} onClick={() => void place()}>
              {placing ? "Placing…" : tab === "parlay" ? "Place parlay" : `Place ${slip.length === 1 ? "bet" : "bets"}`}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
