"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameLines } from "@/components/game-lines";
import { useApp } from "@/components/providers";
import { api, isApiError, isUnreachable } from "@/lib/api";
import { groupGames, WEEK_5_QUERY } from "@/lib/board";
import { DEMO_GAMES } from "@/lib/demo-data";
import { columnLabels } from "@/lib/format";
import type { GameBoardOut } from "@/lib/types";

export function GameBoard() {
  const { theme, apiMode, noteLive, noteDemo } = useApp();
  const skin = theme ?? "fanduel";
  const labels = columnLabels(skin);
  const [games, setGames] = useState<GameBoardOut[] | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    if (apiMode === "demo") {
      setGames(DEMO_GAMES);
      setDemo(true);
      setError(null);
      return;
    }
    setError(null);
    void (async () => {
      try {
        const listed = await api.listGames(WEEK_5_QUERY);
        if (cancel) return;
        noteLive();
        setGames(listed);
        setDemo(false);
      } catch (err) {
        if (cancel) return;
        if (isUnreachable(err)) {
          noteDemo();
          setGames(DEMO_GAMES);
          setDemo(true);
          return;
        }
        setGames([]);
        setError(isApiError(err) ? err.message : "Could not load the board.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [apiMode, noteDemo, noteLive]);

  const more = skin === "fanduel" ? "More wagers ›" : "More Bets ›";
  const groups = games ? groupGames(games) : [];

  return (
    <div className="games-board">
      {demo ? (
        <div className="demo-banner">
          <span className="demo-badge">Demo data</span>
          Odds and hit rates are illustrative, not live. Plan surfaces prop hit rates the books do not.
        </div>
      ) : null}
      <h1 className="board-title">NFL Betting Odds</h1>
      <div className="board-tabs">
        <button type="button" className="board-tab active">
          Games
        </button>
        <button type="button" className="board-tab">
          Futures
        </button>
        <button type="button" className="board-tab">
          Awards
        </button>
        <button type="button" className="board-tab">
          Player Props
        </button>
        <button type="button" className="board-tab">
          Week 5
        </button>
      </div>
      <div className="sub-tabs">
        <button type="button" className="sub-tab active">
          Game Lines
        </button>
        <button type="button" className="sub-tab">
          Passing
        </button>
        <button type="button" className="sub-tab">
          Receiving
        </button>
        <button type="button" className="sub-tab">
          Rushing
        </button>
        <button type="button" className="sub-tab">
          TD Scorers
        </button>
      </div>
      <div className="col-headers">
        <span>NFL</span>
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {games === null && !error ? <p className="loading-note">Loading odds…</p> : null}
      {error ? (
        <div className="page-card">
          <p className="error-text">{error}</p>
        </div>
      ) : null}
      {games && games.length === 0 && !error ? (
        <div className="page-card">
          <p>No week 5 games on the board.</p>
        </div>
      ) : null}
      {groups.map((group) => (
        <section key={group.label}>
          <div className="date-divider">{group.label}</div>
          <div className="date-group-header">
            <span className="dg-date">{group.label}</span>
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {group.games.map((game, index) => (
            <article key={game.id} className={index === 0 ? "game-card first-in-group" : "game-card"}>
              <GameLines game={game} linkToGame />
              <div className="game-footer">
                <span className="sgp-badge">SGP</span>
                <span className="kickoff">{game.kickoffLabel || game.kickoff}</span>
                <Link href={`/games/${game.id}`} className="more-link">
                  {more}
                </Link>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
