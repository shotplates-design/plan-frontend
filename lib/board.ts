import { dateGroupLabel } from "@/lib/format";
import type { GameBoardOut, ListGamesQuery } from "@/lib/types";

/** The product board is the 2026 week 5 slate (Thu Oct 8 – Mon Oct 12). */
export const WEEK_5_QUERY: ListGamesQuery = {
  season: 2026,
  week: 5,
  season_type: "REG",
  include_props: true,
};

export interface GameGroup {
  label: string;
  games: GameBoardOut[];
}

export function groupGames(games: GameBoardOut[]): GameGroup[] {
  const sorted = [...games].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const groups: GameGroup[] = [];
  for (const game of sorted) {
    const label = game.dateGroup || dateGroupLabel(game.kickoff);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.games.push(game);
    else groups.push({ label, games: [game] });
  }
  return groups;
}
