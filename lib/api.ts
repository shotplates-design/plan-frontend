import type {
  AuthResponse,
  BetOut,
  BetQuoteOut,
  BetSlipIn,
  BillingUsageOut,
  CheckoutIn,
  CheckoutOut,
  ErrorResponse,
  GameBoardOut,
  HealthOut,
  HitRateWindowOut,
  ListGamesQuery,
  LoginRequest,
  MeOut,
  Page,
  PlaceBetRequest,
  PlansOut,
  PreferencesOut,
  PreferencesUpdate,
  PropDetailOut,
  PropOut,
  SignupRequest,
  TeamOut,
  WalletOut,
  WalletTransactionOut,
} from "@/lib/types";

export type {
  AuthResponse,
  BetOut,
  BetQuoteOut,
  GameBoardOut,
  MeOut,
  PackOut,
  PlansOut,
  PropDetailOut,
  PropOut,
  Theme,
  UsageOut,
  WalletOut,
} from "@/lib/types";

const TOKEN_KEY = "plan-token";

export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return raw.replace(/\/$/, "");
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Network failure or timeout — the UI should fall back to demo data. */
export function isUnreachable(err: unknown): boolean {
  return isApiError(err) && err.code === "NETWORK";
}

export function parseError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object" && "error" in body) {
    const envelope = body as ErrorResponse;
    const error = envelope.error;
    if (error && typeof error === "object" && typeof error.message === "string") {
      return new ApiError(status, error.code || "ERROR", error.message, error.details ?? null);
    }
  }
  return new ApiError(status, `HTTP_${status}`, `Request failed (${status}).`, body);
}

function queryString(query: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "The Plan API is unreachable.", null);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) throw parseError(response.status, parsed);
  return parsed as T;
}

export const api = {
  health: () => request<HealthOut>("GET", "/api/v1/health"),

  signup: (body: SignupRequest) => request<AuthResponse>("POST", "/api/v1/auth/signup", body),
  login: (body: LoginRequest) => request<AuthResponse>("POST", "/api/v1/auth/login", body),
  logout: () => request<void>("POST", "/api/v1/auth/logout"),
  me: () => request<MeOut>("GET", "/api/v1/auth/me"),

  getPreferences: () => request<PreferencesOut>("GET", "/api/v1/users/me/preferences"),
  updatePreferences: (body: PreferencesUpdate) =>
    request<PreferencesOut>("PATCH", "/api/v1/users/me/preferences", body),

  listTeams: () => request<TeamOut[]>("GET", "/api/v1/teams"),

  listGames: (query: ListGamesQuery = {}) =>
    request<GameBoardOut[]>("GET", `/api/v1/games${queryString({ ...query })}`),

  getGame: (gameId: string) =>
    request<GameBoardOut>("GET", `/api/v1/games/${encodeURIComponent(gameId)}`),

  getProps: (gameId: string) =>
    request<PropOut[]>("GET", `/api/v1/games/${encodeURIComponent(gameId)}/props`),

  getProp: (gameId: string, propId: string) =>
    request<PropDetailOut>(
      "GET",
      `/api/v1/games/${encodeURIComponent(gameId)}/props/${encodeURIComponent(propId)}`,
    ),

  getHitRateWindow: (gameId: string, propId: string, window: "L5" | "season") =>
    request<HitRateWindowOut>(
      "GET",
      `/api/v1/games/${encodeURIComponent(gameId)}/props/${encodeURIComponent(propId)}/hit-rates${queryString({ window })}`,
    ),

  getVsOpponent: (gameId: string, propId: string) =>
    request<HitRateWindowOut>(
      "GET",
      `/api/v1/games/${encodeURIComponent(gameId)}/props/${encodeURIComponent(propId)}/splits/vs-opponent`,
    ),

  quoteBet: (body: BetSlipIn) => request<BetQuoteOut>("POST", "/api/v1/bets/quote", body),
  placeBet: (body: PlaceBetRequest) => request<BetOut>("POST", "/api/v1/bets", body),
  listBets: (query: { status?: string; limit?: number; offset?: number } = {}) =>
    request<Page<BetOut>>("GET", `/api/v1/bets${queryString(query)}`),
  getBet: (betId: string) => request<BetOut>("GET", `/api/v1/bets/${encodeURIComponent(betId)}`),

  wallet: () => request<WalletOut>("GET", "/api/v1/wallet"),
  transactions: (query: { limit?: number; offset?: number } = {}) =>
    request<Page<WalletTransactionOut>>("GET", `/api/v1/wallet/transactions${queryString(query)}`),

  plans: () => request<PlansOut>("GET", "/api/v1/billing/plans"),
  checkout: (body: CheckoutIn) => request<CheckoutOut>("POST", "/api/v1/billing/checkout-session", body),
  usage: (sessionId?: string) =>
    request<BillingUsageOut>("GET", `/api/v1/billing/usage${queryString({ session_id: sessionId })}`),
};
