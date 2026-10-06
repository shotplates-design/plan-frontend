"use client";

import Link from "next/link";
import { EmptyOdds, OddsButton } from "@/components/odds-button";
import { useApp } from "@/components/providers";
import { marketColumns, moneyKey, spreadKey, totalKey, type MarketCol } from "@/lib/format";
import type { GameBoardOut } from "@/lib/types";
import type { SlipLeg } from "@/lib/slip";

type Row = { side: "away" | "home"; totalSide: "over" | "under"; team: GameBoardOut["away"] };

function legFor(game: GameBoardOut, col: MarketCol, row: Row): Omit<SlipLeg, "wagerCents"> | null {
  if (col === "spread") {
    const side = game.spread?.[row.side];
    if (!side) return null;
    const abbr = row.side === "away" ? game.away.abbr : game.home.abbr;
    return {
      key: spreadKey(game.id, row.side),
      gameId: game.id,
      market: "Spread",
      desc: `${abbr} ${side.line}`,
      price: side.price,
      line: side.line,
    };
  }
  if (col === "money") {
    const price = game.money?.[row.side];
    if (price == null) return null;
    return {
      key: moneyKey(game.id, row.side),
      gameId: game.id,
      market: "Moneyline",
      desc: row.side === "away" ? game.away.short : game.home.short,
      price,
      line: null,
    };
  }
  if (!game.total) return null;
  const over = row.totalSide === "over";
  const line = `${over ? "O" : "U"} ${game.total.line}`;
  return {
    key: totalKey(game.id, row.totalSide),
    gameId: game.id,
    market: "Total",
    desc: `${game.away.abbr} @ ${game.home.abbr} ${line}`,
    price: over ? game.total.over : game.total.under,
    line,
  };
}

export function GameLines({ game, linkToGame = false }: { game: GameBoardOut; linkToGame?: boolean }) {
  const { theme } = useApp();
  const skin = theme ?? "fanduel";
  const order = marketColumns(skin);
  const at = skin === "fanduel" ? "@" : "AT";
  const rows: Row[] = [
    { side: "away", totalSide: "over", team: game.away },
    { side: "home", totalSide: "under", team: game.home },
  ];

  return (
    <div className="game-rows">
      {rows.map((row, index) => (
        <div key={row.side}>
          <div className="game-team-row">
            <div className="team-cell">
              <div className="team-logo" style={{ background: row.team.color || "#334155" }}>
                {row.team.abbr}
              </div>
              {linkToGame ? (
                <Link href={`/games/${game.id}`} className="team-name">
                  {row.team.short}
                </Link>
              ) : (
                <div className="team-name">{row.team.short}</div>
              )}
            </div>
            {order.map((col) => {
              const leg = legFor(game, col, row);
              if (!leg) return <EmptyOdds key={col} />;
              return <OddsButton key={col} leg={leg} moneyOnly={col === "money"} />;
            })}
          </div>
          {index === 0 ? <div className="team-at">{at}</div> : null}
        </div>
      ))}
    </div>
  );
}
