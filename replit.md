# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── color-fill-game/    # React/Vite hyper-casual mobile game
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/color-fill-game` (`@workspace/color-fill-game`)

React + Vite hyper-casual mobile game (flood-fill grid, 30 levels, full UI). Served at `/`.

**Key source files:**
- `src/App.tsx` — screen router (menu → levelselect → game → settings)
- `src/pages/game.tsx` — main game logic: wave flood-fill, rAF canvas renderer, power-ups, coins, pause, win/loss
- `src/pages/MenuScreen.tsx` — animated color-grid background, coin badge, Play/Settings
- `src/pages/LevelSelect.tsx` — 30 levels in Easy/Medium/Hard tiers, star display, coin display
- `src/pages/SettingsScreen.tsx` — iOS toggles (sound/music/vibration/colorblind), Shop section, Reset Progress
- `src/lib/levels.ts` — level progress, star tracking, localStorage
- `src/lib/coins.ts` — coin system (loadCoins, saveCoins, earnCoins, addWatchAdCoins)
- `src/lib/settings.ts` — settings persistence

**Features:**
- Flood-fill gameplay with wave animation, combo system, score floaters
- 3 difficulty configs: Easy (8×8/25 moves/60s), Medium (10×10/22 moves/45s), Hard (14×14/28 moves/35s + orange)
- 30-level progression with star ratings (3★ needs >40% moves AND time remaining)
- **Coin economy:** Start with 100 coins; earn 10/25/50 for 1/2/3 star completions; spend on power-ups
- **Power-ups (3 per game):**
  - ❄️ Freeze (20 coins, max 3): halts countdown for 5 seconds, ice-blue timer display
  - 💡 Hint (15 coins, max 3): flashes best color button 3× with gold glow
  - 💣 Bomb (30 coins, max 2): force-converts 3×3 area at centroid of uncaptured region
- **Shop** in Settings: current balance, power-up cost reference, "Watch Ad for +50 coins" placeholder
- Colorblind mode: shapes inside cells (circle=red, square=blue, triangle=green, diamond=yellow, star=purple, cross=orange)
- Pause overlay: Resume/Restart/Settings/Quit
- Win screen: animated stars, NEW BEST badge, coin earn display, confetti on 3★
- Coin display in menu, level select, and in-game (top-right)
- All localStorage keys: `cf_best_easy/medium/hard`, `cf_progress_v1`, `cf_overall_best`, `cf_settings_v1`, `cf_coins_v1`, `cf_coins_init`

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
