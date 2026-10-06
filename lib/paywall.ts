import type { PackOut } from "@/lib/types";

/** Documented prices when /billing/plans cannot be loaded: 30 for $3, 100 for $5. */
export const FALLBACK_PACKS: PackOut[] = [
  {
    key: "tries_30",
    name: "30 tries",
    tries: 30,
    unit_amount: 300,
    currency: "usd",
    lookup_key: "tries_30",
    price_per_try_cents: 10,
    savings_pct: null,
    source: "config",
  },
  {
    key: "tries_100",
    name: "100 tries",
    tries: 100,
    unit_amount: 500,
    currency: "usd",
    lookup_key: "tries_100",
    price_per_try_cents: 5,
    savings_pct: 50,
    source: "config",
  },
];

export function reasonFromDetails(details: unknown): string | null {
  if (!details || typeof details !== "object" || !("reason" in details)) return null;
  const reason = (details as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason : null;
}

export function packsFromDetails(details: unknown): PackOut[] | null {
  if (!details || typeof details !== "object" || !("packs" in details)) return null;
  const packs = (details as { packs?: unknown }).packs;
  if (!Array.isArray(packs)) return null;
  const parsed: PackOut[] = [];
  for (const item of packs) {
    if (!item || typeof item !== "object") continue;
    const pack = item as Partial<PackOut>;
    if (typeof pack.key !== "string" || typeof pack.tries !== "number" || typeof pack.unit_amount !== "number") {
      continue;
    }
    parsed.push({
      key: pack.key,
      name: typeof pack.name === "string" ? pack.name : pack.key,
      tries: pack.tries,
      unit_amount: pack.unit_amount,
      currency: pack.currency ?? "usd",
      lookup_key: typeof pack.lookup_key === "string" ? pack.lookup_key : pack.key,
      price_per_try_cents: typeof pack.price_per_try_cents === "number" ? pack.price_per_try_cents : 0,
      savings_pct: typeof pack.savings_pct === "number" ? pack.savings_pct : null,
      source: pack.source === "stripe" ? "stripe" : "config",
    });
  }
  return parsed.length ? parsed : null;
}
