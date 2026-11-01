# GameQueue

Personal games backlog manager: queue, wishlist, archive, and the cheapest way to buy each game.
Installable as an app (PWA) on phones and desktop. Hosted on Cloudflare Pages with D1 (SQLite).

## Local Development

```bash
npm install

# Initialize local D1 database (first time only)
npx wrangler d1 execute gamequeue-db --local --file=./migrations/0001_init.sql
npx wrangler d1 execute gamequeue-db --local --file=./migrations/0002_prices_images_settings.sql

# Build, then serve the build + Functions + local D1
npm run build
npx wrangler pages dev dist

# Open http://localhost:8788
```

Secrets for local dev go in `.dev.vars`:

```
STEAM_API_KEY=...
ITAD_API_KEY=...
```

## Deploy

Deploys go out with wrangler, not from GitHub. The Pages project (`games`) is still linked to the repo
because Cloudflare can't unlink it without deleting the project, but its Git builds are switched off,
so pushing never deploys.

```bash
npm run deploy           # build + upload to production (games.mykinsky.org)
npm run deploy:preview   # build + upload to preview.games-8wk.pages.dev
```

### 1. Run the migration (once, before the first deploy of v0.2)

```bash
npm run db:migrate
```

This adds the price/offer columns and the `settings` table, and clears key prices produced
by the old scraper (they were often Steam *account* offers, not keys). They refill on the next refresh.

### 2. Environment variables (Pages → Settings → Environment variables)

| Name | Needed for |
|---|---|
| `STEAM_API_KEY` | Library import, resolving vanity profile URLs |
| `ITAD_API_KEY` | Official-store deals and historical lows from IsThereAnyDeal (free key: https://isthereanydeal.com/apps/my/) |

Without `ITAD_API_KEY` everything still works; you just get keyforsteam keyshop prices and Steam prices only.

### 3. Price cron Worker (once, and again when server/ code changes)

Pages Functions can't run cron triggers, so a tiny separate Worker refreshes prices every 10 minutes
(one batch of 12 games per run) against the same D1 database:

```bash
npm run cron:deploy
npx wrangler secret put ITAD_API_KEY --config workers/price-cron/wrangler.toml
```

If the Worker isn't deployed, the app still refreshes one batch each time it's opened.

## How prices work

- **Steam price**: refreshed from Steam's batched `IStoreBrowseService/GetItems` API.
- **Keyshops** (keyforsteam): parsed from the page's embedded offer list; only in-stock *keys* for Global/EU
  regions count. Accounts and region-locked keys are ignored.
- **Official store deals** (IsThereAnyDeal): best current price across Steam, GOG, Humble, Fanatical, GMG, etc. in CHF.
- Refreshes work in small batches of the stalest games, so a big library never times out a request.
  keyforsteam rate-limits bursts, so a circuit breaker backs off and retries those games ~30 min later.

## Covers

New Steam apps use hashed asset URLs (the old `/steam/apps/{id}/header.jpg` 404s). When a cover fails to load,
the client asks `/api/images/repair`, which tries Steam store assets → the game's own store page (`og:image`)
→ Steam search by name → IsThereAnyDeal art, and saves what it finds. If nothing exists, a generated cover is drawn.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, vite-plugin-pwa |
| Backend | Cloudflare Pages Functions (`functions/`), shared logic in `server/` |
| Cron | Cloudflare Worker (`workers/price-cron/`) |
| Database | Cloudflare D1 (SQLite) |
| Drag & Drop | @dnd-kit |
| Game data | Steam Store APIs, SteamSpy, keyforsteam.de, IsThereAnyDeal |
