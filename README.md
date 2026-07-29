# LESA VI Witel Suramadu Dashboard

Dashboard monitoring dan management untuk Witel Suramadu. Proyek ini menggunakan arsitektur monorepo dengan `pnpm` workspace.

<<<<<<< HEAD
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
=======
## 🛠 Prerequisites

Pastikan Anda telah menginstal software berikut:
- **Node.js**: Versi LTS terbaru.
- **pnpm**: `npm install -g pnpm`
- **PostgreSQL**: Pastikan database server berjalan secara lokal atau remote.

## 🚀 Setup Proyek

1. **Instal Dependensi**:
   ```bash
   pnpm install
   ```

2. **Konfigurasi Environment**:
   Salin file `.env.example` menjadi `.env` dan sesuaikan nilainya:
   ```bash
   cp .env.example .env
   ```
   **PENTING**: Pastikan `DATABASE_URL` sudah mengarah ke database PostgreSQL Anda.

3. **Sinkronisasi Database**:
   Jalankan perintah berikut untuk mensinkronkan skema database menggunakan Drizzle:
   ```bash
   pnpm --filter @workspace/db run push
   ```

4. **Seeding Data (Opsional)**:
   Jika Anda membutuhkan data awal untuk pengujian:
   ```bash
   pnpm --filter @workspace/api-server run seed
   ```

## 💻 Menjalankan Aplikasi

Anda dapat menjalankan frontend dan backend secara terpisah menggunakan perintah di bawah ini dari root directory:

### 1. Frontend (Dashboard)
```bash
pnpm --filter @workspace/lesavi-dashboard run dev
```
Aplikasi akan berjalan di [http://localhost:5173](http://localhost:5173).

### 2. Backend (API Server)
```bash
pnpm --filter @workspace/api-server run dev
```
Server akan berjalan sesuai port yang dikonfigurasi di `.env` (default: 3000).

---

## 📂 Struktur Workspace

- `artifacts/lesavi-dashboard`: Aplikasi Frontend (React + Vite).
- `artifacts/api-server`: Backend API (Express.js).
- `lib/db`: Shared library untuk akses database (Drizzle ORM).
- `lib/api-zod`: Shared schema validasi menggunakan Zod.
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
