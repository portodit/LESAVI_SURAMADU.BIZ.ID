import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const SSF = require("ssf");
// Patch XLSX.SSF for the importer's parseDate (which expects XLSX.SSF.parse_date_code)
const xlsxModule = require("xlsx");
if (!xlsxModule.SSF) xlsxModule.SSF = SSF;
import { importFunnel } from "../features/gdrive/importer.js";
import { db, salesFunnelTable, dataImportsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const FILE = "/home/runner/workspace/attached_assets/MyTENS_Sales_Funnel_Form_140426_1776792658239.xlsx";
const SNAPSHOT_DATE = "2026-04-20";
const PERIOD = "2026-04";

async function main() {
  await db.delete(salesFunnelTable).where(eq(salesFunnelTable.importId, 60));
  await db.delete(dataImportsTable).where(eq(dataImportsTable.id, 60));
  console.log("Deleted old snapshot 60.");
  const wb = XLSX.readFile(FILE, { cellFormula: false, cellHTML: false });
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { defval: null, raw: true });
  // Excel column headers di file MyTENS punya leading/trailing space (mis " nilai_proyek ").
  // Normalisasi key supaya cleaner cocok.
  const rows = rawRows.map((r: any) => {
    const o: any = {};
    for (const k of Object.keys(r)) o[k.trim()] = r[k];
    return o;
  });
  console.log("Rows in xlsx:", rows.length, "| sample nilai_proyek:", rows[0]?.nilai_proyek);
  const result = await importFunnel(rows as any, "local:" + FILE, PERIOD, SNAPSHOT_DATE, FILE);
  console.log("Re-import result:", result);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
