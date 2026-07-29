import { createRequire } from "module";
const require = createRequire(import.meta.url);

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db, dataImportsTable, salesFunnelTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { importFunnel } from "../features/gdrive/importer.js";
import { logger } from "../shared/logger.js";

const APR22_FILE_NAME = "MyTENS_Sales_Funnel_Form_140426_1776820028654.xlsx";
const APR22_SNAPSHOT  = "2026-04-22";
const APR22_PERIOD    = "2026-04";

const __dir = dirname(fileURLToPath(import.meta.url));

function findApr22File(): string | null {
  const candidates = [
    resolve(__dir, "../../../attached_assets", APR22_FILE_NAME),
    resolve(__dir, "../../../../attached_assets", APR22_FILE_NAME),
    resolve(process.cwd(), "../../attached_assets", APR22_FILE_NAME),
    resolve(process.cwd(), "attached_assets", APR22_FILE_NAME),
    "/home/runner/workspace/attached_assets/" + APR22_FILE_NAME,
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      logger.info({ path: p }, "[seed-funnel-apr22] Found Excel file");
      return p;
    }
  }
  logger.warn({ candidates }, "[seed-funnel-apr22] File not found in any candidate path");
  return null;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 5000): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const isConnErr = e?.message?.includes("terminating") || e?.message?.includes("Connection terminated") || e?.code === "57P01";
      if (!isConnErr || attempt === retries) throw e;
      logger.warn({ attempt, retries, err: e?.message }, `[seed-funnel-apr22] Connection error, retrying in ${delayMs}ms…`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function seedFunnelApr22(): Promise<void> {
  // ── 1. Check skip (fast DB query) ──────────────────────────────────────────
  const existing = await db
    .select({ id: dataImportsTable.id, snapshotDate: dataImportsTable.snapshotDate })
    .from(dataImportsTable)
    .where(and(
      eq(dataImportsTable.type, "funnel"),
      sql`snapshot_date >= '2026-04-22'`,
    ))
    .limit(1);

  if (existing.length > 0) {
    logger.info({ id: existing[0].id, snapshotDate: existing[0].snapshotDate }, "[seed-funnel-apr22] Already have Apr22+ snapshot — skip");
    return;
  }

  const filePath = findApr22File();
  if (!filePath) {
    logger.warn("[seed-funnel-apr22] April 22 Excel file not found — skipping auto-import");
    return;
  }

  // ── 2. Read Excel FIRST (slow — 2-4 min, no DB needed) ────────────────────
  logger.info({ filePath }, "[seed-funnel-apr22] Reading Excel file (this may take a few minutes)…");
  const XLSX = require("xlsx");
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { cellFormula: false, cellHTML: false });
  const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { defval: null, raw: true });
  const rows = rawRows.map((r: any) => {
    const o: any = {};
    for (const k of Object.keys(r)) o[k.trim()] = r[k];
    return o;
  });
  logger.info({ rowCount: rows.length }, "[seed-funnel-apr22] Rows read from Excel ✓");

  // ── 3. Now do all DB work with fresh connection (Excel read is done) ───────
  logger.info("[seed-funnel-apr22] Starting import into database…");
  await withRetry(async () => {
    // Re-check skip in case another process imported while we were reading Excel
    const recheckExisting = await db
      .select({ id: dataImportsTable.id })
      .from(dataImportsTable)
      .where(and(
        eq(dataImportsTable.type, "funnel"),
        sql`snapshot_date >= '2026-04-22'`,
      ))
      .limit(1);

    if (recheckExisting.length > 0) {
      logger.info({ id: recheckExisting[0].id }, "[seed-funnel-apr22] Apr22+ snapshot appeared while reading Excel — skip");
      return;
    }

    // Delete old April 2026 funnel import ONLY after Excel is ready
    const [oldImport] = await db
      .select({ id: dataImportsTable.id })
      .from(dataImportsTable)
      .where(and(eq(dataImportsTable.type, "funnel"), eq(dataImportsTable.period, APR22_PERIOD)))
      .limit(1);

    if (oldImport) {
      await db.delete(salesFunnelTable).where(eq(salesFunnelTable.importId, oldImport.id));
      await db.delete(dataImportsTable).where(eq(dataImportsTable.id, oldImport.id));
      logger.info({ id: oldImport.id }, "[seed-funnel-apr22] Deleted old funnel import for 2026-04");
    }

    const result = await importFunnel(rows as any, "local:" + filePath, APR22_PERIOD, APR22_SNAPSHOT, filePath);
    logger.info({ result }, "[seed-funnel-apr22] Import done ✓");
  });
}
