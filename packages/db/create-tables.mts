import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("Creating tables...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_managers (
      id SERIAL PRIMARY KEY,
      nik TEXT UNIQUE,
      nama TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'AM',
      tipe TEXT DEFAULT 'LESA',
      divisi TEXT NOT NULL DEFAULT 'DPS',
      segmen TEXT,
      witel TEXT NOT NULL DEFAULT 'SURAMADU',
      jabatan TEXT,
      aktif BOOLEAN NOT NULL DEFAULT true,
      cross_witel BOOLEAN NOT NULL DEFAULT false,
      telegram_chat_id TEXT,
      telegram_code TEXT,
      telegram_code_expiry TIMESTAMP WITH TIME ZONE,
      kpi_activity INTEGER,
      discovered_from TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ADMIN',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS performance_data (
      id SERIAL PRIMARY KEY,
      nik TEXT NOT NULL,
      nama TEXT NOT NULL,
      witel TEXT,
      divisi TEXT,
      periode TEXT,
      tahun INTEGER,
      triwulan INTEGER,
      bulan INTEGER,
      target_volume NUMERIC,
      actual_volume NUMERIC,
      pencapaian NUMERIC,
      target_revenue NUMERIC,
      actual_revenue NUMERIC,
      revenue_achievement NUMERIC,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_funnel (
      id SERIAL PRIMARY KEY,
      nik TEXT NOT NULL,
      nama TEXT NOT NULL,
      witel TEXT,
      divisi TEXT,
      produk TEXT,
      funnels TEXT,
      tahap TEXT,
      tahun INTEGER,
      bulan INTEGER,
      tanggal DATE,
      nilai NUMERIC,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_activity (
      id SERIAL PRIMARY KEY,
      nik TEXT NOT NULL,
      nama TEXT NOT NULL,
      witel TEXT,
      divisi TEXT,
      aktivitas TEXT,
      tahun INTEGER,
      bulan INTEGER,
      tanggal DATE,
      lokasi TEXT,
      customer TEXT,
      produk TEXT,
      status TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS data_imports (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      rows_imported INTEGER NOT NULL DEFAULT 0,
      period TEXT NOT NULL,
      snapshot_date TEXT,
      source_url TEXT,
      auto_telegram_sent BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_logs (
      id SERIAL PRIMARY KEY,
      chat_id TEXT,
      message TEXT,
      command TEXT,
      response TEXT,
      error TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_bot_users (
      id SERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value JSONB,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drive_read_logs (
      id SERIAL PRIMARY KEY,
      file_id TEXT,
      file_name TEXT,
      read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS master_am (
      id SERIAL PRIMARY KEY,
      nik TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      email TEXT,
      witel TEXT,
      divisi TEXT,
      aktif BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_am_discoveries (
      id SERIAL PRIMARY KEY,
      source TEXT,
      found_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      processed BOOLEAN DEFAULT false
    );
  `);

  console.log("Tables created successfully!");
  await pool.end();
}

main().catch(console.error);
