import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HitChips } from "@/components/hit-chips";
import type { PropOut } from "@/lib/types";

const base: PropOut = {
  id: "godwin-rec",
  player: "Chris Godwin",
  team: "TB",
  market: "Receptions",
  line: "Over 4.5",
  price: -125,
  selectionKey: "tb-dal|prop|godwin-rec",
  unlocked: true,
  locked: [],
  hitRate: {
    season: { pct: 100, hit: 4, total: 4 },
    last5: { pct: 80, hit: 4, total: 5 },
    vsOpp: { pct: 75, hit: 3, total: 4, label: "vs DAL" },
    vsOppLastSeason: { pct: 100, hit: 2, total: 2, label: "vs DAL '25" },
  },
};

describe("HitChips", () => {
  it("renders season, last 5, the API vs label, and a small-sample count", () => {
    render(<HitChips prop={base} onOpen={() => undefined} />);
    expect(screen.getByRole("button", { name: /Season 100% 4\/4/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Last 5 80% 4\/5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vs DAL 75% 3\/4/ })).toBeInTheDocument();
    const small = screen.getByRole("button", { name: /vs DAL '25 2\/2/ });
    expect(small).toHaveClass("neutral");
    expect(small).not.toHaveTextContent("%");
  });

  it("locks season and opponent windows while leaving last 5 visible", async () => {
    const onOpen = vi.fn();
    render(
      <HitChips
        prop={{
          ...base,
          unlocked: false,
          locked: ["season", "vs_opponent", "vs_opponent_last_season"],
          hitRate: { ...base.hitRate, season: null, vsOpp: null, vsOppLastSeason: null },
        }}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole("button", { name: /Last 5 80% 4\/5/ })).toBeInTheDocument();
    const locked = screen.getByRole("button", { name: "Season locked" });
    expect(locked).toHaveClass("locked");
    fireEvent.click(locked);
    expect(onOpen).toHaveBeenCalledWith("godwin-rec");
  });
});
