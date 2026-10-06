"use client";

import { useApp } from "@/components/providers";
import { cx, formatAmerican } from "@/lib/format";
import type { SlipLeg } from "@/lib/slip";

export function OddsButton({
  leg,
  moneyOnly = false,
  className,
}: {
  leg: Omit<SlipLeg, "wagerCents">;
  moneyOnly?: boolean;
  className?: string;
}) {
  const { slip, toggleLeg } = useApp();
  const selected = slip.some((item) => item.key === leg.key);
  return (
    <button
      type="button"
      className={cx("odds-btn", className, moneyOnly && "money-only", selected && "selected")}
      aria-pressed={selected}
      onClick={() => toggleLeg(leg)}
    >
      {leg.line ? <span className="odds-line">{leg.line}</span> : null}
      <span className="odds-price">{formatAmerican(leg.price)}</span>
    </button>
  );
}

export function EmptyOdds() {
  return (
    <button type="button" className="odds-btn odds-empty" disabled>
      <span className="odds-line">—</span>
    </button>
  );
}
