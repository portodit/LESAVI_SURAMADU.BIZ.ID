import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { importFunnel } from "../features/gdrive/importer.js";
import { db, salesFunnelTable, dataImportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Reimport dari file lama (snapshot 66 source) dengan fix skipWitelFilter=true
// LOP ERVINA witel JATIM TIMUR (LOP257524, LOP258475) sekarang ikut terhitung → 362 total
const FILE = "/home/runner/workspace/attached_assets/MyTENS_Sales_Funnel_Form_140426_1776792658239.xlsx";
const SNAPSHOT_DATE = "2026-04-14";
const PERIOD = "2026-04";
const OLD_SNAPSHOT_ID = 66;

async function main() {
  // Hapus snapshot lama
  await db.delete(salesFunnelTable).where(eq(salesFunnelTable.importId, OLD_SNAPSHOT_ID));
  await db.delete(dataImportsTable).where(eq(dataImportsTable.id, OLD_SNAPSHOT_ID));
  console.log(`Deleted snapshot ${OLD_SNAPSHOT_ID}.`);

  const wb = XLSX.readFile(FILE, { cellFormula: false, cellHTML: false });
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { defval: null, raw: true });
  const rows = rawRows.map((r: any) => {
    const o: any = {};
    for (const k of Object.keys(r)) o[k.trim()] = r[k];
    return o;
  });
  console.log("Total rows in xlsx:", rows.length);

  const result = await importFunnel(rows as any, "local:" + FILE, PERIOD, SNAPSHOT_DATE, FILE);
  console.log("Re-import result:", JSON.stringify(result, null, 2));

  const newId = result.importId;

  // Verify total (GTMA+OC filter seperti dashboard)
  const resFull = await db.execute(
    `SELECT COUNT(*) as total
     FROM sales_funnel sf
     JOIN account_managers am ON sf.nik_am = am.nik
     WHERE sf.import_id = ${newId}
       AND am.aktif = true AND am.role = 'AM'
       AND sf.is_report = 'Y'
       AND sf.project_type IN ('AO','MO')
       AND sf.status_proyek NOT IN ('Lose','Cancel')
       AND sf.kategori_kontrak IN ('GTMA','Own Channel')`
  );
  const total = Number(resFull.rows[0]?.total);
  console.log("\nTotal LOPs (GTMA+OC, 11 AM aktif):", total, total === 362 ? "✓ COCOK 362!" : `← expected 362`);

  // Per-AM breakdown by lop_divisi
  const resPerAM = await db.execute(
    `SELECT am.nama, am.divisi as am_divisi, sf.divisi as lop_divisi, COUNT(sf.lopid) as cnt
     FROM sales_funnel sf
     JOIN account_managers am ON sf.nik_am = am.nik
     WHERE sf.import_id = ${newId}
       AND am.aktif = true AND am.role = 'AM'
       AND sf.is_report = 'Y'
       AND sf.project_type IN ('AO','MO')
       AND sf.status_proyek NOT IN ('Lose','Cancel')
       AND sf.kategori_kontrak IN ('GTMA','Own Channel')
     GROUP BY am.nama, am.divisi, sf.divisi
     ORDER BY sf.divisi DESC, am.nama`
  );
  console.log("\n=== Per-AM breakdown (DSS=LEFT, DPS=MIDDLE) ===");
  let dss = 0, dps = 0;
  for (const row of resPerAM.rows) {
    const cnt = Number(row.cnt);
    if (String(row.lop_divisi) === 'DSS') dss += cnt; else dps += cnt;
    const mark = String(row.lop_divisi) === 'DPS' ? '' : '(DSS segment)';
    console.log(`  [${row.lop_divisi}] ${String(row.nama).padEnd(35)} ${cnt} ${mark}`);
  }
  console.log(`\nDSS (LEFT): ${dss}  [PIVOT F: 120]  ${dss===120?'✓':'✗'}`);
  console.log(`DPS (MIDDLE): ${dps}  [PIVOT F: 242]  ${dps===242?'✓':'✗'}`);
  console.log(`COMBINED: ${dss+dps}  [PIVOT F: 362]  ${dss+dps===362?'✓':'✗'}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
