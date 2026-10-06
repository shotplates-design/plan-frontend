import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { groupGames } from "@/lib/board";
import { DEMO_GAMES, demoGame } from "@/lib/demo-data";
import {
  dateGroupLabel,
  decimalToAmerican,
  formatAmerican,
  formatCents,
  marketColumns,
  parlayAmerican,
  profitCents,
  propKey,
  spreadKey,
} from "@/lib/format";
import { chipView, isWindowLocked } from "@/lib/hit-rate";
import { parseError } from "@/lib/api";

describe("hit-rate chips", () => {
  it("colors percent bands and shows hit/total", () => {
    expect(chipView({ pct: 100, hit: 4, total: 4 }, { kind: "season", locked: false, label: "Season" })).toMatchObject({
      mode: "percent",
      primary: "100%",
      secondary: "4/4",
      band: "high",
    });
    expect(chipView({ pct: 70, hit: 7, total: 10 }, { kind: "last5", locked: false, label: "Last 5" }).band).toBe("high");
    expect(chipView({ pct: 50, hit: 2, total: 4 }, { kind: "season", locked: false, label: "Season" }).band).toBe("mid");
    expect(chipView({ pct: 49, hit: 49, total: 100 }, { kind: "season", locked: false, label: "Season" }).band).toBe("low");
  });

  it("shows a dash when pct is null", () => {
    const view = chipView({ pct: null, hit: 0, total: 0 }, { kind: "season", locked: false, label: "Season" });
    expect(view.mode).toBe("dash");
    expect(view.primary).toBe("—");
    expect(view.secondary).toBe("0/0");
    expect(view.band).toBe("neutral");
  });

  it("shows vs-opponent counts in grey when the sample is under 3", () => {
    const view = chipView(
      { pct: 100, hit: 2, total: 2, label: "vs DAL '25" },
      { kind: "vs", locked: false, label: "vs Opp" },
    );
    expect(view).toMatchObject({ mode: "count", primary: "2/2", secondary: "", band: "neutral", label: "vs DAL '25" });
  });

  it("keeps a short season sample as a percent", () => {
    const view = chipView({ pct: 100, hit: 2, total: 2 }, { kind: "season", locked: false, label: "Season" });
    expect(view.mode).toBe("percent");
    expect(view.band).toBe("high");
  });

  it("locks withheld windows and hides missing ones", () => {
    expect(chipView({ pct: 80, hit: 4, total: 5 }, { kind: "season", locked: true, label: "Season" }).mode).toBe("locked");
    expect(chipView(null, { kind: "vs", locked: false, label: "vs Opp" }).mode).toBe("hidden");
    expect(isWindowLocked(["season", "vs_opponent"], "season", false)).toBe(true);
    expect(isWindowLocked(["season", "vs_opponent"], "last5", false)).toBe(false);
    expect(isWindowLocked([], "vs_opponent", false)).toBe(true);
    expect(isWindowLocked([], "last5", false)).toBe(false);
    expect(isWindowLocked(["season"], "season", true)).toBe(false);
  });
});

describe("odds and money", () => {
  it("formats American odds and play-money cents", () => {
    expect(formatAmerican(-110)).toBe("−110");
    expect(formatAmerican(150)).toBe("+150");
    expect(formatCents(300)).toBe("$3.00");
    expect(formatCents(-125)).toBe("−$1.25");
  });

  it("prices a two-leg parlay from American odds", () => {
    expect(parlayAmerican([-110, -110])).toBe(decimalToAmerican((1 + 100 / 110) ** 2));
    expect(profitCents(1000, -110)).toBe(Math.round(1000 * (1 + 100 / 110)) - 1000);
  });

  it("builds selection keys the API expects", () => {
    expect(spreadKey("tb-dal", "away")).toBe("tb-dal|spread|away");
    expect(propKey("tb-dal", "godwin-rec")).toBe("tb-dal|prop|godwin-rec");
    expect(marketColumns("fanduel")).toEqual(["spread", "money", "total"]);
    expect(marketColumns("draftkings")).toEqual(["spread", "total", "money"]);
  });
});

describe("week 5 demo slate", () => {
  it("covers the real 15-game week and groups by date", () => {
    expect(DEMO_GAMES).toHaveLength(15);
    expect(demoGame("tb-dal")?.away.abbr).toBe("TB");
    expect(demoGame("sf-sea")?.home.abbr).toBe("SEA");
    expect(demoGame("buf-lar")?.nflGameId).toBe("2026_05_BUF_LA");
    expect(demoGame("phi-jax")?.id).toBe("phi-jax");
    const cook = demoGame("buf-lar")?.props?.find((prop) => prop.id === "cook-rec2");
    expect(cook?.hitRate?.season).toMatchObject({ pct: 100, hit: 4, total: 4 });
    const groups = groupGames(DEMO_GAMES);
    expect(groups.map((group) => group.label)).toEqual(["THU OCT 8th", "SUN OCT 11th", "MON OCT 12th"]);
    expect(groups.reduce((sum, group) => sum + group.games.length, 0)).toBe(15);
    expect(dateGroupLabel("2026-10-08T20:15:00-04:00")).toBe("THU OCT 8th");
    expect(dateGroupLabel("2026-10-12T20:15:00-04:00")).toBe("MON OCT 12th");
  });
});

describe("API errors", () => {
  it("reads the documented error envelope", () => {
    const err = parseError(402, {
      error: { code: "UPGRADE_REQUIRED", message: "Out of tries", details: { reason: "out_of_tries" } },
    });
    expect(err.status).toBe(402);
    expect(err.code).toBe("UPGRADE_REQUIRED");
    expect(err.message).toBe("Out of tries");
    expect(err.details).toMatchObject({ reason: "out_of_tries" });
  });
});

describe("openapi contract", () => {
  const spec = JSON.parse(readFileSync(resolve(process.cwd(), "openapi.json"), "utf8")) as {
    paths: Record<string, unknown>;
    components: { schemas: Record<string, { enum?: string[]; required?: string[] }> };
  };

  it("includes the routes the client calls", () => {
    for (const path of [
      "/api/v1/auth/me",
      "/api/v1/auth/signup",
      "/api/v1/auth/login",
      "/api/v1/auth/logout",
      "/api/v1/users/me/preferences",
      "/api/v1/games",
      "/api/v1/games/{game_id}",
      "/api/v1/games/{game_id}/props/{prop_id}",
      "/api/v1/bets/quote",
      "/api/v1/bets",
      "/api/v1/wallet",
      "/api/v1/billing/plans",
      "/api/v1/billing/checkout-session",
    ]) {
      expect(spec.paths[path], path).toBeTruthy();
    }
  });

  it("limits bets to single and parlay and themes to the two books", () => {
    expect(spec.components.schemas.BetType.enum).toEqual(["single", "parlay"]);
    expect(spec.components.schemas.Theme.enum).toEqual(["fanduel", "draftkings"]);
    expect(spec.components.schemas.PropOut.required).toEqual(
      expect.arrayContaining(["id", "player", "line", "price", "selectionKey"]),
    );
    expect(spec.components.schemas.PropOut.required).not.toContain("book");
  });
});
