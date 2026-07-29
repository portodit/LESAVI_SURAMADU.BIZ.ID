import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db, dataImportsTable, salesFunnelTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../shared/logger.js";

const APR22_SNAPSHOT = "2026-04-22";
const APR22_PERIOD   = "2026-04";

const __dir = dirname(fileURLToPath(import.meta.url));

function findJsonFile(): string | null {
  const candidates = [
    // Production compiled: dist/seeds/funnel-apr22-snapshot.json (copied by build)
    resolve(__dir, "funnel-apr22-snapshot.json"),
    // TSX dev: src/seeds/
    resolve(__dir, "../seeds/funnel-apr22-snapshot.json"),
    resolve(__dir, "../../src/seeds/funnel-apr22-snapshot.json"),
    resolve(process.cwd(), "src/seeds/funnel-apr22-snapshot.json"),
    resolve(process.cwd(), "dist/seeds/funnel-apr22-snapshot.json"),
    "/home/runner/workspace/artifacts/api-server/src/seeds/funnel-apr22-snapshot.json",
    "/home/runner/workspace/artifacts/api-server/dist/seeds/funnel-apr22-snapshot.json",
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      logger.info({ path: p }, "[seed-funnel-apr22-json] Found JSON file");
      return p;
    }
  }
  logger.warn({ candidates }, "[seed-funnel-apr22-json] JSON file not found in any path");
  return null;
}

export async function seedFunnelApr22Json(): Promise<void> {
  // Skip if already have Apr22+ snapshot
  const existing = await db
    .select({ id: dataImportsTable.id, snapshotDate: dataImportsTable.snapshotDate })
    .from(dataImportsTable)
    .where(and(
      eq(dataImportsTable.type, "funnel"),
      sql`snapshot_date >= '2026-04-22'`,
    ))
    .limit(1);

  if (existing.length > 0) {
    logger.info({ id: existing[0].id, snapshotDate: existing[0].snapshotDate }, "[seed-funnel-apr22-json] Already have Apr22+ snapshot — skip");
    return;
  }

  const jsonPath = findJsonFile();
  if (!jsonPath) {
    logger.warn("[seed-funnel-apr22-json] funnel-apr22-snapshot.json not found — skip");
    return;
  }

  logger.info({ jsonPath }, "[seed-funnel-apr22-json] Reading JSON snapshot…");
  const rows: any[] = JSON.parse(readFileSync(jsonPath, "utf-8"));
  logger.info({ rowCount: rows.length }, "[seed-funnel-apr22-json] JSON rows loaded ✓");

  // Delete old 2026-04 funnel import if present
  const [old] = await db
    .select({ id: dataImportsTable.id })
    .from(dataImportsTable)
    .where(and(eq(dataImportsTable.type, "funnel"), eq(dataImportsTable.period, APR22_PERIOD)))
    .limit(1);

  if (old) {
    await db.delete(salesFunnelTable).where(eq(salesFunnelTable.importId, old.id));
    await db.delete(dataImportsTable).where(eq(dataImportsTable.id, old.id));
    logger.info({ id: old.id }, "[seed-funnel-apr22-json] Deleted old 2026-04 import");
  }

  // Create new import record
  const [importRecord] = await db
    .insert(dataImportsTable)
    .values({ type: "funnel", period: APR22_PERIOD, snapshotDate: APR22_SNAPSHOT, sourceUrl: "seed:funnel-apr22-snapshot.json" })
    .returning({ id: dataImportsTable.id });

  const importId = importRecord.id;
  logger.info({ importId }, "[seed-funnel-apr22-json] Created import record");

  // Insert funnel rows in batches of 200
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r: any) => ({
      lopid: r.lopid ?? null,
      judulProyek: r.judul_proyek ?? null,
      pelanggan: r.pelanggan ?? null,
      nilaiProyek: r.nilai_proyek != null ? Number(r.nilai_proyek) : null,
      divisi: r.divisi ?? null,
      segmen: r.segmen ?? null,
      witel: r.witel ?? null,
      statusF: r.status_f ?? null,
      proses: r.proses ?? null,
      statusProyek: r.status_proyek ?? null,
      kategoriKontrak: r.kategori_kontrak ?? null,
      estimateBulan: r.estimate_bulan ?? null,
      namaAm: r.nama_am ?? null,
      nikAm: r.nik_am ?? null,
      reportDate: r.report_date ?? null,
      createdDate: r.created_date ?? null,
      snapshotDate: r.snapshot_date ?? APR22_SNAPSHOT,
      monthSubs: r.month_subs != null ? Number(r.month_subs) : null,
      tahunAnggaran: r.tahun_anggaran != null ? Number(r.tahun_anggaran) : null,
      estRev: r.est_rev != null ? Number(r.est_rev) : null,
      projectType: r.project_type ?? null,
      isReport: r.is_report ?? null,
      importId,
    }));
    await db.insert(salesFunnelTable).values(batch);
    inserted += batch.length;
  }

  logger.info({ importId, inserted }, "[seed-funnel-apr22-json] Import done ✓");
}
