# LESAVI Database Migration Guide

## Problem

Database `lesavi_db` tidak sinkron dengan schema di `packages/db`. Beberapa tabel hilang menyebabkan API error 500.

## Penyebab

- Migration SQL di `packages/db/drizzle/` tidak dijalankan ke database production
- Config `drizzle.config.json` salah (pointing ke database `lesavi` bukan `lesavi_db`)
- Query hardcoded salah: `FROM accounts` seharusnya `FROM account_managers`

## Tabel yang Hilang

| Tabel | Dipakai Di |
|-------|-----------|
| `admin_users` | auth/admin routes |
| `drive_read_logs` | `/api/gdrive/read-logs`, scheduler |
| `master_customer` | import funnel auto-populate |
| `pending_am_discoveries` | AM discovery system |
| `telegram_bot_users` | Telegram bot users |

## Checklist Setup Database

### 1. Verifikasi Koneksi Database

```bash
# Cek DATABASE_URL di .env project root
DATABASE_URL=postgresql://lesavi:lesavi123@127.0.0.1:5432/lesavi_db
```

### 2. Verifikasi Semua Tabel Ada

```bash
cd packages/db

# Pakai node langsung (tanpa drizzle-kit yang butuh env)
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://lesavi:lesavi123@127.0.0.1:5432/lesavi_db' });

async function check() {
  const result = await pool.query('SELECT tablename FROM pg_tables WHERE schemaname = \\'public\\' ORDER BY tablename');
  const tables = result.rows.map(r => r.tablename);
  
  const required = [
    'account_managers',
    'admin_users',
    'am_funnel_target',
    'app_settings',
    'data_imports',
    'drive_read_logs',
    'master_customer',
    'pending_am_discoveries',
    'performance_data',
    'sales_activity',
    'sales_funnel',
    'sales_funnel_target',
    'telegram_bot_users',
    'user_sessions'
  ];
  
  console.log('=== Tabel Saat Ini ===');
  tables.forEach(t => console.log(' ✓', t));
  
  console.log('\\n=== Cek Tabel Required ===');
  for (const t of required) {
    if (tables.includes(t)) {
      console.log(' ✓', t);
    } else {
      console.log(' ✗', t, '- MISSING!');
    }
  }
  
  await pool.end();
}
check().catch(console.error);
"
```

### 3. Buat Tabel yang Hilang

```bash
cd packages/db
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://lesavi:lesavi123@127.0.0.1:5432/lesavi_db' });

const creates = [
  \`CREATE TABLE IF NOT EXISTS \"admin_users\" (
    \"id\" serial PRIMARY KEY NOT NULL,
    \"email\" text NOT NULL,
    \"password_hash\" text NOT NULL,
    \"role\" text DEFAULT 'admin' NOT NULL,
    \"created_at\" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT \"admin_users_email_unique\" UNIQUE(\"email\")
  )\`,
  
  \`CREATE TABLE IF NOT EXISTS \"drive_read_logs\" (
    \"id\" serial PRIMARY KEY NOT NULL,
    \"type\" text NOT NULL,
    \"folder_id\" text,
    \"triggered_by\" text DEFAULT 'manual' NOT NULL,
    \"checked_at\" timestamp with time zone DEFAULT now() NOT NULL,
    \"files_found\" integer DEFAULT 0 NOT NULL,
    \"latest_file_name\" text,
    \"latest_file_date_extracted\" text,
    \"existing_snapshot_date\" text,
    \"condition\" text NOT NULL,
    \"message\" text NOT NULL,
    \"rows_imported\" integer,
    \"detail\" jsonb
  )\`,
  
  \`CREATE TABLE IF NOT EXISTS \"master_customer\" (
    \"id\" serial PRIMARY KEY NOT NULL,
    \"nama\" text NOT NULL,
    \"segmen\" text,
    \"witel\" text DEFAULT 'SURAMADU',
    \"created_at\" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT \"master_customer_nama_unique\" UNIQUE(\"nama\")
  )\`,
  
  \`CREATE TABLE IF NOT EXISTS \"pending_am_discoveries\" (
    \"id\" serial PRIMARY KEY NOT NULL,
    \"nik\" text NOT NULL,
    \"nama\" text NOT NULL,
    \"divisi\" text,
    \"witel\" text,
    \"source\" text NOT NULL,
    \"import_id\" integer,
    \"status\" text DEFAULT 'pending' NOT NULL,
    \"reviewed_by\" integer,
    \"reviewed_at\" timestamp with time zone,
    \"created_at\" timestamp with time zone DEFAULT now() NOT NULL
  )\`,
  
  \`CREATE TABLE IF NOT EXISTS \"telegram_bot_users\" (
    \"chat_id\" text PRIMARY KEY NOT NULL,
    \"first_name\" text DEFAULT '' NOT NULL,
    \"last_name\" text DEFAULT '' NOT NULL,
    \"username\" text DEFAULT '' NOT NULL,
    \"last_message\" text DEFAULT '' NOT NULL,
    \"last_seen\" timestamp with time zone DEFAULT now() NOT NULL
  )\`
];

async function main() {
  for (const sql of creates) {
    try {
      await pool.query(sql);
      console.log('✓ Created table');
    } catch (err) {
      console.log('✗', err.message.substring(0, 80));
    }
  }
  await pool.end();
}
main().catch(console.error);
"
```

### 4. Fix Query yang Salah

```bash
# Cari semua query yang salah
grep -r "FROM accounts" --include="*.ts" .

# Replace dengan yang benar
# accounts WHERE aktif = true  →  account_managers WHERE aktif = true
```

## Schema Reference

Lokasi file schema: `packages/db/src/schema/`

```
packages/db/src/schema/
├── accountManagers.ts    → account_managers
├── adminUsers.ts         → admin_users
├── appSettings.ts        → app_settings
├── dataImports.ts        → data_imports
├── driveReadLogs.ts      → drive_read_logs
├── masterAm.ts           → master_customer
├── pendingAmDiscoveries.ts → pending_am_discoveries
├── performanceData.ts     → performance_data
├── salesActivity.ts      → sales_activity
├── salesFunnel.ts        → sales_funnel
├── telegramBotUsers.ts   → telegram_bot_users
└── telegramLogs.ts       → telegram_logs
```

## Prevention Steps

### Sebelum Deploy/Running Project

1. **Jalankan checklist verifikasi tabel** (bagian 2 di atas)
2. **Cek semua migration SQL** ada di `packages/db/drizzle/`
3. **Verify schema match**: bandingkan `packages/db/src/schema/` dengan tabel di database

### CI/CD (Future)

```bash
# Di pipeline deploy
npm run db:check  # Verifikasi tabel ada
npm run db:migrate  # Push schema
```

## Restart API Server

```bash
# Find process
netstat -ano | findstr :3001

# Stop (ganti PID)
taskkill /F /PID <PID>

# Start
cd project-root
node --env-file=.env artifacts/api-server/dist/index.mjs
```

## Troubleshooting

### Error: "accounts" table not found
→ Fix query: `FROM accounts` → `FROM account_managers`

### Error: "drive_read_logs" not found  
→ Buat tabel manually atau jalankan migration

### Error: "master_customer" not found
→ Buat tabel manually atau jalankan migration

### Error: Cannot connect to database
→ Cek DATABASE_URL di .env dan credentials PostgreSQL
