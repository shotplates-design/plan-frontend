import type { Theme } from "@/lib/types";

export type MarketCol = "spread" | "money" | "total";
export type Side = "away" | "home";
export type TotalSide = "over" | "under";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** American odds, with a leading plus and a minus that matches the mock. */
export function formatAmerican(odds: number): string {
  const n = Math.round(odds);
  if (n > 0) return `+${n}`;
  return String(n).replace("-", "−");
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function dollarsToCents(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function centsToDollarInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function americanToDecimal(odds: number): number {
  if (odds > 0) return 1 + odds / 100;
  if (odds < 0) return 1 + 100 / Math.abs(odds);
  return 1;
}

export function decimalToAmerican(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1) return 0;
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

export function parlayAmerican(prices: number[]): number {
  const decimal = prices.reduce((acc, price) => acc * americanToDecimal(price), 1);
  return decimalToAmerican(decimal);
}

/** Profit only (payout minus stake), rounded to the nearest cent. */
export function profitCents(stakeCents: number, american: number): number {
  const payout = Math.round(stakeCents * americanToDecimal(american));
  return payout - stakeCents;
}

export function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const ET: Intl.DateTimeFormatOptions = { timeZone: "America/New_York" };

function parts(iso: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat("en-US", { ...ET, ...options }).formatToParts(new Date(iso));
}

function part(list: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return list.find((item) => item.type === type)?.value ?? "";
}

export function dateGroupLabel(iso: string): string {
  const list = parts(iso, { weekday: "short", month: "short", day: "numeric" });
  const weekday = part(list, "weekday").toUpperCase();
  const month = part(list, "month").toUpperCase();
  const day = Number(part(list, "day"));
  return `${weekday} ${month} ${ordinal(day)}`;
}

export function kickoffLabelFromIso(iso: string): string {
  const list = parts(iso, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const weekday = part(list, "weekday").toUpperCase();
  const hour = part(list, "hour");
  const minute = part(list, "minute");
  const period = part(list, "dayPeriod").replace(/\s/g, "").toUpperCase();
  return `${weekday} ${hour}:${minute}${period} ET`;
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    ...ET,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function marketColumns(theme: Theme): MarketCol[] {
  return theme === "fanduel" ? ["spread", "money", "total"] : ["spread", "total", "money"];
}

export function columnLabels(theme: Theme): string[] {
  return theme === "fanduel" ? ["SPREAD", "MONEY", "TOTAL"] : ["Spread", "Total", "Moneyline"];
}

export function bookDisplayName(book: string): string {
  if (book === "fanduel") return "FanDuel";
  if (book === "draftkings") return "DraftKings";
  return book;
}

export function spreadKey(gameId: string, side: Side): string {
  return `${gameId}|spread|${side}`;
}

export function moneyKey(gameId: string, side: Side): string {
  return `${gameId}|money|${side}`;
}

export function totalKey(gameId: string, side: TotalSide): string {
  return `${gameId}|total|${side}`;
}

export function propKey(gameId: string, propId: string): string {
  return `${gameId}|prop|${propId}`;
}
