export interface SlipLeg {
  key: string;
  gameId: string;
  market: string;
  desc: string;
  price: number;
  line: string | null;
  wagerCents: number;
}

const SLIP_KEY = "plan-slip";

function isLeg(value: unknown): value is SlipLeg {
  if (!value || typeof value !== "object") return false;
  const leg = value as Partial<SlipLeg>;
  return (
    typeof leg.key === "string" &&
    typeof leg.gameId === "string" &&
    typeof leg.market === "string" &&
    typeof leg.desc === "string" &&
    typeof leg.price === "number" &&
    (leg.line === null || typeof leg.line === "string") &&
    typeof leg.wagerCents === "number"
  );
}

export function loadSlip(): SlipLeg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SLIP_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLeg);
  } catch {
    return [];
  }
}

export function saveSlip(legs: SlipLeg[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SLIP_KEY, JSON.stringify(legs));
  } catch {
    /* ignore quota */
  }
}
