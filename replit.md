# LESAVI VI · Witel Suramadu — AM Dashboard

## Overview

Dashboard monitoring performa Account Manager (AM) Telkom Witel Suramadu. Dibangun sebagai pnpm monorepo TypeScript dengan React frontend dan Express backend.

Source code di-clone dari: https://github.com/portodit/LESAVI-SURAMADU.git
# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
<<<<<<< HEAD
- **Frontend**: React 19 + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Session-based (express-session + bcryptjs)

## Fitur

- **Dashboard Performa** — ranking AM, target vs realisasi revenue
- **Sales Funnel** — tracking pipeline F0–F5 per AM & divisi (DPS/DSS)
- **Activity Monitoring** — kunjungan dan aktivitas AM harian/bulanan
- **Import Data** — upload Excel/CSV + sinkronisasi Google Drive otomatis
- **Telegram Bot** — pengingat jadwal kunjungan & laporan KPI harian
- **Presentation Mode** — tampilan ringkasan real-time untuk rapat
- **Corporate Customer** — tabel pelanggan korporat

## Struktur Artifacts

- `artifacts/api-server` — Express 5 backend (port 8080, path `/api`)
- `artifacts/lesavi-dashboard` — React 19 + Vite frontend (port auto, path `/`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/api-server run seed` — seed database with initial data

## Default Login

- Email: `admin@telkom.co.id`
- Password: `admin123` (atau sesuai default seed)

## Database

PostgreSQL dengan schema:
- `admin_users` — user admin
- `account_managers` — data AM
- `performance_data` — data performa revenue
- `sales_funnel` — data pipeline sales
- `sales_activity` — data aktivitas kunjungan
- `data_imports` — riwayat import data
- `app_settings` — pengaturan aplikasi
- `telegram_bot_users` — user Telegram terdaftar
- `telegram_logs` — log pengiriman Telegram

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
=======
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
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

## Sales Funnel Import Logic (PENTING)

### Target Data: PIVOT F Excel MyTENS Suramadu
- **Total target**: 362 LOP (DSS=120, DPS=242), Nilai Rp 201,857,949,498
- **11 AM aktif Witel Suramadu**: ANA, CAESAR, ERVINA, HANDIKA, HAVEA, NADYA, NI MADE, NYARI, SAFIRINA, VIVIN, WILDAN
- **Active snapshot**: ID 67, snapshotDate=2026-04-14, file=MyTENS_Sales_Funnel_Form_140426_1776792658239.xlsx
- **filterKontrak default**: `{GTMA, Own Channel}` (tidak termasuk "New GTMA" atau lainnya)

### Kunci Import: `cleanFunnelRows` Options
Di `artifacts/api-server/src/features/gdrive/importer.ts` baris ~289:
```
cleanFunnelRows(rows, { pembuatOnly: true, skipIsReportFilter: true, skipWitelFilter: true })
```
- **`pembuatOnly: true`** — hanya `nik_pembuat_lop`, bukan `nik_handling`. Sesuai logika PIVOT F (group by `nama_pembuat_lop`)
- **`skipIsReportFilter: true`** — karena filter `is_report=Y` sudah diterapkan di filter query API, bukan di level import
- **`skipWitelFilter: true`** — KRITIS: AM Suramadu bisa handle customer di witel lain (contoh: ERVINA handle 2 LOP JATIM TIMUR: LOP257524, LOP258475). PIVOT F tidak filter by witel customer, hanya by nama AM. Tanpa flag ini, total hanya 360 (bukan 362).

### Remap NIK RENI→HAVEA
Di `importFunnel()`, NIK 850099 (RENI WULANSARI) di-remap ke 870022 (HAVEA PERTIWI) untuk `report_year >= 2026`. Ini karena RENI bergabung ke tim HAVEA per 2026. LOPs lama RENI (ratusan LOP sebelum 2026) tetap di NIK aslinya.

### Cara Reimport
```bash
# Build dan run script reimport (butuh API server sudah running)
cd artifacts/api-server
node /path/to/tsx/dist/cli.mjs src/scripts/reimport-fix-witel.ts
```

## GitHub Push Configuration

- **Script**: `push-to-github.mjs`
- **Token**: `GITHUB_PERSONAL_ACCESS_TOKEN` (secret)
- **Branch**: `feature/enhance-sales-activity`
- **Repo**: `portodit/LESAVI-SURAMADU`
- **Usage**: `node push-to-github.mjs "type: desc" file1 file2` (spesifik) atau `node push-to-github.mjs "type: desc"` (diff semua)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
>>>>>>> origin/master
