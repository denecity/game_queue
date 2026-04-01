# GameQueue

Personal game backlog manager. Built with React + Vite + TypeScript + Tailwind, hosted on Cloudflare Pages with D1 (SQLite).

## Local Development

```bash
npm install

# Initialize local D1 database (first time only)
npx wrangler d1 execute gamequeue-db --local --file=./migrations/0001_init.sql

# Start dev servers (Vite on 5173 + wrangler on 8788)
npm run dev          # terminal 1
npm run pages:dev    # terminal 2

# Open http://localhost:8788
```

## Deploy to Cloudflare Pages

### 1. Create D1 database

```bash
npx wrangler d1 create gamequeue-db
```

Paste the returned `database_id` into `wrangler.toml`.

### 2. Run the migration

```bash
npx wrangler d1 execute gamequeue-db --remote --file=./migrations/0001_init.sql
```

### 3. Deploy

**Option A — via Git (recommended)**
1. Push this repo to GitHub.
2. In Cloudflare Dashboard → **Pages** → **Create a project** → Connect GitHub repo.
3. Set:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Add D1 binding in Pages → **Settings** → **Functions** → **D1 database bindings**:
   - Variable name: `DB`
   - D1 database: `gamequeue-db`
5. Deploy.

**Option B — direct**
```bash
npm run build
npx wrangler pages deploy dist
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |
| Drag & Drop | @dnd-kit |
| Game data | Steam Store API, SteamSpy, keyforsteam.de |
