import type { HitRateBucket, HitRateVsOpp } from "@/lib/types";

export type WindowKind = "season" | "last5" | "vs";
export type ChipMode = "percent" | "count" | "dash" | "locked" | "hidden";
export type HitBand = "high" | "mid" | "low" | "neutral" | "locked";

export interface ChipView {
  mode: ChipMode;
  primary: string;
  secondary: string;
  band: HitBand;
  label: string;
}

type WindowData = (HitRateBucket | HitRateVsOpp) | null | undefined;

/**
 * How one hit-rate window should render.
 * vs-opponent windows with total < 3 show the count only, in neutral grey.
 * pct null (or total 0) is a dash. Locked windows hide the numbers.
 */
export function chipView(
  data: WindowData,
  opts: { kind: WindowKind; locked: boolean; label: string },
): ChipView {
  const apiLabel =
    opts.kind === "vs" && data && "label" in data && data.label ? data.label : opts.label;

  if (opts.locked) {
    return { mode: "locked", primary: "", secondary: "", band: "locked", label: apiLabel };
  }
  if (data == null) {
    return { mode: "hidden", primary: "", secondary: "", band: "neutral", label: apiLabel };
  }
  if (data.total === 0 || data.pct == null) {
    return {
      mode: "dash",
      primary: "—",
      secondary: `${data.hit}/${data.total}`,
      band: "neutral",
      label: apiLabel,
    };
  }
  if (opts.kind === "vs" && data.total < 3) {
    return {
      mode: "count",
      primary: `${data.hit}/${data.total}`,
      secondary: "",
      band: "neutral",
      label: apiLabel,
    };
  }
  const band: HitBand = data.pct >= 70 ? "high" : data.pct >= 50 ? "mid" : "low";
  return {
    mode: "percent",
    primary: `${data.pct}%`,
    secondary: `${data.hit}/${data.total}`,
    band,
    label: apiLabel,
  };
}

export function isWindowLocked(locked: string[] | undefined, lockKey: string, unlocked: boolean | undefined): boolean {
  if (unlocked === false && (locked ?? []).includes(lockKey)) return true;
  if (unlocked === false && lockKey !== "last5" && (locked == null || locked.length === 0)) {
    return lockKey !== "last5";
  }
  return false;
}
