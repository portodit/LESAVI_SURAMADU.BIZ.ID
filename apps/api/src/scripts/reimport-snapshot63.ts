import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const SSF = require("ssf");
const xlsxModule = require("xlsx");
if (!xlsxModule.SSF) xlsxModule.SSF = SSF;
import { importFunnel } from "../features/gdrive/importer.js";
import { db, salesFunnelTable, dataImportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const FILE = "/home/runner/workspace/attached_assets/MyTENS_Sales_Funnel_Form_140426_1776820028654.xlsx";
const SNAPSHOT_DATE = "2026-04-20";
const PERIOD = "2026-04";

async function main() {
  await db.delete(salesFunnelTable).where(eq(salesFunnelTable.importId, 63));
  await db.delete(dataImportsTable).where(eq(dataImportsTable.id, 63));
  console.log("Deleted old snapshot 63.");
  const wb = XLSX.readFile(FILE, { cellFormula: false, cellHTML: false });
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { defval: null, raw: true });
  const rows = rawRows.map((r: any) => {
    const o: any = {};
    for (const k of Object.keys(r)) o[k.trim()] = r[k];
    return o;
  });
  console.log("Rows in xlsx:", rows.length, "| sample nilai_proyek:", rows[0]?.nilai_proyek);
  const result = await importFunnel(rows as any, "local:" + FILE, PERIOD, SNAPSHOT_DATE, FILE);
  console.log("Re-import result:", result);

  // Verify per-AM
  const { default: verifyDb } = await import("@workspace/db");
  const vrows = await verifyDb.db.execute(
    `SELECT am.nama, am.divisi, COUNT(sf.lopid) as cnt
     FROM sales_funnel sf JOIN account_managers am ON sf.nik_am = am.nik
     WHERE sf.import_id = (SELECT MAX(id) FROM data_imports)
     GROUP BY am.nama, am.divisi ORDER BY am.divisi, am.nama`
  );
  let total = 0;
  console.log("\n=== Per-AM count (new snapshot) ===");
  for (const row of vrows.rows) {
    const cnt = Number(row.cnt);
    total += cnt;
    console.log(String(row.divisi).padEnd(6), String(row.nama).padEnd(35), cnt);
  }
  console.log("TOTAL:", total, total === 362 ? "✓ MATCH!" : `✗ EXPECTED 362`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
