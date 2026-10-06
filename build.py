#!/usr/bin/env python3
"""Build static Plan NFL stats site — custom mobile-first UI (no Bootstrap)."""

from __future__ import annotations

import csv
import json
import math
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = Path("/workspace/plan-nfl-data")
SEASON_CSV = DATA / "player_season_stats_2026_offense_props.csv"
GAME_CSV = DATA / "player_game_stats_2026_offense_props.csv"
PLAYERS_CSV = DATA / "players_active.csv"
MATCHUPS_CSV = DATA / "week5_2026_matchups.csv"

OFFENSE_POSITIONS = {"QB", "RB", "WR", "TE", "FB"}
SEASON_THROUGH_WEEK = 4
SEASON_YEAR = 2026
MATCHUP_WEEK = 5

THRESHOLDS = {
    "receptions": [1, 2, 3, 4, 5],
    "receiving_yards": [10, 20, 30, 40, 50, 60, 70, 80, 100],
    "rushing_yards": [10, 20, 30, 40, 50, 60, 70, 80, 100],
    "passing_yards": [150, 175, 200, 225, 250, 275, 300],
    "completions": [10, 15, 20, 25, 30],
    "carries": [5, 10, 15, 20],
    "passing_tds": [1, 2, 3],
    "rushing_tds": [1, 2],
    "receiving_tds": [1, 2],
}

POSITION_SECTIONS = {
    "QB": [
        ("passing_yards", "Passing Yards"),
        ("completions", "Completions"),
        ("passing_tds", "Passing TDs"),
        ("rushing_yards", "Rushing Yards"),
        ("carries", "Carries"),
        ("rushing_tds", "Rushing TDs"),
    ],
    "RB": [
        ("rushing_yards", "Rushing Yards"),
        ("carries", "Carries"),
        ("rushing_tds", "Rushing TDs"),
        ("receptions", "Receptions"),
        ("receiving_yards", "Receiving Yards"),
        ("receiving_tds", "Receiving TDs"),
    ],
    "FB": [
        ("rushing_yards", "Rushing Yards"),
        ("carries", "Carries"),
        ("receptions", "Receptions"),
        ("receiving_yards", "Receiving Yards"),
    ],
    "WR": [
        ("receptions", "Receptions"),
        ("receiving_yards", "Receiving Yards"),
        ("receiving_tds", "Receiving TDs"),
        ("rushing_yards", "Rushing Yards"),
        ("carries", "Carries"),
    ],
    "TE": [
        ("receptions", "Receptions"),
        ("receiving_yards", "Receiving Yards"),
        ("receiving_tds", "Receiving TDs"),
    ],
}

STAT_FIELDS = {
    "passing_yards": "passing_yards",
    "completions": "completions",
    "passing_tds": "passing_tds",
    "rushing_yards": "rushing_yards",
    "carries": "carries",
    "rushing_tds": "rushing_tds",
    "receptions": "receptions",
    "receiving_yards": "receiving_yards",
    "receiving_tds": "receiving_tds",
}

POS_ORDER = {"QB": 0, "RB": 1, "FB": 2, "WR": 3, "TE": 4}


def num(v, default=0):
    if v is None or v == "":
        return default
    try:
        f = float(v)
        if math.isnan(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


def inum(v, default=0):
    return int(num(v, default))


def safe_slug(player_id: str) -> str:
    s = re.sub(r"[^A-Za-z0-9_-]", "_", player_id)
    return s or "unknown"


def load_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_active_players() -> dict[str, dict]:
    rows = load_csv(PLAYERS_CSV)
    return {r["player_id"]: r for r in rows}


def hit_rate(games: list[dict], field: str, threshold: int, games_played: int) -> dict:
    hits = sum(1 for g in games if num(g.get(field)) >= threshold)
    denom = games_played
    pct = (100.0 * hits / denom) if denom else 0.0
    return {
        "threshold": threshold,
        "hits": hits,
        "games": denom,
        "pct": round(pct, 1),
        "label": f"{threshold}+",
        "fraction": f"{hits}/{denom}",
    }


def fmt_int(v) -> str:
    return str(inum(v))


def pct_tone(pct: float) -> str:
    if pct >= 75:
        return "hit-hot"
    if pct >= 50:
        return "hit-good"
    if pct >= 25:
        return "hit-mid"
    return "hit-low"


def html_escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def format_kickoff_et(kickoff_et: str, weekday: str, time_et: str, game_date: str) -> str:
    if kickoff_et:
        try:
            dt = datetime.strptime(kickoff_et.strip(), "%Y-%m-%d %H:%M")
            hour = dt.hour
            minute = dt.minute
            ampm = "AM" if hour < 12 else "PM"
            h12 = hour % 12 or 12
            day = dt.strftime("%a")
            mon = dt.strftime("%b")
            return f"{day} {mon} {dt.day} · {h12}:{minute:02d} {ampm} ET"
        except ValueError:
            pass
    parts = []
    if weekday:
        parts.append(weekday[:3])
    if game_date:
        try:
            d = datetime.strptime(game_date.strip(), "%Y-%m-%d")
            parts.append(f"{d.strftime('%b')} {d.day}")
        except ValueError:
            parts.append(game_date)
    if time_et:
        try:
            h, m = time_et.split(":")
            hour = int(h)
            ampm = "AM" if hour < 12 else "PM"
            h12 = hour % 12 or 12
            parts.append(f"{h12}:{m} {ampm} ET")
        except Exception:
            parts.append(f"{time_et} ET")
    return " · ".join(parts) if parts else "TBD"


def parse_game_id(game_id: str) -> tuple[str, str]:
    parts = (game_id or "").split("_")
    if len(parts) >= 4:
        return parts[2], parts[3]
    return "", ""


TEAM_COLORS = {
    "ARI": "#c8314f", "ATL": "#d0213b", "BAL": "#6a4fc9", "BUF": "#2f6fe0",
    "CAR": "#0a9ad8", "CHI": "#e0611f", "CIN": "#fb5a1e", "CLE": "#ff5a1f",
    "DAL": "#4a7fd6", "DEN": "#fb6a2a", "DET": "#1a8fd0", "GB": "#ffb612",
    "HOU": "#c8283c", "IND": "#3a78c9", "JAX": "#0e8a9c", "KC": "#e8233f",
    "LA": "#ffb81c", "LAC": "#1a9ae0", "LV": "#b5bcbf", "MIA": "#14a3ab",
    "MIN": "#8a5cd0", "NE": "#d6213f", "NO": "#d3bc8d", "NYG": "#3a62d6",
    "NYJ": "#2a9a68", "PHI": "#159aa4", "PIT": "#ffb612", "SF": "#d2232a",
    "SEA": "#69be28", "TB": "#e0262a", "TEN": "#4b92db", "WAS": "#c6343f",
}


def team_color(team: str) -> str:
    return TEAM_COLORS.get(team or "", "#6b7c90")


ICON_MATCHUPS = (
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" '
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>'
)
ICON_PLAYERS = (
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" '
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>'
)

NAV = """
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="{home}">Plan<span class="brand-sub">NFL Stats</span></a>
    <span class="topbar-meta">Week {week} · {year}</span>
  </div>
</header>
"""

BOTTOM_NAV = """
<nav class="tabbar" aria-label="Primary">
  <a class="tabbar-link{matchups_active}" href="{home}"{matchups_current}>{icon_m}<span>Matchups</span></a>
  <a class="tabbar-link{players_active}" href="{players}"{players_current}>{icon_p}<span>Players</span></a>
</nav>
"""

FOOTER = """
<footer class="site-footer">
  <div class="wrap">
    <p class="footer-lead">
      <strong>Plan</strong> — NFL player stats only. No betting lines or odds.
      Data through {year} REG week {week}. Source:
      <a href="https://github.com/nflverse/nflverse-data" target="_blank" rel="noopener">nflverse</a>.
    </p>
    <p class="footer-note">Hit rates use <code>games_played</code> as the denominator.</p>
  </div>
</footer>
""".format(year=SEASON_YEAR, week=SEASON_THROUGH_WEEK)

HEAD_COMMON = """
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0c0f">
<meta name="apple-mobile-web-app-capable" content="yes">
<link href="{css}" rel="stylesheet">
"""


def page_shell(
    title: str,
    body: str,
    *,
    home_href: str,
    players_href: str,
    css_href: str,
    extra_head: str = "",
    matchups_active: bool = False,
    players_active: bool = False,
    extra_scripts: str = "",
) -> str:
    nav = NAV.format(home=home_href, week=MATCHUP_WEEK, year=SEASON_YEAR)
    bottom = BOTTOM_NAV.format(
        home=home_href,
        players=players_href,
        matchups_active=" is-active" if matchups_active else "",
        players_active=" is-active" if players_active else "",
        matchups_current=' aria-current="page"' if matchups_active else "",
        players_current=' aria-current="page"' if players_active else "",
        icon_m=ICON_MATCHUPS,
        icon_p=ICON_PLAYERS,
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
{HEAD_COMMON.format(css=css_href)}
<title>{html_escape(title)} · Plan</title>
{extra_head}
</head>
<body>
{nav}
<main class="main">
{body}
</main>
{FOOTER}
{bottom}
{extra_scripts}
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Hit-rate ladders (stats only — never odds)
# ---------------------------------------------------------------------------

def fmt_avg(v: float) -> str:
    if 0 < abs(v) < 1:
        return f"{v:.2f}".rstrip("0").rstrip(".")
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def ladder_thresholds(market: str, avg: float) -> list[int]:
    """Per-player ladder of 7 lines centred on the player's per-game average."""
    if market in ("passing_tds", "rushing_tds", "receiving_tds"):
        return [1, 2, 3]
    if market == "passing_yards":
        step = 25 if avg >= 150 else 10
    elif market in ("rushing_yards", "receiving_yards"):
        step = 10 if avg >= 25 else 5
    elif market in ("completions", "carries"):
        step = 2 if avg >= 10 else 1
    else:  # receptions
        step = 1
    floor = step
    center = max(floor, int(round(avg / step)) * step)
    start = max(floor, center - 3 * step)
    return [start + i * step for i in range(7)]


def anchor_index(lines: list[int], avg: float) -> int:
    best = 0
    for i, t in enumerate(lines):
        if abs(t - avg) < abs(lines[best] - avg):
            best = i
    return best


def hit_tile(hr: dict, *, anchor: bool = False) -> str:
    tone = pct_tone(hr["pct"])
    pct = f"{hr['pct']:.0f}%"
    cls = f"hit-tile {tone}" + (" is-anchor" if anchor else "")
    return (
        f'<div class="{cls}" title="{hr["hits"]} of {hr["games"]} games at {hr["label"]}">'
        f'<span class="hit-tile-line">{hr["label"]}</span>'
        f'<span class="hit-tile-pct">{pct}</span>'
        f'<span class="hit-tile-frac">{hr["fraction"]}</span>'
        f"</div>"
    )


def season_totals_rows(pos: str, s: dict) -> list[tuple[str, str]]:
    rows = [("Games Played", fmt_int(s.get("games_played")))]
    if pos == "QB":
        rows += [
            ("Completions", fmt_int(s.get("completions"))),
            ("Attempts", fmt_int(s.get("attempts"))),
            ("Passing Yards", fmt_int(s.get("passing_yards"))),
            ("Passing TDs", fmt_int(s.get("passing_tds"))),
            ("INTs", fmt_int(s.get("passing_interceptions"))),
            ("Carries", fmt_int(s.get("carries"))),
            ("Rushing Yards", fmt_int(s.get("rushing_yards"))),
            ("Rushing TDs", fmt_int(s.get("rushing_tds"))),
        ]
    elif pos in ("RB", "FB"):
        rows += [
            ("Carries", fmt_int(s.get("carries"))),
            ("Rushing Yards", fmt_int(s.get("rushing_yards"))),
            ("Rushing TDs", fmt_int(s.get("rushing_tds"))),
            ("Targets", fmt_int(s.get("targets"))),
            ("Receptions", fmt_int(s.get("receptions"))),
            ("Receiving Yards", fmt_int(s.get("receiving_yards"))),
            ("Receiving TDs", fmt_int(s.get("receiving_tds"))),
        ]
    else:
        rows += [
            ("Targets", fmt_int(s.get("targets"))),
            ("Receptions", fmt_int(s.get("receptions"))),
            ("Receiving Yards", fmt_int(s.get("receiving_yards"))),
            ("Receiving TDs", fmt_int(s.get("receiving_tds"))),
            ("Carries", fmt_int(s.get("carries"))),
            ("Rushing Yards", fmt_int(s.get("rushing_yards"))),
            ("Rushing TDs", fmt_int(s.get("rushing_tds"))),
        ]
    snaps = s.get("offense_snaps_total")
    if snaps not in (None, ""):
        rows.append(("Offense Snaps", fmt_int(snaps)))
    return rows


def game_log_columns(pos: str) -> list[tuple[str, str, callable]]:
    base = [
        ("Wk", "week", lambda g: fmt_int(g.get("week"))),
        ("Opp", "opponent_team", lambda g: html_escape(g.get("opponent_team") or "—")),
        ("Snaps", "offense_snaps", lambda g: fmt_int(g.get("offense_snaps"))),
    ]
    if pos == "QB":
        return base + [
            ("Cmp", "completions", lambda g: fmt_int(g.get("completions"))),
            ("Att", "attempts", lambda g: fmt_int(g.get("attempts"))),
            ("Pass Yds", "passing_yards", lambda g: fmt_int(g.get("passing_yards"))),
            ("Pass TD", "passing_tds", lambda g: fmt_int(g.get("passing_tds"))),
            ("INT", "passing_interceptions", lambda g: fmt_int(g.get("passing_interceptions"))),
            ("Rush", "carries", lambda g: fmt_int(g.get("carries"))),
            ("Rush Yds", "rushing_yards", lambda g: fmt_int(g.get("rushing_yards"))),
            ("Rush TD", "rushing_tds", lambda g: fmt_int(g.get("rushing_tds"))),
        ]
    if pos in ("RB", "FB"):
        return base + [
            ("Att", "carries", lambda g: fmt_int(g.get("carries"))),
            ("Rush Yds", "rushing_yards", lambda g: fmt_int(g.get("rushing_yards"))),
            ("Rush TD", "rushing_tds", lambda g: fmt_int(g.get("rushing_tds"))),
            ("Tgt", "targets", lambda g: fmt_int(g.get("targets"))),
            ("Rec", "receptions", lambda g: fmt_int(g.get("receptions"))),
            ("Rec Yds", "receiving_yards", lambda g: fmt_int(g.get("receiving_yards"))),
            ("Rec TD", "receiving_tds", lambda g: fmt_int(g.get("receiving_tds"))),
        ]
    return base + [
        ("Tgt", "targets", lambda g: fmt_int(g.get("targets"))),
        ("Rec", "receptions", lambda g: fmt_int(g.get("receptions"))),
        ("Rec Yds", "receiving_yards", lambda g: fmt_int(g.get("receiving_yards"))),
        ("Rec TD", "receiving_tds", lambda g: fmt_int(g.get("receiving_tds"))),
        ("Rush", "carries", lambda g: fmt_int(g.get("carries"))),
        ("Rush Yds", "rushing_yards", lambda g: fmt_int(g.get("rushing_yards"))),
    ]


def week_card_stats(pos: str, g: dict) -> list[tuple[str, str]]:
    if pos == "QB":
        return [
            ("Cmp/Att", f"{fmt_int(g.get('completions'))}/{fmt_int(g.get('attempts'))}"),
            ("Pass Yds", fmt_int(g.get("passing_yards"))),
            ("Pass TD", fmt_int(g.get("passing_tds"))),
            ("INT", fmt_int(g.get("passing_interceptions"))),
            ("Rush Yds", fmt_int(g.get("rushing_yards"))),
            ("Snaps", fmt_int(g.get("offense_snaps"))),
        ]
    if pos in ("RB", "FB"):
        return [
            ("Att", fmt_int(g.get("carries"))),
            ("Rush Yds", fmt_int(g.get("rushing_yards"))),
            ("Rush TD", fmt_int(g.get("rushing_tds"))),
            ("Rec", fmt_int(g.get("receptions"))),
            ("Rec Yds", fmt_int(g.get("receiving_yards"))),
            ("Snaps", fmt_int(g.get("offense_snaps"))),
        ]
    return [
        ("Tgt", fmt_int(g.get("targets"))),
        ("Rec", fmt_int(g.get("receptions"))),
        ("Rec Yds", fmt_int(g.get("receiving_yards"))),
        ("Rec TD", fmt_int(g.get("receiving_tds"))),
        ("Snaps", fmt_int(g.get("offense_snaps"))),
    ]


AVG_LABELS = {
    "passing_yards": "YDS/G",
    "completions": "CMP/G",
    "passing_tds": "TD/G",
    "rushing_yards": "YDS/G",
    "carries": "ATT/G",
    "rushing_tds": "TD/G",
    "receptions": "REC/G",
    "receiving_yards": "RECYDS/G",
    "receiving_tds": "TD/G",
}


def render_hit_tables(pos: str, games: list[dict], games_played: int, season: dict | None = None) -> str:
    """Player page: collapsible market sections with hit-rate tile grids."""
    if games_played <= 0:
        return '<p class="market-empty">No games played yet — hit rates need at least one game (denominator is games_played).</p>'
    sections = POSITION_SECTIONS.get(pos, POSITION_SECTIONS["WR"])
    parts = []
    for i, (key, title) in enumerate(sections):
        thresholds = THRESHOLDS.get(key, [])
        field = STAT_FIELDS[key]
        total = num((season or {}).get(field)) if season else sum(num(g.get(field)) for g in games)
        avg = (total / games_played) if games_played else 0.0
        tiles = "".join(
            hit_tile(hit_rate(games, field, t, games_played)) for t in thresholds
        )
        avg_pill = (
            f'<span class="avg-pill"><span class="avg-pill-lbl">{AVG_LABELS.get(key, "/G")}:</span>'
            f'<span class="avg-pill-val">{fmt_avg(avg)}</span></span>'
        )
        parts.append(
            f"""
<details class="market" open>
  <summary class="market-head">
    <span class="market-title">{html_escape(title)}</span>
    {avg_pill}
    <span class="chev" aria-hidden="true"></span>
  </summary>
  <div class="market-body">
    <div class="tile-grid">{tiles}</div>
  </div>
</details>"""
        )
    return "\n".join(parts)


def key_stat_chips(pos: str, s: dict) -> str:
    chips = []
    gp = inum(s.get("games_played"))
    chips.append(("GP", str(gp)))
    if pos == "QB":
        chips += [
            ("Pass Yds", fmt_int(s.get("passing_yards"))),
            ("Pass TD", fmt_int(s.get("passing_tds"))),
            ("Cmp", fmt_int(s.get("completions"))),
            ("Rush Yds", fmt_int(s.get("rushing_yards"))),
        ]
    elif pos in ("RB", "FB"):
        chips += [
            ("Rush Yds", fmt_int(s.get("rushing_yards"))),
            ("Rush TD", fmt_int(s.get("rushing_tds"))),
            ("Rec", fmt_int(s.get("receptions"))),
            ("Rec Yds", fmt_int(s.get("receiving_yards"))),
        ]
    else:
        chips += [
            ("Rec", fmt_int(s.get("receptions"))),
            ("Rec Yds", fmt_int(s.get("receiving_yards"))),
            ("Rec TD", fmt_int(s.get("receiving_tds"))),
            ("Tgt", fmt_int(s.get("targets"))),
        ]
    return "".join(
        f'<div class="chip"><div class="chip-val">{html_escape(v)}</div>'
        f'<div class="chip-lbl">{html_escape(k)}</div></div>'
        for k, v in chips
    )


def render_player_page(season: dict, games: list[dict], active: dict | None) -> str:
    pid = season["player_id"]
    name = season.get("full_name") or "Unknown"
    pos = season.get("position") or ""
    team = season.get("team") or "—"
    games_played = inum(season.get("games_played"))
    jersey = (active or {}).get("jersey_number") or ""
    status = (active or {}).get("status") or ""
    headshot = (active or {}).get("headshot_url") or ""

    games_sorted = sorted(games, key=lambda g: inum(g.get("week")))

    if headshot:
        headshot_html = (
            f'<img src="{html_escape(headshot)}" alt="{html_escape(name)}" '
            f'class="avatar avatar-lg" style="border:3px solid {team_color(team)}" width="72" height="72" loading="lazy">'
        )
    else:
        headshot_html = '<div class="avatar avatar-lg avatar-ph" aria-hidden="true">?</div>'

    jersey_html = f'<span class="tag">#{html_escape(str(jersey))}</span>' if jersey else ""
    status_html = f'<span class="tag tag-ok">{html_escape(status)}</span>' if status else ""

    totals = season_totals_rows(pos, season)
    totals_html = "".join(
        f'<tr><th>{html_escape(k)}</th><td class="num">{html_escape(v)}</td></tr>'
        for k, v in totals
    )

    cols = game_log_columns(pos)
    thead = "".join(f"<th>{html_escape(h)}</th>" for h, _, _ in cols)
    tbody_rows = []
    week_cards = []
    for g in games_sorted:
        cells = "".join(f'<td class="num">{fmt(g)}</td>' for _, _, fmt in cols)
        # First two cols (Wk, Opp) look better left-aligned
        cells_list = []
        for i, (_, _, fmt) in enumerate(cols):
            cls = "" if i < 2 else ' class="num"'
            cells_list.append(f"<td{cls}>{fmt(g)}</td>")
        tbody_rows.append(f"<tr>{''.join(cells_list)}</tr>")
        opp = html_escape(g.get("opponent_team") or "—")
        wk = fmt_int(g.get("week"))
        chip_bits = week_card_stats(pos, g)
        chips = "".join(
            f'<div class="week-stat"><span class="week-stat-val">{html_escape(v)}</span>'
            f'<span class="week-stat-lbl">{html_escape(k)}</span></div>'
            for k, v in chip_bits
        )
        week_cards.append(
            f"""<article class="panel week-card">
  <div class="week-card-top">
    <span class="week-card-title">Week {wk}</span>
    <span class="muted">vs {opp}</span>
  </div>
  <div class="week-stat-grid">{chips}</div>
</article>"""
        )
    tbody = (
        "\n".join(tbody_rows)
        if tbody_rows
        else '<tr><td colspan="99" class="muted">No games played.</td></tr>'
    )
    week_cards_html = (
        "\n".join(week_cards)
        if week_cards
        else '<p class="muted">No games played.</p>'
    )

    hit_html = render_hit_tables(pos, games_sorted, games_played, season)
    chips_html = key_stat_chips(pos, season)

    body = f"""
<div class="wrap page page-matchup">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="../index.html">Matchups</a>
    <span class="crumbs-sep">/</span>
    <a href="../players.html">Players</a>
    <span class="crumbs-sep">/</span>
    <span class="crumbs-current">{html_escape(name)}</span>
  </nav>

  <header class="player-hero">
    <div class="player-hero-row">
      {headshot_html}
      <div class="player-hero-text">
        <h1 class="page-title truncate">{html_escape(name)}</h1>
        <div class="player-meta">
          <span class="pill pill-pos">{html_escape(pos)}</span>
          <span class="team-code">{html_escape(team)}</span>
          {jersey_html}{status_html}
        </div>
        <p class="meta-line">{SEASON_YEAR} REG · thru wk {SEASON_THROUGH_WEEK} · {games_played} GP</p>
      </div>
    </div>
    <div class="chip-row">{chips_html}</div>
  </header>

</div>

<div class="cat-bar">
  <div class="cat-bar-inner" role="tablist" aria-label="Player sections">
    <button type="button" class="cat-tab is-active" role="tab" id="tab-hits" aria-controls="panel-hits" aria-selected="true" data-tab="hits">Hit Rates</button>
    <button type="button" class="cat-tab" role="tab" id="tab-log" aria-controls="panel-log" aria-selected="false" data-tab="log">Game Log</button>
    <button type="button" class="cat-tab" role="tab" id="tab-season" aria-controls="panel-season" aria-selected="false" data-tab="season">Season</button>
  </div>
</div>

<div class="wrap page page-matchup-body">
  <section class="cat-panel" id="panel-hits" role="tabpanel" aria-labelledby="tab-hits">
    <div id="hit-rates">
      <p class="hint ladder-hint">Hit rate over {games_played} GP = games at or above the line ÷ games_played. Stats only — no betting lines.</p>
      <div class="markets">
        {hit_html}
      </div>
    </div>
  </section>

  <section class="cat-panel" id="panel-log" role="tabpanel" aria-labelledby="tab-log" hidden>
    <h2 class="section-title">Game Log <span class="section-sub">Wks 1–{SEASON_THROUGH_WEEK}</span></h2>
    <div class="week-stack phone-only">{week_cards_html}</div>
    <div class="panel desktop-only">
      <div class="scroll-x">
        <table class="data-table">
          <thead><tr>{thead}</tr></thead>
          <tbody>{tbody}</tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="cat-panel" id="panel-season" role="tabpanel" aria-labelledby="tab-season" hidden>
    <h2 class="section-title">Season Totals</h2>
    <div class="panel">
      <table class="data-table totals-table">
        <tbody>{totals_html}</tbody>
      </table>
    </div>
  </section>
<script src="../js/tabs.js"></script>
</div>
"""
    return page_shell(
        name,
        body,
        home_href="../index.html",
        players_href="../players.html",
        css_href="../css/plan.css",
    )


def index_key_stats(pos: str, s: dict) -> dict:
    gp = inum(s.get("games_played"))
    base = {"games_played": gp}
    if pos == "QB":
        base.update(
            {
                "passing_yards": inum(s.get("passing_yards")),
                "passing_tds": inum(s.get("passing_tds")),
                "completions": inum(s.get("completions")),
                "rushing_yards": inum(s.get("rushing_yards")),
            }
        )
    elif pos in ("RB", "FB"):
        base.update(
            {
                "rushing_yards": inum(s.get("rushing_yards")),
                "rushing_tds": inum(s.get("rushing_tds")),
                "receptions": inum(s.get("receptions")),
                "receiving_yards": inum(s.get("receiving_yards")),
            }
        )
    else:
        base.update(
            {
                "receptions": inum(s.get("receptions")),
                "receiving_yards": inum(s.get("receiving_yards")),
                "receiving_tds": inum(s.get("receiving_tds")),
                "targets": inum(s.get("targets")),
            }
        )
    return base


def player_card_stats_line(p: dict) -> str:
    pos = p["position"]
    gp = p.get("games_played", 0)
    if pos == "QB":
        return f"{gp} GP · {p.get('passing_yards', 0)} Pass Yds · {p.get('passing_tds', 0)} TD"
    if pos in ("RB", "FB"):
        return f"{gp} GP · {p.get('rushing_yards', 0)} Rush · {p.get('receptions', 0)} Rec"
    return f"{gp} GP · {p.get('receptions', 0)} Rec · {p.get('receiving_yards', 0)} Yds"


def load_matchups() -> tuple[list[dict], list[dict]]:
    rows = load_csv(MATCHUPS_CSV)
    games_map: dict[str, dict] = {}
    bye_teams: dict[str, int] = {}

    for r in rows:
        is_bye = str(r.get("is_bye", "")).lower() in ("true", "1", "yes")
        team = r.get("team") or ""
        if is_bye:
            bye_teams[team] = bye_teams.get(team, 0) + 1
            continue
        gid = r.get("game_id") or ""
        if not gid:
            continue
        if gid not in games_map:
            away, home = parse_game_id(gid)
            ha = (r.get("home_away") or "").lower()
            if not away or not home:
                opp = r.get("opponent_team") or ""
                if ha == "home":
                    home, away = team, opp
                else:
                    away, home = team, opp
            games_map[gid] = {
                "game_id": gid,
                "away_team": away,
                "home_team": home,
                "game_date": r.get("game_date") or "",
                "weekday": r.get("weekday") or "",
                "kickoff_time_et": r.get("kickoff_time_et") or "",
                "kickoff_et": r.get("kickoff_et") or "",
                "stadium": r.get("stadium") or "",
                "div_game": r.get("div_game") or "",
                "slug": gid.replace("/", "_"),
            }

    games = list(games_map.values())

    def sort_key(g):
        ko = g.get("kickoff_et") or ""
        return (ko, g.get("away_team") or "", g.get("home_team") or "")

    games.sort(key=sort_key)
    byes = [{"team": t, "player_count": c} for t, c in sorted(bye_teams.items())]
    return games, byes


EXTRA_CSS = r"""
/* ===================================================================
   Props-style layer (category tabs, market sections, hit-rate ladders)
   =================================================================== */
:root {
  --bg: #0a0c0f;
  --bg-elev: #0f1216;
  --surface: #1a1d22;
  --surface-2: #22262c;
  --tile: #24282e;
  --border: #2a2f36;
  --border-soft: #1d2126;
  --accent: #3fd16b;
  --accent-dim: rgba(63, 209, 107, 0.14);
  --accent-border: #2fae57;
  --amber: #f5b72e;
  --tabbar-h: 62px;
}

body { padding-bottom: calc(var(--tabbar-h) + var(--safe-b)); }

/* Top bar: simple, not sticky (category bar sticks instead) */
.topbar { position: static; background: var(--bg); backdrop-filter: none; -webkit-backdrop-filter: none; }
.topbar-meta { color: var(--muted); font-size: 0.8125rem; font-weight: 600; }

/* Sticky bottom tab bar */
.tabbar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 60;
  display: flex;
  justify-content: center;
  gap: 8px;
  height: calc(var(--tabbar-h) + var(--safe-b));
  padding: 6px 16px var(--safe-b);
  background: rgba(14, 16, 19, 0.96);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid var(--border-soft);
}
.tabbar-link {
  flex: 1;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 48px;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 650;
  border-radius: 12px;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.tabbar-link:hover { color: var(--text); text-decoration: none; }
.tabbar-link.is-active { color: var(--accent); }

/* Matchup hero */
.page-matchup { padding-bottom: 8px; }
.crumbs-back { font-weight: 650; font-size: 0.9rem; color: var(--text) !important; }
.game-hero-teams {
  display: flex;
  align-items: center;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.game-team { display: inline-flex; align-items: center; gap: 8px; }
.team-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--team, var(--muted));
  box-shadow: 0 0 0 3px rgba(255,255,255,0.04);
}
.team-chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 40px; padding: 3px 9px; border-radius: 999px;
  font-size: 0.75rem; font-weight: 800; letter-spacing: 0.03em;
  color: #fff;
  background: color-mix(in srgb, var(--team, #555) 70%, #000);
  border: 1px solid color-mix(in srgb, var(--team, #555) 80%, #fff 0%);
}

/* Category tab bar */
.cat-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(10, 12, 15, 0.97);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  padding-top: var(--safe-t);
}
.cat-bar-inner {
  max-width: var(--max);
  margin: 0 auto;
  display: flex;
  gap: 4px;
  padding: 0 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.cat-bar-inner::-webkit-scrollbar { display: none; }
.cat-tab {
  flex: 0 0 auto;
  appearance: none;
  background: none;
  border: 0;
  border-bottom: 3px solid transparent;
  color: var(--muted);
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  min-height: 48px;
  padding: 10px 12px 7px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.cat-tab:hover { color: var(--text); }
.cat-tab.is-active { color: var(--text); border-bottom-color: var(--accent); }
.cat-tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 6px; }

.page-matchup-body { padding-top: 10px; }
.matchup-teams { display: flex; align-items: center; }
.page-matchup-body .section-title { margin-top: 8px; }
.ladder-hint { font-size: 0.78rem; margin-bottom: 4px; }

/* Market sections (collapsible) */
.market { border-bottom: 1px solid var(--border-soft); }
.market:last-child { border-bottom: 0; }
.market-head {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 10px 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.market-head::-webkit-details-marker { display: none; }
.market-title { font-size: 1.12rem; font-weight: 800; letter-spacing: -0.01em; color: var(--text); }
.chev {
  margin-left: auto;
  width: 10px; height: 10px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(45deg) translate(-2px, -2px);
  transition: transform 0.18s ease;
  flex-shrink: 0;
  margin-right: 6px;
}
.market[open] > .market-head .chev { transform: rotate(-135deg) translate(-2px, -2px); }
.market-body { padding: 0 0 14px; }
.market-empty { color: var(--muted); font-size: 0.875rem; margin: 0 0 6px; }

/* Prop rows */
.prop-rows { display: flex; flex-direction: column; gap: 6px; }
.prop-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 60px;
}
.prop-row.is-extra { display: none; }
.market.is-expanded .prop-row.is-extra { display: grid; }
.prop-player {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  min-height: 48px;
  color: var(--text);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.prop-player:hover { text-decoration: none; }
.prop-player:hover .prop-name { color: var(--accent); }
.prop-player-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.prop-name {
  font-size: 0.9rem; font-weight: 600; line-height: 1.15;
  white-space: normal; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

.avg-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  align-self: flex-start;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 0.66rem;
  font-weight: 700;
  white-space: nowrap;
  line-height: 1.35;
}
.avg-pill-lbl { color: var(--muted); letter-spacing: 0.02em; }
.avg-pill-val { color: var(--amber); font-variant-numeric: tabular-nums; }

/* Avatar with team accent ring */
.avatar-ring {
  position: relative;
  flex-shrink: 0;
  width: 42px; height: 42px;
  border-radius: 50%;
  padding: 2px;
  background: var(--team, var(--border));
}
.player-card .avatar-ring { width: 46px; height: 46px; }
.avatar-ring img,
.avatar-ring-ph {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: #15181c;
  border: 2px solid var(--bg);
  color: var(--muted); font-weight: 700;
}
.avatar-team-dot {
  position: absolute;
  right: -1px; bottom: -1px;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: var(--team, var(--muted));
  border: 2px solid var(--bg);
}

/* Ladder of threshold tiles (horizontal swipe) */
.ladder {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  padding: 2px 0;
  mask-image: linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
}
.ladder::-webkit-scrollbar { display: none; }
.hit-tile {
  flex: 0 0 64px;
  scroll-snap-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-height: 58px;
  padding: 6px 2px;
  border-radius: 8px;
  background: var(--tile);
  border: 1px solid transparent;
  font-variant-numeric: tabular-nums;
}
.hit-tile.is-anchor { border-color: rgba(255,255,255,0.14); background: #2b3037; }
.hit-tile-line { font-size: 0.74rem; font-weight: 600; color: #d6dbe1; }
.hit-tile-pct { font-size: 0.98rem; font-weight: 800; line-height: 1.15; }
.hit-tile-frac { font-size: 0.68rem; color: var(--muted); font-weight: 600; }
.hit-tile.hit-hot .hit-tile-pct { color: var(--accent); }
.hit-tile.hit-hot { background: rgba(63, 209, 107, 0.12); }
.hit-tile.hit-good .hit-tile-pct { color: #a6e35a; }
.hit-tile.hit-mid .hit-tile-pct { color: var(--amber); }
.hit-tile.hit-low .hit-tile-pct { color: #8a939e; }

.view-more {
  display: block;
  width: 100%;
  min-height: 48px;
  margin-top: 10px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.view-more:hover { border-color: var(--accent-border); }

/* Player page tile grid */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 6px;
}
.tile-grid .hit-tile { flex: none; }
#hit-rates .market-head .avg-pill { align-self: center; }

/* Panels: the tab panels sit on the page background, like the reference */
.cat-panel[hidden] { display: none; }
.roster-panel { padding-top: 10px; }

@media (min-width: 768px) {
  .prop-row { grid-template-columns: 210px minmax(0, 1fr); }
  .hit-tile { flex-basis: 72px; }
}
"""

MATCHUP_JS = r"""(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".cat-tab[data-tab]"));
  var valid = tabs.map(function (t) { return t.dataset.tab; });

  function centerLadders(scope) {
    (scope || document).querySelectorAll("[data-ladder]").forEach(function (ladder) {
      var a = ladder.querySelector(".is-anchor");
      if (!a || !ladder.clientWidth) return;
      ladder.scrollLeft = Math.max(0, a.offsetLeft - ladder.offsetLeft - (ladder.clientWidth - a.offsetWidth) / 2);
    });
  }

  function activate(id, push) {
    if (valid.indexOf(id) === -1) id = valid[0];
    tabs.forEach(function (t) {
      var on = t.dataset.tab === id;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      var panel = document.getElementById("panel-" + t.dataset.tab);
      if (panel) panel.hidden = !on;
      if (on && t.scrollIntoView) {
        var bar = t.parentElement;
        bar.scrollLeft = Math.max(0, t.offsetLeft - (bar.clientWidth - t.offsetWidth) / 2);
      }
    });
    if (push && history.replaceState) history.replaceState(null, "", "#" + id);
    centerLadders(document.getElementById("panel-" + id));
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () { activate(t.dataset.tab, true); });
  });

  document.querySelectorAll("[data-view-more]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var market = btn.closest(".market");
      var on = !market.classList.contains("is-expanded");
      market.classList.toggle("is-expanded", on);
      btn.textContent = on ? btn.dataset.lessLabel : btn.dataset.moreLabel;
      if (on) centerLadders(market);
    });
  });

  document.querySelectorAll("details.market").forEach(function (d) {
    d.addEventListener("toggle", function () { if (d.open) centerLadders(d); });
  });

  window.addEventListener("hashchange", function () { activate(location.hash.slice(1), false); });
  activate((location.hash || "").slice(1), false);
})();
"""


def write_css():
    css = r"""/* Plan — custom mobile-first NFL stats (no Bootstrap) */
*,
*::before,
*::after { box-sizing: border-box; }

:root {
  --bg: #0a0e13;
  --bg-elev: #10161e;
  --surface: #151d27;
  --surface-2: #1a2430;
  --border: #273341;
  --border-soft: #1f2a36;
  --text: #eef3f8;
  --muted: #8fa0b3;
  --faint: #6b7c90;
  --accent: #3ecf8e;
  --accent-dim: rgba(62, 207, 142, 0.14);
  --accent-border: #2f9e6c;
  --warn: #f0c14a;
  --warn-dim: rgba(240, 193, 74, 0.16);
  --tap: 48px;
  --radius: 14px;
  --radius-sm: 10px;
  --shadow: 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.28);
  --safe-t: env(safe-area-inset-top, 0px);
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right, 0px);
  --max: 720px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
          Arial, "Noto Sans", sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 16px;
  line-height: 1.45;
  padding-left: var(--safe-l);
  padding-right: var(--safe-r);
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 2px; }

.main { flex: 1 0 auto; }
.wrap {
  width: 100%;
  max-width: var(--max);
  margin: 0 auto;
  padding-left: 16px;
  padding-right: 16px;
}
.page { padding-top: 18px; padding-bottom: calc(28px + var(--safe-b)); }

.muted { color: var(--muted); }
.hint { color: var(--muted); font-size: 0.875rem; margin: 0 0 14px; }
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.num { text-align: right; font-variant-numeric: tabular-nums; }

/* Top bar */
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(10, 14, 19, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-soft);
  padding-top: var(--safe-t);
}
.topbar-inner {
  max-width: var(--max);
  margin: 0 auto;
  padding: 8px 16px;
  min-height: var(--tap);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.brand {
  color: var(--accent);
  font-weight: 800;
  font-size: 1.15rem;
  letter-spacing: -0.02em;
  text-decoration: none;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}
.brand:hover { text-decoration: none; color: var(--accent); }
.brand-sub {
  color: var(--faint);
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  display: none;
}
@media (min-width: 420px) {
  .brand-sub { display: inline; }
}
.topnav { display: flex; align-items: center; gap: 4px; }
.topnav-link {
  color: var(--muted);
  font-weight: 650;
  font-size: 0.9375rem;
  min-height: var(--tap);
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  text-decoration: none;
}
.topnav-link:hover {
  color: var(--text);
  background: rgba(255,255,255,0.05);
  text-decoration: none;
}
.topnav-link.is-active {
  color: var(--accent);
  background: var(--accent-dim);
}

/* Page chrome */
.page-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.25;
}
.page-lead {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.875rem;
}
.section-title {
  margin: 0 0 12px;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.section-sub {
  color: var(--muted);
  font-weight: 500;
  font-size: 0.9em;
}
.block { margin-bottom: 28px; }

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--muted);
  margin-bottom: 14px;
}
.crumbs a { color: var(--muted); }
.crumbs a:hover { color: var(--accent); }
.crumbs-sep { color: var(--faint); }
.crumbs-current { color: var(--text); font-weight: 600; }

/* Panels / cards */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}
.panel-head {
  padding: 12px 14px;
  font-weight: 700;
  font-size: 0.95rem;
  border-bottom: 1px solid var(--border-soft);
  background: var(--surface-2);
}

/* Matchup cards */
.matchup-list { display: flex; flex-direction: column; gap: 10px; }
.matchup-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  min-height: 88px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: inherit;
  text-decoration: none;
  box-shadow: var(--shadow);
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}
.matchup-card:hover,
.matchup-card:focus-visible {
  border-color: var(--accent-border);
  background: linear-gradient(180deg, rgba(62,207,142,0.08), var(--surface));
  color: inherit;
  text-decoration: none;
  outline: none;
}
.matchup-card:active { transform: scale(0.988); }
.matchup-teams {
  font-size: 1.28rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.matchup-vs {
  color: var(--faint);
  font-weight: 600;
  font-size: 0.8rem;
  margin: 0 0.4rem;
  vertical-align: middle;
}
.matchup-meta {
  color: var(--muted);
  font-size: 0.875rem;
  margin-top: 4px;
}
.matchup-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.matchup-cta {
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 700;
}

.bye-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 14px;
  background: var(--bg-elev);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}
.bye-title { font-weight: 700; }
.bye-badges { display: flex; flex-wrap: wrap; gap: 6px; }

/* Tags / pills */
.tag, .pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.4;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
}
.tag-ok, .pill-pos {
  background: var(--accent-dim);
  border-color: transparent;
  color: var(--accent);
}
.tag-warn {
  background: var(--warn-dim);
  border-color: transparent;
  color: var(--warn);
}
.tag-dim {
  background: rgba(255,255,255,0.05);
  color: var(--muted);
  border-color: transparent;
}
.pill.hit-hot { background: rgba(62, 207, 142, 0.22); color: #7demb8; color: #8fe8b8; border-color: transparent; }
.pill.hit-good { background: rgba(74, 144, 226, 0.22); color: #9ec5f5; border-color: transparent; }
.pill.hit-mid { background: rgba(240, 193, 74, 0.2); color: #f0c14a; border-color: transparent; }
.pill.hit-low { background: rgba(255,255,255,0.06); color: var(--muted); border-color: transparent; }

/* Player list cards */
.player-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--tap);
  padding: 12px 14px;
  margin-bottom: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.player-card:hover,
.player-card:focus-visible {
  border-color: var(--accent-border);
  background: rgba(62, 207, 142, 0.07);
  color: inherit;
  text-decoration: none;
  outline: none;
}
.player-card-body { min-width: 0; flex: 1; }
.player-card-name {
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.2;
}
.player-card-meta {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 3px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.player-card-chevron {
  color: var(--faint);
  font-size: 1.25rem;
  flex-shrink: 0;
  line-height: 1;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  background: #1a222c;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.avatar-lg { width: 72px; height: 72px; }
.avatar-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-weight: 700;
  font-size: 1rem;
}
.avatar-lg.avatar-ph { font-size: 1.5rem; }

/* Filters */
.filter-bar {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.filter-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--muted);
  margin-bottom: 6px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.filter-input,
.filter-select {
  width: 100%;
  min-height: var(--tap);
  padding: 10px 14px;
  font-size: 16px;
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}
.filter-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%238fa0b3' d='M1.4.3 6 4.9 10.6.3l1.4 1.4L6 7.7.0 1.7z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}
.filter-input:focus,
.filter-select:focus {
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
.filter-input::placeholder { color: var(--faint); }

.header-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}
.result-count { color: var(--muted); font-size: 0.875rem; }

/* Player hero */
.player-hero { margin-bottom: 22px; }
.player-hero-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.player-hero-text { min-width: 0; flex: 1; }
.player-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.team-code { font-weight: 700; }
.meta-line {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.8125rem;
}

.chip-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-top: 14px;
}
.chip {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 4px;
  text-align: center;
}
.chip-val {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: 0.95rem;
  line-height: 1.15;
}
.chip-lbl {
  font-size: 0.62rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 4px;
  font-weight: 650;
}

/* Week cards */
.week-stack { display: flex; flex-direction: column; gap: 10px; }
.week-card { padding: 12px 14px; }
.week-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.week-card-title { font-weight: 700; }
.week-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.week-stat {
  display: flex;
  flex-direction: column;
  background: rgba(0,0,0,0.22);
  border-radius: 8px;
  padding: 8px 6px;
  text-align: center;
}
.week-stat-val {
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}
.week-stat-lbl {
  font-size: 0.62rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-top: 2px;
  font-weight: 650;
}

/* Tables */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.data-table th,
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-soft);
  vertical-align: middle;
}
.data-table thead th {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  font-weight: 700;
  background: var(--surface-2);
  text-align: left;
}
.data-table thead th.num,
.data-table td.num { text-align: right; }
.data-table tbody tr:last-child th,
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.015); }
.totals-table th {
  color: var(--muted);
  font-weight: 550;
  text-align: left;
}
.totals-table td {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.hit-line { font-weight: 700; }
.hit-rate { text-align: right; }
.scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }

.hit-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 520px) {
  .hit-grid { grid-template-columns: 1fr 1fr; }
}
@media (min-width: 900px) {
  .hit-grid { grid-template-columns: 1fr 1fr 1fr; }
  :root { --max: 980px; }
}

/* Team sections on matchup detail */
.team-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.team-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 750;
}
.team-count {
  margin-left: auto;
  color: var(--muted);
  font-size: 0.8125rem;
  font-weight: 550;
}

/* Desktop / phone visibility */
.phone-only { display: block; }
.desktop-only { display: none; }
@media (min-width: 768px) {
  .phone-only { display: none; }
  .desktop-only { display: block; }
  .chip-row { grid-template-columns: repeat(5, minmax(0, 7rem)); }
  .avatar-lg { width: 96px; height: 96px; }
  .players-table-wrap { display: block; }
  .player-cards-mobile { display: none; }
}
@media (max-width: 767.98px) {
  .players-table-wrap { display: none; }
  .player-cards-mobile { display: block; }
}

/* Players table (desktop) */
.players-table tbody tr {
  cursor: pointer;
}
.players-table tbody tr:hover {
  background: rgba(62, 207, 142, 0.1);
}
.players-table a {
  color: var(--text);
  font-weight: 650;
  text-decoration: none;
}
.players-table a:hover { color: var(--accent); }

.is-hidden { display: none !important; }

/* Footer */
.site-footer {
  border-top: 1px solid var(--border-soft);
  padding: 22px 0 calc(18px + var(--safe-b));
  color: var(--muted);
  font-size: 0.8125rem;
  background: var(--bg-elev);
}
.footer-lead { margin: 0 0 8px; line-height: 1.5; }
.footer-lead strong { color: var(--text); }
.footer-note { margin: 0; }
.site-footer code {
  font-family: var(--mono);
  font-size: 0.85em;
  background: rgba(255,255,255,0.06);
  padding: 1px 5px;
  border-radius: 4px;
}
.site-footer a { color: var(--accent); }

.page-foot-hint {
  margin-top: 18px;
  color: var(--muted);
  font-size: 0.875rem;
}
"""
    # Fix typo in hit-hot color
    css = css.replace("color: #7demb8; color: #8fe8b8;", "color: #8fe8b8;")
    css += EXTRA_CSS
    (ROOT / "css" / "plan.css").write_text(css, encoding="utf-8")


def write_js():
    js = r"""(function () {
  const searchEl = document.getElementById("search");
  const teamEl = document.getElementById("filterTeam");
  const posEl = document.getElementById("filterPos");
  const countEl = document.getElementById("resultCount");
  const cards = Array.from(document.querySelectorAll("[data-player-card]"));
  const rows = Array.from(document.querySelectorAll("#playerTable tbody tr"));
  if (!cards.length && !rows.length) return;

  function norm(s) {
    return (s || "").toString().toLowerCase().trim();
  }

  function match(el) {
    const q = norm(searchEl && searchEl.value);
    const team = teamEl ? teamEl.value : "";
    const pos = posEl ? posEl.value : "";
    const name = norm(el.dataset.name);
    const t = el.dataset.team || "";
    const p = el.dataset.position || "";
    return (!q || name.includes(q)) && (!team || t === team) && (!pos || p === pos);
  }

  function apply() {
    let shown = 0;
    cards.forEach((el) => {
      const ok = match(el);
      el.classList.toggle("is-hidden", !ok);
      if (ok) shown += 1;
    });
    rows.forEach((tr) => {
      const ok = match(tr);
      tr.classList.toggle("is-hidden", !ok);
      if (ok && !cards.length) shown += 1;
    });
    if (countEl) {
      countEl.textContent = String(cards.length ? shown : shown);
    }
  }

  [searchEl, teamEl, posEl].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });

  const tbody = document.querySelector("#playerTable tbody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr[data-href]");
      if (!tr) return;
      if (e.target.closest("a")) return;
      window.location.href = tr.dataset.href;
    });
  }

  apply();
})();
"""
    (ROOT / "js" / "players.js").write_text(js, encoding="utf-8")
    (ROOT / "js" / "tabs.js").write_text(MATCHUP_JS, encoding="utf-8")


def index_stat_cells(p: dict) -> str:
    pos = p["position"]
    gp = p.get("games_played", 0)
    dash = '<td class="num muted">—</td>'
    if pos == "QB":
        return f"""
<td class="num">{gp}</td>
<td class="num">{p.get('passing_yards', 0)}</td>
<td class="num">{p.get('passing_tds', 0)}</td>
<td class="num">{p.get('completions', 0)}</td>
<td class="num">{p.get('rushing_yards', 0)}</td>
{dash}{dash}
"""
    if pos in ("RB", "FB"):
        return f"""
<td class="num">{gp}</td>
{dash}{dash}{dash}
<td class="num">{p.get('rushing_yards', 0)}</td>
<td class="num">{p.get('receptions', 0)}</td>
<td class="num">{p.get('receiving_yards', 0)}</td>
"""
    return f"""
<td class="num">{gp}</td>
{dash}{dash}{dash}{dash}
<td class="num">{p.get('receptions', 0)}</td>
<td class="num">{p.get('receiving_yards', 0)}</td>
"""


def write_matchups_home(games: list[dict], byes: list[dict]):
    cards = []
    for g in games:
        away = html_escape(g["away_team"])
        home = html_escape(g["home_team"])
        kick = html_escape(
            format_kickoff_et(
                g.get("kickoff_et") or "",
                g.get("weekday") or "",
                g.get("kickoff_time_et") or "",
                g.get("game_date") or "",
            )
        )
        stadium = html_escape(g.get("stadium") or "")
        href = f"matchups/{html_escape(g['slug'])}.html"
        div = ""
        try:
            if float(g.get("div_game") or 0) >= 1:
                div = '<span class="tag tag-dim">DIV</span>'
        except ValueError:
            pass
        cards.append(
            f"""<a class="matchup-card" href="{href}">
  <div>
    <div class="matchup-teams">
      <span class="game-team"><span class="team-dot" style="--team:{team_color(g['away_team'])}"></span>{away}</span><span class="matchup-vs">@</span><span class="game-team"><span class="team-dot" style="--team:{team_color(g['home_team'])}"></span>{home}</span>
    </div>
    <div class="matchup-meta">{kick}</div>
    {f'<div class="matchup-meta">{stadium}</div>' if stadium else ''}
  </div>
  <div class="matchup-side">
    {div}
    <span class="matchup-cta">View →</span>
  </div>
</a>"""
        )

    bye_html = ""
    if byes:
        badges = "".join(
            f'<span class="tag tag-warn">{html_escape(b["team"])}</span>'
            for b in byes
        )
        teams = ", ".join(b["team"] for b in byes)
        bye_html = f"""
<div class="bye-card">
  <div>
    <div class="bye-title">Bye week</div>
    <div class="matchup-meta">{html_escape(teams)} — no Week {MATCHUP_WEEK} game</div>
  </div>
  <div class="bye-badges">{badges}</div>
</div>"""

    body = f"""
<div class="wrap page">
  <header class="header-row">
    <div>
      <h1 class="page-title">Week {MATCHUP_WEEK} Matchups</h1>
      <p class="page-lead">{SEASON_YEAR} REG · stats thru week {SEASON_THROUGH_WEEK} · no odds</p>
    </div>
  </header>

  {bye_html}

  <div class="matchup-list">
    {''.join(cards)}
  </div>

  <p class="page-foot-hint">
    Tap a game for that matchup’s offense players. Full list under
    <a href="players.html">Players</a>.
  </p>
</div>
"""
    html = page_shell(
        f"Week {MATCHUP_WEEK} Matchups",
        body,
        home_href="index.html",
        players_href="players.html",
        css_href="css/plan.css",
        matchups_active=True,
    )
    (ROOT / "index.html").write_text(html, encoding="utf-8")


PROP_TABS = [
    (
        "passing",
        "Passing",
        [
            ("passing_yards", "Pass Yards"),
            ("completions", "Completions"),
            ("passing_tds", "Pass TDs"),
        ],
    ),
    (
        "receiving",
        "Receiving",
        [
            ("receiving_yards", "Receiving Yards"),
            ("receptions", "Receptions"),
        ],
    ),
    (
        "rushing",
        "Rushing",
        [
            ("rushing_yards", "Rush Yards"),
            ("carries", "Rush Attempts"),
        ],
    ),
]

TOP_N = 5


def tab_eligible(tab: str, p: dict) -> bool:
    s = p["season"]
    if inum(s.get("games_played")) <= 0:
        return False
    pos = p["position"]
    if tab == "passing":
        return pos == "QB" and num(s.get("attempts")) > 0
    if tab == "receiving":
        return pos in ("RB", "FB", "WR", "TE") and num(s.get("targets")) > 0
    if tab == "rushing":
        return num(s.get("carries")) > 0
    return False


def avatar_html(p: dict, size: int = 40) -> str:
    color = team_color(p["team"])
    shot = p.get("headshot_url") or ""
    inner = (
        f'<img src="{html_escape(shot)}" alt="" loading="lazy" width="{size}" height="{size}">'
        if shot
        else '<span class="avatar-ring-ph">?</span>'
    )
    return (
        f'<span class="avatar-ring" style="--team:{color}">{inner}'
        f'<span class="avatar-team-dot" title="{html_escape(p["team"])}"></span></span>'
    )


def render_market(key: str, title: str, tab: str, plist: list[dict], open_: bool) -> str:
    field = STAT_FIELDS[key]
    rows = []
    for p in plist:
        if not tab_eligible(tab, p):
            continue
        gp = inum(p["season"].get("games_played"))
        avg = num(p["season"].get(field)) / gp
        rows.append((avg, p, gp))
    rows.sort(key=lambda r: (-r[0], r[1]["full_name"]))

    if not rows:
        body = '<p class="market-empty">No players with games played for this market.</p>'
    else:
        row_html = []
        for idx, (avg, p, gp) in enumerate(rows):
            lines = ladder_thresholds(key, avg)
            a_idx = anchor_index(lines, avg)
            tiles = "".join(
                hit_tile(hit_rate(p["games"], field, t, gp), anchor=(i == a_idx))
                for i, t in enumerate(lines)
            )
            extra = " is-extra" if idx >= TOP_N else ""
            href = f"../players/{html_escape(p['slug'])}.html"
            row_html.append(
                f"""<div class="prop-row{extra}">
  <a class="prop-player" href="{href}">
    {avatar_html(p)}
    <span class="prop-player-text">
      <span class="prop-name truncate">{html_escape(p['full_name'])}</span>
      <span class="avg-pill"><span class="avg-pill-lbl">{AVG_LABELS[key]}:</span><span class="avg-pill-val">{fmt_avg(avg)}</span></span>
    </span>
  </a>
  <div class="ladder" data-ladder>{tiles}</div>
</div>"""
            )
        more = ""
        if len(rows) > TOP_N:
            more = (
                f'<button type="button" class="view-more" data-view-more '
                f'data-more-label="View More ({len(rows) - TOP_N})" data-less-label="View Less">'
                f"View More ({len(rows) - TOP_N})</button>"
            )
        body = f'<div class="prop-rows">{"".join(row_html)}</div>{more}'

    return f"""
<details class="market"{' open' if open_ else ''}>
  <summary class="market-head">
    <span class="market-title">{html_escape(title)}</span>
    <span class="chev" aria-hidden="true"></span>
  </summary>
  <div class="market-body">{body}</div>
</details>"""


def write_matchup_page(
    game: dict,
    players_by_team: dict[str, list[dict]],
):
    away = game["away_team"]
    home = game["home_team"]
    kick = format_kickoff_et(
        game.get("kickoff_et") or "",
        game.get("weekday") or "",
        game.get("kickoff_time_et") or "",
        game.get("game_date") or "",
    )
    stadium = game.get("stadium") or ""
    both = players_by_team.get(away, []) + players_by_team.get(home, [])

    tabs_html = []
    panels_html = []
    for i, (tab_id, tab_label, markets) in enumerate(PROP_TABS):
        active = i == 0
        tabs_html.append(
            f'<button type="button" class="cat-tab{" is-active" if active else ""}" role="tab" '
            f'id="tab-{tab_id}" aria-controls="panel-{tab_id}" aria-selected="{"true" if active else "false"}" '
            f'data-tab="{tab_id}">{tab_label}</button>'
        )
        sections = "".join(
            render_market(key, title, tab_id, both, open_=(j == 0))
            for j, (key, title) in enumerate(markets)
        )
        panels_html.append(
            f'<section class="cat-panel" id="panel-{tab_id}" role="tabpanel" aria-labelledby="tab-{tab_id}"'
            f'{"" if active else " hidden"}>{sections}</section>'
        )
    tabs_html.append(
        '<button type="button" class="cat-tab" role="tab" id="tab-roster" aria-controls="panel-roster" '
        'aria-selected="false" data-tab="roster">Roster</button>'
    )

    def team_block(team: str, label: str) -> str:
        plist = players_by_team.get(team, [])
        color = team_color(team)
        head = f"""<div class="team-head">
    <span class="team-chip" style="--team:{color}">{html_escape(team)}</span>
    <h2>{html_escape(label)}</h2>
    {f'<span class="team-count">{len(plist)} players</span>' if plist else ''}
  </div>"""
        if not plist:
            return f'<section class="block">{head}<p class="muted">No offense players found.</p></section>'
        cards = []
        for p in plist:
            href = f"../players/{html_escape(p['slug'])}.html"
            jersey = f"#{html_escape(str(p['jersey']))} · " if p.get("jersey") else ""
            stats = html_escape(player_card_stats_line(p))
            cards.append(
                f"""<a class="player-card" href="{href}" data-player-card
   data-name="{html_escape(p['full_name'])}" data-team="{html_escape(p['team'])}"
   data-position="{html_escape(p['position'])}" data-player-id="{html_escape(p['player_id'])}">
  {avatar_html(p, 44)}
  <div class="player-card-body">
    <div class="player-card-name truncate">{html_escape(p['full_name'])}</div>
    <div class="player-card-meta">
      <span class="pill pill-pos">{html_escape(p['position'])}</span>
      <span>{jersey}{stats}</span>
    </div>
  </div>
  <span class="player-card-chevron" aria-hidden="true">›</span>
</a>"""
            )
        return f'<section class="block">{head}<div>{"".join(cards)}</div></section>'

    panels_html.append(
        f'<section class="cat-panel roster-panel" id="panel-roster" role="tabpanel" aria-labelledby="tab-roster" hidden>'
        f'{team_block(away, "Away")}{team_block(home, "Home")}</section>'
    )

    body = f"""
<div class="wrap page page-matchup">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="../index.html" class="crumbs-back">‹ Matchups</a>
  </nav>

  <header class="game-hero">
    <div class="game-hero-teams">
      <span class="game-team"><span class="team-dot" style="--team:{team_color(away)}"></span>{html_escape(away)}</span>
      <span class="matchup-vs">@</span>
      <span class="game-team"><span class="team-dot" style="--team:{team_color(home)}"></span>{html_escape(home)}</span>
    </div>
    <p class="page-lead">{html_escape(kick)}{f' · {html_escape(stadium)}' if stadium else ''}</p>
  </header>
</div>

<div class="cat-bar">
  <div class="cat-bar-inner" role="tablist" aria-label="Stat category">
    {''.join(tabs_html)}
  </div>
</div>

<div class="wrap page page-matchup-body">
  <p class="hint ladder-hint">Tiles = hit rate (games at or above the line ÷ games_played, wks 1–{SEASON_THROUGH_WEEK}). Swipe for more lines. 0-GP players omitted.</p>
  {''.join(panels_html)}
</div>
<script src="../js/tabs.js"></script>
"""
    html = page_shell(
        f"{away} @ {home}",
        body,
        home_href="../index.html",
        players_href="../players.html",
        css_href="../css/plan.css",
        matchups_active=True,
    )
    (ROOT / "matchups" / f"{game['slug']}.html").write_text(html, encoding="utf-8")


def write_players_index(players: list[dict]):
    teams = sorted({p["team"] for p in players if p["team"]})
    positions = ["QB", "RB", "WR", "TE", "FB"]
    team_opts = "".join(
        f'<option value="{html_escape(t)}">{html_escape(t)}</option>' for t in teams
    )
    pos_opts = "".join(
        f'<option value="{html_escape(p)}">{html_escape(p)}</option>'
        for p in positions
        if any(x["position"] == p for x in players)
    )

    cards = []
    rows = []
    for p in players:
        href = html_escape(p["href"])
        jersey = f"#{html_escape(str(p['jersey']))} · " if p.get("jersey") else ""
        stats = html_escape(player_card_stats_line(p))
        img = avatar_html(p, 44)
        cards.append(
            f"""<a class="player-card" href="{href}" data-player-card
   data-name="{html_escape(p['full_name'])}" data-team="{html_escape(p['team'])}"
   data-position="{html_escape(p['position'])}" data-player-id="{html_escape(p['player_id'])}">
  {img}
  <div class="player-card-body">
    <div class="player-card-name truncate">{html_escape(p['full_name'])}</div>
    <div class="player-card-meta">
      <span class="pill pill-pos">{html_escape(p['position'])}</span>
      <span class="team-code">{html_escape(p['team'])}</span>
      <span>{jersey}{stats}</span>
    </div>
  </div>
  <span class="player-card-chevron" aria-hidden="true">›</span>
</a>"""
        )
        rows.append(
            f"""<tr data-name="{html_escape(p['full_name'])}" data-team="{html_escape(p['team'])}" data-position="{html_escape(p['position'])}" data-href="{href}">
  <td>
    <a href="{href}">{html_escape(p['full_name'])}</a>
    <div class="muted" style="font-size:0.8rem">{jersey}{html_escape(p.get('status') or '')}</div>
  </td>
  <td><span class="pill pill-pos">{html_escape(p['position'])}</span></td>
  <td class="team-code">{html_escape(p['team'])}</td>
  {index_stat_cells(p)}
</tr>"""
        )

    body = f"""
<div class="wrap page">
  <header class="header-row">
    <div>
      <h1 class="page-title">Offense Players</h1>
      <p class="page-lead">{SEASON_YEAR} REG · thru week {SEASON_THROUGH_WEEK} · stats only</p>
    </div>
    <div class="result-count">Showing <span id="resultCount">{len(players)}</span> of {len(players)}</div>
  </header>

  <div class="filter-bar">
    <div>
      <label class="filter-label" for="search">Search</label>
      <input type="search" id="search" class="filter-input" placeholder="Player name…" autocomplete="off" enterkeyhint="search">
    </div>
    <div class="filter-row">
      <div>
        <label class="filter-label" for="filterTeam">Team</label>
        <select id="filterTeam" class="filter-select">
          <option value="">All teams</option>
          {team_opts}
        </select>
      </div>
      <div>
        <label class="filter-label" for="filterPos">Position</label>
        <select id="filterPos" class="filter-select">
          <option value="">All positions</option>
          {pos_opts}
        </select>
      </div>
    </div>
  </div>

  <div class="player-cards-mobile" id="playerCards">
    {''.join(cards)}
  </div>

  <div class="panel players-table-wrap">
    <div class="scroll-x">
      <table class="data-table players-table" id="playerTable">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th class="num">GP</th>
            <th class="num">Pass Yds</th>
            <th class="num">Pass TD</th>
            <th class="num">Cmp</th>
            <th class="num">Rush Yds</th>
            <th class="num">Rec</th>
            <th class="num">Rec Yds</th>
          </tr>
        </thead>
        <tbody>
          {''.join(rows)}
        </tbody>
      </table>
    </div>
  </div>
</div>
<script src="js/players.js"></script>
"""
    html = page_shell(
        "Players",
        body,
        home_href="index.html",
        players_href="players.html",
        css_href="css/plan.css",
        players_active=True,
    )
    (ROOT / "players.html").write_text(html, encoding="utf-8")


def build():
    print("Loading data…")
    season_rows = [
        r for r in load_csv(SEASON_CSV) if r.get("position") in OFFENSE_POSITIONS
    ]
    game_rows = [
        r for r in load_csv(GAME_CSV) if r.get("position") in OFFENSE_POSITIONS
    ]
    active_map = load_active_players()
    games_sched, byes = load_matchups()

    games_by_player: dict[str, list] = defaultdict(list)
    for g in game_rows:
        games_by_player[g["player_id"]].append(g)

    season_rows.sort(
        key=lambda r: (
            r.get("team") or "",
            POS_ORDER.get(r.get("position") or "", 99),
            r.get("full_name") or "",
        )
    )

    players_out = []
    internal: dict[str, dict] = {}
    mismatches = []
    (ROOT / "players").mkdir(parents=True, exist_ok=True)
    (ROOT / "matchups").mkdir(parents=True, exist_ok=True)
    (ROOT / "data").mkdir(parents=True, exist_ok=True)
    (ROOT / "css").mkdir(parents=True, exist_ok=True)
    (ROOT / "js").mkdir(parents=True, exist_ok=True)
    (ROOT / "screenshots").mkdir(parents=True, exist_ok=True)

    for s in season_rows:
        pid = s["player_id"]
        slug = safe_slug(pid)
        active = active_map.get(pid)
        games = games_by_player.get(pid, [])
        gp = inum(s.get("games_played"))
        if gp <= 0:
            gp = len(games)
            s = dict(s)
            s["games_played"] = str(gp)

        page = render_player_page(s, games, active)
        (ROOT / "players" / f"{slug}.html").write_text(page, encoding="utf-8")

        pos = s.get("position") or ""
        entry = {
            "player_id": pid,
            "slug": slug,
            "full_name": s.get("full_name") or "",
            "team": s.get("team") or "",
            "position": pos,
            "jersey": (active or {}).get("jersey_number") or "",
            "status": (active or {}).get("status") or "",
            "headshot_url": (active or {}).get("headshot_url") or "",
            "href": f"players/{slug}.html",
            **index_key_stats(pos, s),
        }
        players_out.append(entry)
        internal[pid] = {"season": s, "games": games}
        if len(games) != gp:
            mismatches.append((s.get("full_name"), "games", len(games), gp))
        for f in STAT_FIELDS.values():
            tot = sum(num(g.get(f)) for g in games)
            if abs(tot - num(s.get(f))) > 0.01:
                mismatches.append((s.get("full_name"), f, tot, num(s.get(f))))

    (ROOT / "data" / "players.json").write_text(
        json.dumps(
            {
                "season": SEASON_YEAR,
                "season_type": "REG",
                "through_week": SEASON_THROUGH_WEEK,
                "matchup_week": MATCHUP_WEEK,
                "source": "nflverse",
                "note": "Stats only. No betting lines. Hit rates use games_played.",
                "players": players_out,
                "matchups": games_sched,
                "byes": byes,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    write_css()
    write_js()
    write_matchups_home(games_sched, byes)
    write_players_index(players_out)

    players_by_team: dict[str, list] = defaultdict(list)
    for p in players_out:
        players_by_team[p["team"]].append({**p, **internal[p["player_id"]]})
    for team in players_by_team:
        players_by_team[team].sort(
            key=lambda x: (POS_ORDER.get(x["position"], 99), x["full_name"])
        )

    for g in games_sched:
        write_matchup_page(g, players_by_team)

    print(f"Built {len(players_out)} player pages")
    print(f"Built {len(games_sched)} matchup pages + index (Week {MATCHUP_WEEK})")
    print(f"Bye teams: {[b['team'] for b in byes]}")
    print(f"Players index: players.html")
    print(f"Game-log vs season consistency issues: {len(mismatches)}")
    for m in mismatches[:15]:
        print("   ", m)


if __name__ == "__main__":
    build()
