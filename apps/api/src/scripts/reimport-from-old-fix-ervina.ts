import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const SSF = require("ssf");
const xlsxModule = require("xlsx");
if (!xlsxModule.SSF) xlsxModule.SSF = SSF;
import { importFunnel } from "../features/gdrive/importer.js";
import { db, salesFunnelTable, dataImportsTable } from "@workspace/db";
import { eq, gte } from "drizzle-orm";

// File lama April 14 — referensi snapshot 63 (360 LOP). Dengan fix ERVINA +2 harus jadi 362.
const FILE = "/home/runner/workspace/attached_assets/MyTENS_Sales_Funnel_Form_140426_1776792658239.xlsx";
const SNAPSHOT_DATE = "2026-04-14";
const PERIOD = "2026-04";

async function main() {
  // Hapus snapshot 64 (dari file baru), kembalikan ke import dari file lama
  await db.delete(salesFunnelTable).where(eq(salesFunnelTable.importId, 64));
  await db.delete(dataImportsTable).where(eq(dataImportsTable.id, 64));
  console.log("Deleted snapshot 64 (from new file).");

  const wb = XLSX.readFile(FILE, { cellFormula: false, cellHTML: false });
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { defval: null, raw: true });
  const rows = rawRows.map((r: any) => {
    const o: any = {};
    for (const k of Object.keys(r)) o[k.trim()] = r[k];
    return o;
  });
  console.log("Rows in old xlsx:", rows.length);
  const result = await importFunnel(rows as any, "local:" + FILE, PERIOD, SNAPSHOT_DATE, FILE);
  console.log("Re-import result:", result);

  const newId = result.importId;
  // Verify per-AM with same filters as dashboard (is_report=Y, AO/MO, no Lose/Cancel, aktif AM)
  const res = await db.execute(
    `SELECT am.nama, am.divisi, COUNT(sf.lopid) as cnt
     FROM sales_funnel sf
     JOIN account_managers am ON sf.nik_am = am.nik
     WHERE sf.import_id = ${newId}
       AND am.aktif = true
       AND sf.is_report = 'Y'
       AND sf.project_type IN ('AO','MO')
       AND sf.status_proyek NOT IN ('Lose','Cancel')
     GROUP BY am.nama, am.divisi
     ORDER BY am.divisi, am.nama`
  );
  let total = 0;
  console.log("\n=== Per-AM count (filtered like dashboard) ===");
  for (const row of res.rows) {
    const cnt = Number(row.cnt);
    total += cnt;
    console.log(String(row.divisi).padEnd(6), String(row.nama).padEnd(35), cnt);
  }
  console.log("TOTAL:", total, total === 362 ? "✓ COCOK 362!" : `(expected 362)`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
