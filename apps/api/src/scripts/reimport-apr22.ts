import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
import { importFunnel } from "../features/gdrive/importer.js";
import { db, salesFunnelTable, dataImportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// April 22 file — 362 LOP, skipWitelFilter=true (ERVINA cross-witel LOP257524+LOP258475 ikut)
const FILE = "/home/runner/workspace/attached_assets/MyTENS_Sales_Funnel_Form_140426_1776820028654.xlsx";
const SNAPSHOT_DATE = "2026-04-22";
const PERIOD = "2026-04";
const DELETE_SNAP = 68; // snap April 20 Drive yang hasilkan 361

async function main() {
  await db.delete(salesFunnelTable).where(eq(salesFunnelTable.importId, DELETE_SNAP));
  await db.delete(dataImportsTable).where(eq(dataImportsTable.id, DELETE_SNAP));
  console.log(`Deleted snapshot ${DELETE_SNAP}.`);

  const wb = XLSX.readFile(FILE, { cellFormula: false, cellHTML: false });
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { defval: null, raw: true });
  const rows = rawRows.map((r: any) => {
    const o: any = {};
    for (const k of Object.keys(r)) o[k.trim()] = r[k];
    return o;
  });
  console.log("Total rows in April 22 xlsx:", rows.length);

  const result = await importFunnel(rows as any, "local:" + FILE, PERIOD, SNAPSHOT_DATE, FILE);
  console.log("Import result:", JSON.stringify(result));

  const newId = result.importId;

  const totals = await db.execute(
    `SELECT sf.divisi as lop_divisi, COUNT(*) as cnt, SUM(CAST(sf.nilai_proyek AS numeric)) as nilai
     FROM sales_funnel sf
     JOIN account_managers am ON sf.nik_am = am.nik
     WHERE sf.import_id = ${newId}
       AND am.aktif = true AND am.role = 'AM'
       AND sf.is_report = 'Y'
       AND sf.project_type IN ('AO','MO')
       AND sf.status_proyek NOT IN ('Lose','Cancel')
       AND sf.kategori_kontrak IN ('GTMA','Own Channel')
     GROUP BY sf.divisi ORDER BY sf.divisi DESC`
  );
  let totalLop = 0, totalNilai = 0;
  for (const r of totals.rows) {
    const cnt = Number(r.cnt);
    totalLop += cnt;
    totalNilai += Number(r.nilai || 0);
    console.log(`  ${r.lop_divisi}: ${cnt} LOP`);
  }
  console.log(`\nTOTAL: ${totalLop} LOP | Nilai: Rp ${totalNilai.toLocaleString('id-ID')}`);
  console.log(totalLop === 362 ? "✓ COCOK 362!" : `← expected 362`);

  const perAM = await db.execute(
    `SELECT am.nama, sf.divisi as lop_divisi, COUNT(*) as cnt
     FROM sales_funnel sf
     JOIN account_managers am ON sf.nik_am = am.nik
     WHERE sf.import_id = ${newId}
       AND am.aktif = true AND am.role = 'AM'
       AND sf.is_report = 'Y'
       AND sf.project_type IN ('AO','MO')
       AND sf.status_proyek NOT IN ('Lose','Cancel')
       AND sf.kategori_kontrak IN ('GTMA','Own Channel')
     GROUP BY am.nama, sf.divisi ORDER BY sf.divisi DESC, am.nama`
  );
  console.log("\nPer-AM breakdown:");
  for (const r of perAM.rows) {
    console.log(`  [${r.lop_divisi}] ${String(r.nama).padEnd(35)} ${r.cnt}`);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
