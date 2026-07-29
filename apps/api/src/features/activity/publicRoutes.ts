import { Router, type IRouter } from "express";
import { db, salesActivityTable, accountManagersTable, dataImportsTable, appSettingsTable } from "@workspace/db";
import { matchesDivisi } from "../../shared/divisi";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function isKpiLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  return !label.toLowerCase().includes("tanpa");
}

// ── GET /api/public/activity/snapshots ─────────────────────────────────────────
router.get("/public/activity/snapshots", async (_req, res): Promise<void> => {
  const snaps = await db
    .select()
    .from(dataImportsTable)
    .where(eq(dataImportsTable.type, "activity"))
    .orderBy(desc(dataImportsTable.id));

  res.json(snaps.map(s => ({
    id: s.id,
    period: s.period,
    rowsImported: s.rowsImported,
    snapshotDate: s.snapshotDate,
    createdAt: s.createdAt?.toISOString?.() ?? null,
    sourceUrl: s.sourceUrl,
  })));
});

// ── GET /api/public/activity ───────────────────────────────────────────────────
router.get("/public/activity", async (req, res): Promise<void> => {
  const { year, month, divisi, import_id } = req.query;

  const [allActs, ams, settingsArr, activityImports] = await Promise.all([
    db.select().from(salesActivityTable),
    db.select().from(accountManagersTable),
    db.select({ kpiActivityDefault: appSettingsTable.kpiActivityDefault }).from(appSettingsTable).limit(1),
    db.select({ id: dataImportsTable.id, snapshotDate: dataImportsTable.snapshotDate })
      .from(dataImportsTable)
      .where(eq(dataImportsTable.type, "activity")),
  ]);
  const kpiDefault = settingsArr[0]?.kpiActivityDefault ?? 30;

  // DEBUG: log first few activity dates
  console.log("[activity] allActs sample:", (allActs as any[]).slice(0, 3).map((a: any) => a.activityEndDate));
  console.log("[activity] allActs count:", allActs.length);

  // availableMonths: distinct (YYYY, MM) pairs from activityEndDate — for defaulting the filter
  const monthSet = new Set<string>();
  for (const a of allActs) {
    const d = (a as any).activityEndDate;
    if (d && typeof d === "string" && d.length >= 7) {
      monthSet.add(d.slice(0, 7));
    }
  }
  const availableMonths = [...monthSet].sort().reverse();

  // Hanya AM terdaftar (role=AM, aktif=true) — bukan officer/manager
  const registeredAms = ams.filter(a => a.aktif && a.role === "AM");
  const registeredNikSet = new Set(registeredAms.map(a => a.nik));

  let acts = allActs;

  // Exact snapshot filter: hanya tampilkan aktivitas dari import_id yang dipilih
  if (import_id && String(import_id) !== "" && String(import_id) !== "all") {
    const impId = parseInt(String(import_id), 10);
    if (!isNaN(impId)) {
      acts = acts.filter(a => a.importId === impId);
    }
  }

  const months = req.query.months ? String(req.query.months).split(",").filter(Boolean) : null;
  if (year && months && months.length > 0) {
    const prefixes = months.map(m => `${year}-${m.padStart(2, "0")}`);
    acts = acts.filter(a => prefixes.some(p => a.activityEndDate?.startsWith(p)));
  } else if (year && month && String(month) !== "all") {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    acts = acts.filter(a => a.activityEndDate?.startsWith(prefix));
  } else if (year) {
    acts = acts.filter(a => a.activityEndDate?.startsWith(String(year)));
  }

  const masterAms = registeredAms.map(a => ({ nik: a.nik, nama: a.nama, divisi: a.divisi ?? "" }));

  const byAmMap: Record<string, {
    nik: string; fullname: string | null; divisi: string;
    kpiCount: number; totalCount: number; kpiTarget: number;
    activities: any[];
    _divisiSet: Set<string>;
  }> = {};

  // Inisialisasi hanya dari AM terdaftar
  for (const am of registeredAms) {
    if (!am.nik) continue;
    byAmMap[am.nik] = {
      nik: am.nik,
      fullname: am.nama,
      divisi: am.divisi ?? "",
      kpiCount: 0,
      totalCount: 0,
      kpiTarget: am.kpiActivity ?? kpiDefault,
      perAmKpiTarget: am.kpiActivity ?? null,
      activities: [],
      _divisiSet: new Set<string>(),
    };
  }

  const distinctLabels = new Set<string>();

  for (const act of acts) {
    const nik = act.nik;
    // Skip AM yang tidak terdaftar di manajemen akun
    if (!nik || !registeredNikSet.has(nik)) continue;
    if (!byAmMap[nik]) continue;
    byAmMap[nik].totalCount++;
    if (isKpiLabel(act.label)) byAmMap[nik].kpiCount++;
    if (act.label) distinctLabels.add(act.label);
    // Kumpulkan semua divisi dari data aktivitas (bukan dari profil AM)
    if (act.divisi) byAmMap[nik]._divisiSet.add(act.divisi);
    byAmMap[nik].activities.push({
      id: act.id,
      activityEndDate: act.activityEndDate,
      activityType: act.activityType,
      divisi: act.divisi ?? null,
      label: act.label,
      caName: act.caName,
      picName: act.picName,
      activityNotes: act.activityNotes,
      isKpi: isKpiLabel(act.label),
    });
  }

  for (const entry of Object.values(byAmMap)) {
    entry.activities.sort((a, b) => {
      const da = a.activityEndDate ?? "";
      const db2 = b.activityEndDate ?? "";
      return db2 < da ? -1 : db2 > da ? 1 : 0;
    });
    // Tentukan divisi efektif dari data aktivitas (lebih akurat dari profil AM)
    if (entry._divisiSet.size > 0) {
      entry.divisi = [...entry._divisiSet][0];
    }
  }

  const filterDivisiParam = divisi ? String(divisi) : "all";
  const byAm = Object.values(byAmMap).filter(a => {
    // Filter berdasarkan divisi dari aktivitas aktual, bukan hanya profil AM
    const actDivisis = [...a._divisiSet];
    if (actDivisis.length > 0) {
      return actDivisis.some(d => matchesDivisi(d, filterDivisiParam));
    }
    return matchesDivisi(a.divisi, filterDivisiParam);
  });

  const totalKpiActivities = byAm.reduce((s, a) => s + a.kpiCount, 0);

  // Bersihkan internal field sebelum kirim, tambahkan divisiAll sebagai array
  const byAmClean = byAm.map(({ _divisiSet, ...rest }) => ({
    ...rest,
    divisiAll: [..._divisiSet].sort(),
  }));

  res.json({
    totalKpiActivities,
    kpiDefault,
    masterAms,
    byAm: byAmClean,
    distinctLabels: [...distinctLabels].sort(),
    availableMonths,
  });
});

export default router;
