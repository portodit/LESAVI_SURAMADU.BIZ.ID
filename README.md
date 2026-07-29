# LESA VI Witel Suramadu Dashboard

Dashboard monitoring dan management untuk Witel Suramadu. Proyek ini menggunakan arsitektur monorepo dengan `pnpm` workspace.

## Prerequisites

- **Node.js**: LTS terbaru
- **pnpm**: `npm install -g pnpm`
- **PostgreSQL**: Pastikan database server berjalan

## Setup

```bash
pnpm install
cp .env.example .env   # sesuaikan DATABASE_URL dan PORT
```

## Sinkronisasi Database

```bash
pnpm --filter @workspace/db run push
```

## Menjalankan Aplikasi

### Development (dengan build + hot reload)

```bash
# Semua dalam satu command
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/dashboard run dev
```

Atau gunakan batch script:

```bash
start-dev.bat
```

- API: http://localhost:8080
- Dashboard: http://localhost:5173

### Seed Data (opsional)

```bash
pnpm --filter @workspace/api-server run seed
```

## Struktur Workspace

```
apps/
  api/          → Backend API (Express 5)
  dashboard/    → Frontend (React + Vite)
packages/
  db/           → Schema database (Drizzle ORM)
  api-zod/      → Shared Zod schemas
  api-client-react/ → React Query hooks
  api-spec/     → Orval codegen config
scripts/        → Utility scripts
```

## Scripts

```bash
pnpm run clean       # Hapus semua dist folder
pnpm run build      # Typecheck + build semua
pnpm run typecheck  # Typecheck semua package
```
