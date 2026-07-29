import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("Dropping data_imports table...");
  await pool.query(`DROP TABLE IF EXISTS data_imports CASCADE;`);

  console.log("Creating data_imports table with correct schema...");
  await pool.query(`
    CREATE TABLE data_imports (
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

  console.log("Done!");
  await pool.end();
}

main().catch(console.error);
