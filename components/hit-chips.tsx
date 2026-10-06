"use client";

import { chipView, isWindowLocked, type WindowKind } from "@/lib/hit-rate";
import type { HitRateBucket, HitRateVsOpp, PropOut } from "@/lib/types";

function LockIcon() {
  return (
    <svg className="lock-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"
      />
    </svg>
  );
}

const WINDOWS: Array<{
  key: string;
  lockKey: string;
  kind: WindowKind;
  label: string;
  pick: (prop: PropOut) => HitRateBucket | HitRateVsOpp | null | undefined;
}> = [
  { key: "season", lockKey: "season", kind: "season", label: "Season", pick: (prop) => prop.hitRate?.season },
  { key: "last5", lockKey: "last5", kind: "last5", label: "Last 5", pick: (prop) => prop.hitRate?.last5 },
  {
    key: "vsOpp",
    lockKey: "vs_opponent",
    kind: "vs",
    label: "vs Opp",
    pick: (prop) => prop.hitRate?.vsOpp,
  },
  {
    key: "vsOppLastSeason",
    lockKey: "vs_opponent_last_season",
    kind: "vs",
    label: "vs Opp LY",
    pick: (prop) => prop.hitRate?.vsOppLastSeason,
  },
];

export function HitChips({ prop, onOpen }: { prop: PropOut; onOpen: (propId: string) => void }) {
  return (
    <div className="chip-row">
      {WINDOWS.map((window) => {
        const data = window.pick(prop);
        const locked = isWindowLocked(prop.locked, window.lockKey, prop.unlocked);
        const view = chipView(data, { kind: window.kind, locked, label: window.label });
        if (view.mode === "hidden") return null;
        const described =
          view.mode === "locked"
            ? `${view.label} locked`
            : view.mode === "dash"
              ? `${view.label} no games`
              : `${view.label} ${view.primary} ${view.secondary}`.trim();
        return (
          <button
            key={window.key}
            type="button"
            className={`hit-chip ${view.band}`}
            data-mode={view.mode}
            onClick={() => onOpen(prop.id)}
            aria-label={described}
          >
            {view.mode === "locked" ? <LockIcon /> : <span className="hit-chip-pct">{view.primary}</span>}
            {view.secondary ? <span className="hit-chip-frac">{view.secondary}</span> : null}
            <span className="hit-chip-label">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}
