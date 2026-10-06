# Plan — NFL play-money frontend

Next.js (App Router) + TypeScript client for **Plan**, an NFL-first play-money betting board. The board skins to FanDuel or DraftKings. The differentiator is historical prop hit rates (season, last 5, vs opponent, vs opponent last season).

Money is integer cents of play currency. Odds are American. Nothing here moves real money.

## Setup

```bash
npm install
cp .env.example .env.local   # optional; the default already points at localhost:8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/games`.

```bash
npm test          # unit + component tests
npm run lint
npm run build
```

## Pointing at the backend

The browser calls the FastAPI app directly.

| Variable | Default | Role |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API origin, no trailing slash |

Requests use `credentials: 'include'` so the httpOnly session cookie is sent, and `Authorization: Bearer` when login/signup returned an access token (kept in `sessionStorage`). The API has to allow the frontend origin with credentials.

If the API cannot be reached (connection refused, network error, timeout), the board and game pages render the built-in week 5 demo slate and show a **Demo data** badge. Quotes and bet placement stay disabled in that mode. A game id the API answers with 404 renders a not-found state instead of demo data.

Logged-out skin choice is stored in `localStorage` under `plan-skin`. Logged-in users load `theme` from `GET /api/v1/auth/me`. `null` opens the skin picker. **Switch book** sends `PATCH /api/v1/users/me/preferences`.

Deep-link a skin with `?theme=fanduel` or `?theme=draftkings` (also `?skin=`).

## Routes

| Path | What it is |
| --- | --- |
| `/` | Redirects to `/games` |
| `/games` | Week 5 board, grouped by date |
| `/games/[id]` | Game lines + props. Unknown ids show a not-found message |
| `/login`, `/signup` | Email/password via `/api/v1/auth/*` |
| `/bets` | Play-money bet history |
| `/wallet` | Balance and ledger. `?session_id=` syncs a Stripe Checkout return |
| `/promotions` | Short note on play money and tries |

The bet slip is the right-hand column (a drawer under 860px). Selections are stored in `localStorage` (`plan-slip`) and keyed like `tb-dal|spread|away` or `tb-dal|prop|godwin-rec`. Legs whose game 404s are dropped. Singles and parlays quote with `POST /bets/quote` and place with `POST /bets`. Teasers are not in the API.

## Hit rates and the paywall

Each prop can show four windows from `hitRate`: `season`, `last5`, `vsOpp`, `vsOppLastSeason`. Chips show `pct` with `hit/total` beside it. `pct: null` (total 0) is a dash. Versus-opponent windows with `total < 3` show the count only, in neutral grey. Otherwise ≥70 is high, ≥50 is mid, and below that is low. Versus labels use the API text (for example `vs DAL '25`).

`Thru Wk N` comes from `hitRateThroughWeek`. `isSample: true` shows a Sample line tag.

While `usage.paywall_enabled` is false the tries counter and locks stay hidden. When it is on, the header shows `tries_remaining` (`null` means unlimited). Locked props (`unlocked: false`) keep last 5 as a teaser and put a lock on season / vs opponent / vs opponent last season. Opening a chip calls `GET /api/v1/games/{id}/props/{propId}`. `402 UPGRADE_REQUIRED` opens **Buy more tries**, which lists packs from `GET /billing/plans` and checks out with `POST /billing/checkout-session`.

Documented prices, used if the plans call fails: 10 free tries, then 30 for $3 or 100 for $5.

## Per-book lines

`book` and `books` are optional on props. They are **not** in `openapi.json` yet. The row always renders the top-level `line`, `price`, and `hitRate`. When `book` is set and it is not the active skin, the row shows a tag such as `FanDuel line`.

## Skins

`data-theme="fanduel" | "draftkings"` on `<html>` drives the CSS variables (see the mock `THEME.md` values in `app/globals.css`).

- **FanDuel:** light board, navy rail, royal-blue header, blue odds (`#1493FF`), green CTAs, columns Spread | Money | Total.
- **DraftKings:** near-black board, green prices (`#53d337`), columns Spread | Total | Moneyline, games grouped under date bars. The bet slip stays a light card.

## Spec notes

A few places the UI is ahead of, or slightly beside, `openapi.json` (0.1.0):

- `PropOut` / `PropDetailOut` have no `book` or `books`. Typed here as optional.
- `BetType` is only `single` | `parlay`. The teasers tab is visible and disabled.
- Game list/detail are marked `HTTPBearer` in the spec, while the descriptions say auth is optional. The client sends a bearer token when it has one and still loads the board logged out.
- `GET /games/{id}/props/{propId}` is the metered call. A 404 hides that prop. The list endpoint does not 404 individual props.
- `402` `details` is an open object. The client reads `details.reason` and `details.packs` when they are present, and otherwise loads `GET /billing/plans`.
- Pack keys in the local fallback (`tries_30`, `tries_100`) are placeholders. Checkout uses whatever key `/billing/plans` (or the 402 body) returns.
- The Stripe success URL is chosen by the API. This app syncs `session_id` on `/wallet`.
- Demo game ids follow the 2026 week 5 slate (`tb-dal`, `phi-jax`, `sf-sea`, `buf-lar`, …). `nflGameId` for the Monday game uses the spec’s `LA` code (`2026_05_BUF_LA`) while the public id stays `buf-lar`.
