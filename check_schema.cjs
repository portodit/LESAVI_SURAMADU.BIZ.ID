const { Pool } = require("pg");
const pool = new Pool({ connectionString: "postgresql://lesavi:lesavi123@localhost:5432/lesavi_db" });

async function main() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log("Tables:", tables.rows.map(t => t.table_name));

  const r2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'performance_data' ORDER BY ordinal_position");
  console.log("\nperformance_data columns:");
  for (const c of r2.rows) console.log(" ", c.column_name, c.data_type);

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
