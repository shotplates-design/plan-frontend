/**
 * Types mirrored from openapi.json (Plan API 0.1.0).
 * `book` / `books` on props are forward-compatible and are not in the spec yet.
 */

export type Theme = "fanduel" | "draftkings";
export type SeasonType = "PRE" | "REG" | "POST";
export type GameStatus = "scheduled" | "in_progress" | "final" | "postponed" | "cancelled";
export type BetType = "single" | "parlay";
export type BetStatus = "pending" | "won" | "lost" | "push" | "void";
export type SelectionResult = "pending" | "won" | "lost" | "push" | "void";
export type WalletTxType = "signup_bonus" | "bet_stake" | "bet_payout" | "bet_refund" | "adjustment";
export type PurchaseStatus = "pending" | "paid" | "refunded" | "failed" | "expired";

export interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ErrorResponse {
  error: ErrorBody;
}

export interface UserOut {
  id: string;
  email: string;
  display_name: string | null;
  theme: Theme | null;
  created_at: string;
}

export interface UsageOut {
  paywall_enabled: boolean;
  free_limit: number;
  free_used: number;
  free_remaining: number;
  paid_balance: number;
  tries_remaining: number | null;
  unlimited: boolean;
  unlimited_until?: string | null;
  props_unlocked: number;
  reopen_scope: string;
  unlocks_reset_at?: string | null;
}

export interface MeOut extends UserOut {
  usage: UsageOut;
}

export interface AuthResponse {
  user: UserOut;
  access_token: string;
  token_type?: string;
  expires_at: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  display_name?: string | null;
  theme?: Theme | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PreferencesOut {
  theme: Theme | null;
}

export interface PreferencesUpdate {
  theme: Theme;
}

export interface TeamBrief {
  abbr: string;
  name: string;
  short: string;
  color?: string | null;
}

export interface TeamOut {
  id: string;
  abbr: string;
  location: string;
  name: string;
  conference: string;
  division: string;
  primary_color: string | null;
}

export interface SpreadSideOut {
  line: string;
  price: number;
}

export interface SpreadOut {
  away: SpreadSideOut;
  home: SpreadSideOut;
}

export interface MoneyOut {
  away: number;
  home: number;
}

export interface TotalOut {
  line: number;
  over: number;
  under: number;
}

export interface HitRateBucket {
  pct: number | null;
  hit: number;
  total: number;
}

export interface HitRateVsOpp extends HitRateBucket {
  label: string;
  season?: number | null;
  opponent?: string | null;
}

export interface HitRateOut {
  season?: HitRateBucket | null;
  last5?: HitRateBucket | null;
  vsOpp?: HitRateVsOpp | null;
  vsOppLastSeason?: HitRateVsOpp | null;
}

/** Per-book line. Not in OpenAPI yet; optional so the UI is forward-compatible. */
export interface BookLine {
  line: string;
  price: number;
  hitRate?: HitRateOut | null;
}

export interface PropBooks {
  fanduel?: BookLine | null;
  draftkings?: BookLine | null;
}

export interface PropOut {
  id: string;
  player: string;
  team: string;
  market: string;
  line: string;
  price: number;
  hitRate?: HitRateOut | null;
  selectionKey: string;
  playerId?: string | null;
  isSample?: boolean;
  lineSource?: string;
  hitRateSource?: string;
  hitRateThroughWeek?: number | null;
  unlocked?: boolean;
  locked?: string[];
  /** Which book's number the top-level line/price came from, when the API says so. */
  book?: Theme | null;
  books?: PropBooks | null;
}

export interface GameBoardOut {
  id: string;
  uuid: string;
  away: TeamBrief;
  home: TeamBrief;
  kickoff: string;
  kickoffLabel?: string | null;
  dateGroup?: string | null;
  week: number;
  season: number;
  seasonType: SeasonType;
  status: GameStatus;
  venue?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  spread?: SpreadOut | null;
  money?: MoneyOut | null;
  total?: TotalOut | null;
  nflGameId?: string | null;
  source?: string;
  linesSource?: string;
  isSampleLines?: boolean;
  props?: PropOut[];
}

export interface GameBrief {
  id: string;
  home_abbr: string;
  away_abbr: string;
  kickoff: string;
}

export interface PropDetailOut extends PropOut {
  gameId: string;
  charged: boolean;
  bucket?: string | null;
  usage: UsageOut;
}

export interface HitRateWindowOut {
  propId: string;
  window: string;
  hitRate: HitRateBucket | null;
}

export interface BetLegIn {
  selection_key?: string | null;
  selection_id?: string | null;
  odds_american: number;
  line?: string | number | null;
}

export interface BetSlipIn {
  type: BetType;
  stake_cents: number;
  legs: BetLegIn[];
  accept_odds_changes?: boolean;
}

export interface PlaceBetRequest extends BetSlipIn {
  idempotency_key?: string | null;
}

export interface QuoteLegOut {
  selection_key: string;
  selection_id?: string | null;
  market: string;
  selection_name: string;
  line: string | null;
  odds_american: number;
  requested_odds_american: number;
  odds_changed: boolean;
  game: GameBrief;
}

export interface BetQuoteOut {
  type: BetType;
  stake_cents: number;
  odds_american: number;
  odds_decimal: number;
  potential_payout_cents: number;
  potential_profit_cents: number;
  any_odds_changed: boolean;
  legs: QuoteLegOut[];
}

export interface BetLegOut {
  id: string;
  selection_key: string;
  market: string;
  selection_name: string;
  line: string | null;
  odds_american: number;
  result: SelectionResult;
  game: GameBrief;
}

export interface BetOut {
  id: string;
  type: BetType;
  status: BetStatus;
  stake_cents: number;
  odds_american: number;
  odds_decimal: number;
  potential_payout_cents: number;
  payout_cents: number | null;
  placed_at: string;
  settled_at: string | null;
  legs: BetLegOut[];
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface WalletOut {
  id: string;
  currency: string;
  balance_cents: number;
  is_play_money?: boolean;
  updated_at: string;
}

export interface WalletTransactionOut {
  id: string;
  type: WalletTxType;
  amount_cents: number;
  balance_after_cents: number;
  bet_id: string | null;
  description: string | null;
  created_at: string;
}

export interface PackOut {
  key: string;
  name: string;
  tries: number;
  unit_amount: number;
  currency?: string;
  lookup_key: string;
  price_per_try_cents: number;
  savings_pct?: number | null;
  source: "stripe" | "config";
}

export interface BillingConfigOut {
  enabled: boolean;
  stripe_ready: boolean;
  test_mode_only?: boolean;
  approval_status: string;
  publishable_key: string | null;
  offseason: Record<string, unknown>;
}

export interface PlansOut {
  model?: string;
  try_unit?: string;
  free_tries: number;
  packs: PackOut[];
  billing: BillingConfigOut;
  usage?: UsageOut | null;
}

export interface CheckoutIn {
  pack: string;
}

export interface CheckoutOut {
  checkout_url: string;
  session_id: string;
  pack: string;
  tries: number;
  unit_amount: number;
}

export interface PurchaseOut {
  id: string;
  pack: string;
  tries: number;
  amount_total: number | null;
  currency: string;
  status: PurchaseStatus;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  tries_revoked: number;
}

export interface BillingUsageOut {
  usage: UsageOut;
  purchases: PurchaseOut[];
  synced_purchase?: PurchaseOut | null;
}

export interface HealthOut {
  status: string;
  database: string;
  environment: string;
  version: string;
}

export interface ListGamesQuery {
  season?: number;
  week?: number;
  season_type?: SeasonType;
  status?: GameStatus;
  team?: string;
  include_props?: boolean;
}
