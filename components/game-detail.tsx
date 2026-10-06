"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GameLines } from "@/components/game-lines";
import { HitChips } from "@/components/hit-chips";
import { OddsButton } from "@/components/odds-button";
import { useApp } from "@/components/providers";
import { api, isApiError, isUnreachable } from "@/lib/api";
import { demoGame } from "@/lib/demo-data";
import { bookDisplayName, columnLabels, formatAmerican } from "@/lib/format";
import { chipView, isWindowLocked, type WindowKind } from "@/lib/hit-rate";
import { packsFromDetails, reasonFromDetails } from "@/lib/paywall";
import type { GameBoardOut, PropDetailOut, PropOut, Theme } from "@/lib/types";

function bookTag(prop: PropOut, theme: Theme | null): string | null {
  if (!prop.book || !theme || prop.book === theme) return null;
  return `${bookDisplayName(prop.book)} line`;
}

export function GameDetail({ id }: { id: string }) {
  const router = useRouter();
  const { theme, apiMode, user, noteLive, noteDemo, openPaywall, setUsage } = useApp();
  const skin = theme ?? "fanduel";
  const labels = columnLabels(skin);
  const [game, setGame] = useState<GameBoardOut | null>(null);
  const [demo, setDemo] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PropDetailOut | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancel = false;
    setStatus("loading");
    setError(null);
    setHidden(new Set());
    setOpenId(null);
    setDetail(null);

    const applyDemo = () => {
      const sample = demoGame(id);
      if (cancel) return;
      if (!sample) {
        setStatus("missing");
        setGame(null);
        return;
      }
      setGame(sample);
      setDemo(true);
      setStatus("ready");
    };

    if (apiMode === "demo") {
      applyDemo();
      return;
    }

    void (async () => {
      try {
        const loaded = await api.getGame(id);
        let props = loaded.props;
        if (!props) {
          try {
            props = await api.getProps(id);
          } catch (err) {
            if (isApiError(err) && err.status === 404) props = [];
            else throw err;
          }
        }
        if (cancel) return;
        noteLive();
        setGame({ ...loaded, props: props ?? [] });
        setDemo(false);
        setStatus("ready");
      } catch (err) {
        if (cancel) return;
        if (isUnreachable(err)) {
          noteDemo();
          applyDemo();
          return;
        }
        if (isApiError(err) && err.status === 404) {
          setGame(null);
          setStatus("missing");
          return;
        }
        setStatus("error");
        setError(isApiError(err) ? err.message : "Could not load this game.");
      }
    })();

    return () => {
      cancel = true;
    };
  }, [id, apiMode, noteDemo, noteLive]);

  const sections = useMemo(() => {
    const props = (game?.props ?? []).filter((prop) => !hidden.has(prop.id));
    const order: string[] = [];
    const map = new Map<string, PropOut[]>();
    for (const prop of props) {
      if (!map.has(prop.market)) {
        map.set(prop.market, []);
        order.push(prop.market);
      }
      map.get(prop.market)!.push(prop);
    }
    return order.map((market) => ({ market, props: map.get(market)! }));
  }, [game, hidden]);

  async function openProp(propId: string) {
    setOpenId(propId);
    setDetailError(null);
    const current = game?.props?.find((prop) => prop.id === propId);
    if (!current) return;
    if (demo || apiMode === "demo") {
      setDetail(null);
      return;
    }
    if (!user) {
      if (current.unlocked === false) {
        router.push(`/login?next=${encodeURIComponent(`/games/${id}`)}`);
      }
      setDetail(null);
      return;
    }
    setOpening(true);
    try {
      const next = await api.getProp(id, propId);
      setDetail(next);
      setUsage(next.usage);
      setGame((prev) =>
        prev
          ? {
              ...prev,
              props: (prev.props ?? []).map((prop) =>
                prop.id === next.id
                  ? {
                      ...prop,
                      ...next,
                      hitRate: next.hitRate,
                      unlocked: next.unlocked,
                      locked: next.locked,
                    }
                  : prop,
              ),
            }
          : prev,
      );
    } catch (err) {
      if (isApiError(err) && err.status === 402) {
        openPaywall(reasonFromDetails(err.details) ?? err.code, packsFromDetails(err.details));
        return;
      }
      if (isApiError(err) && err.status === 404) {
        setHidden((prev) => new Set(prev).add(propId));
        setOpenId(null);
        setDetailError("That prop is no longer posted.");
        return;
      }
      if (isApiError(err) && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/games/${id}`)}`);
        return;
      }
      setDetailError(isApiError(err) ? err.message : "Could not open that prop.");
    } finally {
      setOpening(false);
    }
  }

  if (status === "loading") return <p className="loading-note">Loading game…</p>;
  if (status === "missing") {
    return (
      <div className="page-card not-found">
        <h1>Game not found</h1>
        <p>No matchup is posted for “{id}”. It may have left the slate.</p>
        <Link href="/games" className="back-link">
          ‹ Back to NFL Odds
        </Link>
      </div>
    );
  }
  if (status === "error" || !game) {
    return (
      <div className="page-card">
        <p className="error-text">{error || "Could not load this game."}</p>
        <Link href="/games" className="back-link">
          ‹ Back to NFL Odds
        </Link>
      </div>
    );
  }

  const at = skin === "fanduel" ? "@" : "AT";

  return (
    <div className="game-detail visible">
      <Link href="/games" className="back-link">
        ‹ Back to NFL Odds
      </Link>
      <div className="breadcrumb">
        NFL / {game.away.abbr} @ {game.home.abbr}
      </div>
      <div className="matchup-hero">
        <div className="hero-team">
          <div className="team-logo" style={{ background: game.away.color || "#334155" }}>
            {game.away.abbr}
          </div>
          <div className="hero-team-name">{game.away.short}</div>
        </div>
        <div className="hero-center">
          <div className="hero-vs">{at}</div>
          <div className="hero-meta">{game.kickoffLabel || game.kickoff}</div>
          {game.venue ? <div className="hero-meta">{game.venue}</div> : null}
          {game.status === "final" && game.awayScore != null && game.homeScore != null ? (
            <div className="hero-score">
              {game.awayScore} – {game.homeScore}
            </div>
          ) : null}
        </div>
        <div className="hero-team">
          <div className="team-logo" style={{ background: game.home.color || "#334155" }}>
            {game.home.abbr}
          </div>
          <div className="hero-team-name">{game.home.short}</div>
        </div>
      </div>
      {demo ? (
        <div className="demo-banner">
          <span className="demo-badge">Demo data</span>
          Hit-rate chips are illustrative. Open a chip for season, last 5, and versus the opponent.
        </div>
      ) : (
        <div className="demo-banner live-note">
          Hit rates use the posted line. Open a chip for the full split. Sample lines are tagged.
        </div>
      )}
      {detailError ? <p className="error-text">{detailError}</p> : null}
      <div className="prop-section">
        <div className="prop-section-title">
          <span>Game Lines</span>
        </div>
        <div className="game-card">
          <div className="col-headers detail-cols">
            <span />
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <GameLines game={game} />
        </div>
      </div>
      {sections.length === 0 ? <p className="loading-note">No props posted for this game.</p> : null}
      {sections.map((section) => {
        const isCollapsed = collapsed.has(section.market);
        return (
          <div key={section.market} className={isCollapsed ? "prop-section collapsed" : "prop-section"}>
            <button
              type="button"
              className="prop-section-title"
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(section.market)) next.delete(section.market);
                  else next.add(section.market);
                  return next;
                })
              }
            >
              <span>{section.market}</span>
              <span className="chev">▼</span>
            </button>
            <div className="prop-rows">
              {section.props.map((prop) => {
                const shown = detail && detail.id === prop.id ? { ...prop, ...detail } : prop;
                return (
                  <div key={prop.id} className="prop-block">
                    <div className="prop-row">
                      <div className="prop-info">
                        <div className="prop-player">
                          {shown.player} <span className="prop-team">{shown.team}</span>
                        </div>
                        <div className="prop-market">
                          <span>{shown.market}</span>
                          {typeof shown.hitRateThroughWeek === "number" ? (
                            <span className="thru-wk">Thru Wk {shown.hitRateThroughWeek}</span>
                          ) : null}
                          {shown.isSample ? <span className="sample-tag">Sample line</span> : null}
                          {bookTag(shown, theme) ? <span className="book-tag">{bookTag(shown, theme)}</span> : null}
                        </div>
                      </div>
                      <HitChips prop={shown} onOpen={(propId) => void openProp(propId)} />
                      <div className="prop-odds-wrap">
                        <OddsButton
                          className="prop-odds-btn"
                          leg={{
                            key: shown.selectionKey,
                            gameId: game.id,
                            market: shown.market,
                            desc: `${shown.player} ${shown.line}`,
                            price: shown.price,
                            line: shown.line,
                          }}
                        />
                      </div>
                    </div>
                    {openId === prop.id ? (
                      <PropPanel prop={shown} opening={opening} charged={detail?.id === prop.id ? detail.charged : false} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PropPanel({ prop, opening, charged }: { prop: PropOut; opening: boolean; charged: boolean }) {
  const rows: Array<{
    label: string;
    kind: WindowKind;
    lockKey: string;
    data: { pct: number | null; hit: number; total: number; label?: string } | null;
  }> = [
    { label: "Season", kind: "season", lockKey: "season", data: prop.hitRate?.season ?? null },
    { label: "Last 5", kind: "last5", lockKey: "last5", data: prop.hitRate?.last5 ?? null },
    { label: "vs Opp", kind: "vs", lockKey: "vs_opponent", data: prop.hitRate?.vsOpp ?? null },
    {
      label: "vs Opp LY",
      kind: "vs",
      lockKey: "vs_opponent_last_season",
      data: prop.hitRate?.vsOppLastSeason ?? null,
    },
  ];

  return (
    <div className="prop-panel" role="region" aria-label={`${prop.player} hit rates`}>
      <div className="hit-panel-title">
        {prop.player} · {prop.line} · {formatAmerican(prop.price)}
      </div>
      {rows.map((row) => {
        const locked = isWindowLocked(prop.locked, row.lockKey, prop.unlocked);
        const view = chipView(row.data, { kind: row.kind, locked, label: row.label });
        if (view.mode === "hidden") return null;
        const value =
          view.mode === "locked"
            ? "Locked"
            : view.mode === "count"
              ? view.primary
              : view.mode === "dash"
                ? `— (${view.secondary})`
                : `${view.primary} (${view.secondary})`;
        return (
          <div key={row.lockKey} className="hit-panel-row">
            <span className="label">{view.label}</span>
            <span className={`val ${view.band}`}>{value}</span>
          </div>
        );
      })}
      {opening ? <p className="hit-panel-demo">Opening prop detail…</p> : null}
      {charged ? <p className="hit-panel-demo">1 try used. Reopening this prop today is free.</p> : null}
      {prop.hitRateSource === "sample" || prop.isSample ? (
        <p className="hit-panel-demo">Sample hit rates — not a live feed.</p>
      ) : (
        <p className="hit-panel-demo">Full split from Plan. Reopening the same day does not use another try.</p>
      )}
    </div>
  );
}
