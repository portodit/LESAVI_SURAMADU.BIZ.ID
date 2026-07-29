import { Router, type IRouter } from "express";
import { db, salesFunnelTable, salesFunnelTargetTable, amFunnelTargetTable, dataImportsTable, accountManagersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { matchesDivisi, expandDivisi } from "../../shared/divisi";

const router: IRouter = Router();

const PUBLIC_HEADERS = {
  "Cache-Control": "no-store",
  "X-Frame-Options": "ALLOWALL",
  "Access-Control-Allow-Origin": "*",
};

router.get("/public/funnel/snapshots", async (req, res): Promise<void> => {
  Object.entries(PUBLIC_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  const imports = await db
    .select()
    .from(dataImportsTable)
<<<<<<< HEAD
=======
<<<<<<< HEAD
    .where(eq(dataImportsTable.type, "funnel"))
    .orderBy(desc(dataImportsTable.createdAt));

  res.json(imports.map(imp => ({
=======
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
    .where(eq(dataImportsTable.type, "funnel"));

  const sorted = [...imports].sort((a, b) => {
    const da = a.snapshotDate || a.createdAt?.toISOString() || "";
    const db2 = b.snapshotDate || b.createdAt?.toISOString() || "";
    return db2.localeCompare(da);
  });

  res.json(sorted.map(imp => ({
<<<<<<< HEAD
=======
>>>>>>> origin/master
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
    id: imp.id,
    period: imp.period,
    rowsImported: imp.rowsImported,
    createdAt: imp.createdAt?.toISOString(),
    snapshotDate: imp.snapshotDate ?? null,
  })));
});

router.get("/public/funnel", async (req, res): Promise<void> => {
<<<<<<< HEAD
  Object.entries(PUBLIC_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  const { import_id, divisi, status, nama_am, kategori_kontrak, tahun, tahun_list, rd_year, durasi_filter, is_report, project_type } = req.query;

  const masterAms = await db.select().from(accountManagersTable);
  const masterAmByNik = new Map(masterAms.map(m => [m.nik, m.nama]));
  const activeNikSet = new Set(masterAms.filter(m => m.aktif && m.role === "AM" && m.nik).map(m => m.nik));

  let allLops = await db.select().from(salesFunnelTable);

  allLops = allLops.map(l => {
    const isUnresolved = !l.namaAm || l.namaAm === "" || /^\d+$/.test(l.namaAm.trim());
    if (isUnresolved && l.nikAm && masterAmByNik.has(l.nikAm)) {
      return { ...l, namaAm: masterAmByNik.get(l.nikAm) || l.namaAm };
    }
    return l;
=======
  console.log("MARKER_FOR_DEVEL_PUBLIC_FUNNEL");
  Object.entries(PUBLIC_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

<<<<<<< HEAD
  const { import_id, divisi, status, nama_am, kategori_kontrak, tahun, tahun_list, rd_year, durasi_filter } = req.query;
=======
  const { import_id, divisi, status, nama_am, kategori_kontrak, tahun, tahun_list, rd_year, durasi_filter, is_report, project_type } = req.query;
>>>>>>> origin/master

  const masterAms = await db.select().from(accountManagersTable);
  const masterAmByNik = new Map();
  masterAms.forEach(m => {
    if (m.nik) masterAmByNik.set(String(m.nik).trim(), m.nama);
  });

  const activeNikSet = new Set(masterAms.filter(m => m.aktif && m.role === "AM" && m.nik).map(m => String(m.nik).trim()));

  let allLopsRaw = await db.select().from(salesFunnelTable);

  let allLops = allLopsRaw.map(l => {
    const d = { ...l };
    // 1. Resolve namaAm if it's a NIK or empty
    const amNik = String(d.nikAm || "").trim();
    if (masterAmByNik.has(amNik)) {
      d.namaAm = masterAmByNik.get(amNik);
    }

    // 2. Resolve namaPembuatLop
    const pembuatRaw = String(d.namaPembuatLop || "").trim();
    const isNikPembuat = /^\d+$/.test(pembuatRaw);

    if (isNikPembuat && masterAmByNik.has(pembuatRaw)) {
      d.namaPembuatLop = masterAmByNik.get(pembuatRaw);
    } else if (!d.namaPembuatLop || d.namaPembuatLop === "" || isNikPembuat) {
      if (amNik && masterAmByNik.has(amNik)) {
        d.namaPembuatLop = masterAmByNik.get(amNik);
      }
    }

    return d;
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  });

  if (import_id) allLops = allLops.filter(l => l.importId === Number(import_id));

  // Deduplicate by lopid — same LOP may appear in multiple imports; keep highest importId.
  if (!import_id) {
    const lopMap = new Map<string, typeof allLops[0]>();
    for (const l of allLops) {
      const existing = lopMap.get(l.lopid);
      if (!existing || (l.importId || 0) > (existing.importId || 0)) lopMap.set(l.lopid, l);
    }
    allLops = [...lopMap.values()];
  }

  // Compute available Tahun Anggaran from all active-AM lops (before tahun filter)
  const availableTahunAnggaran = [...new Set(
    allLops
      .filter(l => l.nikAm && activeNikSet.has(l.nikAm))
      .map(l => l.tahunAnggaran ?? (l.reportDate ? parseInt(String(l.reportDate).slice(0, 4), 10) || null : null))
      .filter((y): y is number => y != null && y > 2000)
  )].sort((a, b) => b - a);

  if (rd_year) {
    // Report Date mode — filter strictly by reportDate.year, tahunAnggaran is irrelevant
    const rdYearNum = Number(rd_year);
    if (rdYearNum > 2000) {
      allLops = allLops.filter(l => {
        const yr = l.reportDate ? parseInt(String(l.reportDate).slice(0, 4), 10) || null : null;
        return yr === rdYearNum;
      });
    }
  } else {
    // Tahun Anggaran mode — tahunAnggaran is the primary key; fall back to reportDate.year only when tahunAnggaran is null.
    const listStr = tahun_list as string | undefined;
    const yearNums: number[] = listStr
      ? listStr.split(",").map(Number).filter(n => n > 2000)
      : tahun ? [Number(tahun)] : [];
    if (yearNums.length > 0) {
      allLops = allLops.filter(l => {
        const rdYear = l.reportDate ? parseInt(String(l.reportDate).slice(0, 4), 10) || null : null;
        const ta = l.tahunAnggaran ?? null;
        return yearNums.some(yr => ta === yr || (ta == null && rdYear === yr));
      });
    }
  }
  // Witel Suramadu hanya handle customer DPS dan DSS — singkirkan DGS
  allLops = allLops.filter(l => (l.divisi || "").toUpperCase() !== "DGS");
<<<<<<< HEAD

  // ── AUTO FILTERS (sesuai PIVOT F MyTENS, hidden dari UI) ──────────────────
  // 1. is_report = 'Y' (hanya LOP yang sudah valid/approved); jika NULL/null-string, inklude (data lama tidak ada is_report)
  allLops = allLops.filter(l => {
    const v = l.isReport;
    if (!v) return true; // null/undefined/empty → inklude
    return v.trim().toUpperCase() === "Y";
  });
  // 2. project_type ∈ {AO, MO}; jika NULL, inklude (data lama tidak ada project_type)
  allLops = allLops.filter(l => {
    const v = l.projectType;
    if (!v) return true; // null/undefined/empty → inklude
    return ["AO", "MO"].includes(v.trim().toUpperCase());
  });
=======
<<<<<<< HEAD
  if (divisi && String(divisi) !== "all") allLops = allLops.filter(l => matchesDivisi(l.divisi, String(divisi)));
  if (status) allLops = allLops.filter(l => l.statusF === String(status));
  if (nama_am) allLops = allLops.filter(l => l.namaAm?.toLowerCase().includes(String(nama_am).toLowerCase()));
  if (kategori_kontrak) allLops = allLops.filter(l => l.kategoriKontrak === String(kategori_kontrak));
=======

  // ── AUTO FILTERS (sesuai PIVOT F MyTENS, hidden dari UI) ──────────────────
  // 1. is_report = 'Y' (hanya LOP yang sudah valid/approved)
  allLops = allLops.filter(l => (l.isReport || "").toUpperCase() === "Y");
  // 2. project_type ∈ {AO, MO}
  allLops = allLops.filter(l => ["AO", "MO"].includes((l.projectType || "").toUpperCase()));
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  // 3. status_proyek bukan Lose/Cancel
  allLops = allLops.filter(l => !["LOSE", "CANCEL"].includes((l.statusProyek || "").toUpperCase()));

  if (divisi && String(divisi) !== "all") allLops = allLops.filter(l => matchesDivisi(l.divisi, String(divisi)));
  if (status) allLops = allLops.filter(l => l.statusF === String(status));
  if (nama_am) allLops = allLops.filter(l => l.namaAm?.toLowerCase().includes(String(nama_am).toLowerCase()));
  // kategori_kontrak: support multi-value comma list (e.g. "GTMA,New GTMA,Own Channel")
  if (kategori_kontrak) {
    const wanted = String(kategori_kontrak).split(",").map(s => s.trim()).filter(Boolean);
    if (wanted.length > 0) allLops = allLops.filter(l => wanted.includes(l.kategoriKontrak || ""));
  }
  // is_report and project_type query params kept for backward compat but no-op (already auto-applied above)
  void is_report; void project_type;
<<<<<<< HEAD
=======
>>>>>>> origin/master
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  if (durasi_filter === "single_year") allLops = allLops.filter(l => l.monthSubs != null && l.monthSubs <= 12);
  else if (durasi_filter === "multi_year") allLops = allLops.filter(l => l.monthSubs != null && l.monthSubs > 12);

  // Only include LOPs from registered AMs (role=AM, aktif=true) — same rule as activity/performance visualizations
<<<<<<< HEAD
  allLops = allLops.filter(l => l.nikAm && activeNikSet.has(l.nikAm));

  const totalLop = allLops.length;
  const totalNilai = allLops.reduce((s, l) => s + (l.nilaiProyek || 0), 0);
  const totalEstRev = allLops.reduce((s, l) => s + (l.estRev || 0), 0);
=======
  allLops = allLops.filter(l => {
    if (!l.nikAm) return false;
    const handlingNiks = (l.nikHandling || "").split(",").map(n => n.trim()).filter(Boolean);
    const isHandling = handlingNiks.some(n => activeNikSet.has(n));
    const isOwner = activeNikSet.has(l.nikAm);
    return isHandling || isOwner;
  });

  const totalLop = allLops.length;
  const totalNilai = allLops.reduce((s, l) => s + (l.nilaiProyek || 0), 0);
<<<<<<< HEAD
=======
  const totalEstRev = allLops.reduce((s, l) => s + (l.estRev || 0), 0);
>>>>>>> origin/master
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  const namedLops = allLops.filter(l => l.namaAm && l.namaAm !== "");
  const amSet = new Set(namedLops.map(l => l.nikAm).filter(Boolean));
  const pelangganSet = new Set(allLops.map(l => l.pelanggan).filter(Boolean));
  const unidentifiedCount = allLops.length - namedLops.length;

  const statusGroups = Object.entries(
    allLops.reduce((acc: any, l) => {
      const s = l.statusF || "Unknown";
      if (!acc[s]) acc[s] = { status: s, count: 0, totalNilai: 0 };
      acc[s].count++;
      acc[s].totalNilai += l.nilaiProyek || 0;
      return acc;
    }, {})
  ).map(([, v]) => v);

<<<<<<< HEAD
  const masterLops = namedLops.filter(l => l.nikAm && activeNikSet.has(l.nikAm));
  const amGroups = Object.entries(
    masterLops.reduce((acc: any, l) => {
      const key = l.nikAm || l.namaAm || "Unknown";
      if (!acc[key]) acc[key] = {
        namaAm: l.namaAm || "", nik: l.nikAm || "", divisi: l.divisi || "",
        totalLop: 0, totalNilai: 0, shortage: 0, statusMap: {}
      };
      acc[key].totalLop++;
      acc[key].totalNilai += l.nilaiProyek || 0;
      const s = l.statusF || "Unknown";
      if (!acc[key].statusMap[s]) acc[key].statusMap[s] = { status: s, count: 0, totalNilai: 0 };
      acc[key].statusMap[s].count++;
      acc[key].statusMap[s].totalNilai += l.nilaiProyek || 0;
      return acc;
    }, {})
  ).map(([, v]: any) => ({
=======
  const masterLops = namedLops.filter(l => {
      const handlingNiks = (l.nikHandling || "").split(",").map(n => n.trim()).filter(Boolean);
      return handlingNiks.some(n => activeNikSet.has(n)) || (l.nikAm && activeNikSet.has(l.nikAm));
  });

  const amGroupsMap: Record<string, any> = {};
  for (const l of masterLops) {
      const handlingNiks = (l.nikHandling || "").split(",").map(n => n.trim()).filter(Boolean);
      const targets = handlingNiks.length > 0 ? handlingNiks.filter(n => activeNikSet.has(n)) : [l.nikAm].filter(n => n && activeNikSet.has(n));
      for (const nik of targets) {
          if (!amGroupsMap[nik]) {
              amGroupsMap[nik] = {
                  namaAm: masterAmByNik.get(nik) || nik,
                  nik: nik,
                  divisi: l.divisi || "",
                  totalLop: 0,
                  totalNilai: 0,
                  shortage: 0,
                  statusMap: {}
              };
          }
          const group = amGroupsMap[nik];
          group.totalLop++;
          group.totalNilai += l.nilaiProyek || 0;
          const s = l.statusF || "Unknown";
          if (!group.statusMap[s]) group.statusMap[s] = { status: s, count: 0, totalNilai: 0 };
          group.statusMap[s].count++;
          group.statusMap[s].totalNilai += l.nilaiProyek || 0;
      }
  }

  const amGroups = Object.values(amGroupsMap).map((v: any) => ({
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
    namaAm: v.namaAm, nik: v.nik, divisi: v.divisi,
    totalLop: v.totalLop, totalNilai: v.totalNilai, shortage: 0,
    byStatus: Object.values(v.statusMap),
  }));

  let targetHoVal = 0, targetFullHoVal = 0;
  const targetByDivisi: Record<string, { targetHo: number; targetFullHo: number }> = {};
  const allTargets = await db.select().from(salesFunnelTargetTable)
    .orderBy(desc(salesFunnelTargetTable.tahun), desc(salesFunnelTargetTable.bulan));

  if (allTargets.length > 0) {
    const selectedYear = tahun ? Number(tahun) : null;
    const importPeriod = import_id
      ? (await db.select().from(dataImportsTable).where(eq(dataImportsTable.id, Number(import_id))))[0]?.period
      : null;
    const importYear = importPeriod ? Number(importPeriod.slice(0, 4)) : null;
    const importMonth = importPeriod ? Number(importPeriod.slice(5, 7)) : null;
    const lookupYear = selectedYear || importYear;
    const lookupMonth = importMonth;
    const divisiFilter = divisi ? String(divisi) : null;

    let matched = allTargets;
    if (lookupYear) matched = matched.filter(t => t.tahun === lookupYear);
    // bulan=null means target berlaku seluruh tahun — tetap match jika bulan tidak dispesifik
    if (lookupMonth) matched = matched.filter(t => t.bulan === null || t.bulan === lookupMonth);

    // Build per-divisi target breakdown
    for (const t of matched) {
      if (t.divisi) {
        if (!targetByDivisi[t.divisi]) targetByDivisi[t.divisi] = { targetHo: 0, targetFullHo: 0 };
        targetByDivisi[t.divisi].targetHo += t.targetHo || 0;
        targetByDivisi[t.divisi].targetFullHo += t.targetFullHo || 0;
      }
    }

    if (divisiFilter && divisiFilter !== "all") {
      const expanded = expandDivisi(divisiFilter);
      const divMatch = matched.filter(t => t.divisi && expanded.includes(t.divisi));
      if (divMatch.length > 0) {
        targetHoVal = divMatch.reduce((s, t) => s + (t.targetHo || 0), 0);
        targetFullHoVal = divMatch.reduce((s, t) => s + (t.targetFullHo || 0), 0);
      }
    } else {
      const withDivisi = matched.filter(t => t.divisi);
      if (withDivisi.length > 0) {
        targetHoVal = withDivisi.reduce((s, t) => s + (t.targetHo || 0), 0);
        targetFullHoVal = withDivisi.reduce((s, t) => s + (t.targetFullHo || 0), 0);
      } else if (matched.length > 0) {
        targetHoVal = matched[0].targetHo || 0;
        targetFullHoVal = matched[0].targetFullHo || 0;
      }
    }
  }

  const shortage = targetFullHoVal > 0 ? targetFullHoVal - totalNilai : 0;

  // AM-level annual targets
  const amTargetYear = tahun ? Number(tahun) : (() => {
    const importPeriod = import_id ? null : null; // resolved below
    return new Date().getFullYear();
  })();
  const amTargetRows = await db.select().from(amFunnelTargetTable).where(eq(amFunnelTargetTable.tahun, amTargetYear));
<<<<<<< HEAD
  const amTargets: Record<string, { id: number; targetValue: number; targetValueDss: number | null; targetValueDps: number | null; tahun: number }> = {};
  for (const r of amTargetRows) amTargets[r.nikAm] = { id: r.id, targetValue: r.targetValue, targetValueDss: r.targetValueDss ?? null, targetValueDps: r.targetValueDps ?? null, tahun: r.tahun };

  res.json({
    totalLop, totalNilai, totalEstRev,
=======
<<<<<<< HEAD
  const amTargets: Record<string, { id: number; targetValue: number; tahun: number }> = {};
  for (const r of amTargetRows) amTargets[r.nikAm] = { id: r.id, targetValue: r.targetValue, tahun: r.tahun };

  res.json({
    totalLop, totalNilai,
=======
  const amTargets: Record<string, { id: number; targetValue: number; targetValueDss: number | null; targetValueDps: number | null; tahun: number }> = {};
  for (const r of amTargetRows) amTargets[r.nikAm] = { id: r.id, targetValue: r.targetValue, targetValueDss: r.targetValueDss ?? null, targetValueDps: r.targetValueDps ?? null, tahun: r.tahun };

  console.log("DEBUG FIRST LOP:", allLops[0]);

  res.json({
    totalLop, totalNilai, totalEstRev,
>>>>>>> origin/master
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
    targetHo: targetHoVal,
    targetFullHo: targetFullHoVal,
    targetByDivisi,
    realFullHo: totalNilai,
    shortage,
    amCount: amSet.size,
    pelangganCount: pelangganSet.size,
    unidentifiedLops: unidentifiedCount,
    byStatus: statusGroups,
    byAm: amGroups,
    amTargets,
    amTargetYear,
    availableTahunAnggaran,
    lops: allLops.map(l => ({
      id: l.id,
      lopid: l.lopid,
      judulProyek: l.judulProyek,
      pelanggan: l.pelanggan,
      nilaiProyek: l.nilaiProyek,
<<<<<<< HEAD
      estRev: l.estRev ?? null,
=======
<<<<<<< HEAD
=======
      estRev: l.estRev ?? null,
>>>>>>> origin/master
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
      divisi: l.divisi,
      segmen: l.segmen,
      statusF: l.statusF,
      proses: l.proses,
      statusProyek: l.statusProyek,
      kategoriKontrak: l.kategoriKontrak,
<<<<<<< HEAD
      projectType: l.projectType ?? null,
      isReport: l.isReport ?? null,
=======
<<<<<<< HEAD
=======
      projectType: l.projectType ?? null,
      isReport: l.isReport ?? null,
>>>>>>> origin/master
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
      estimateBulan: l.estimateBulan,
      monthSubs: l.monthSubs ?? null,
      namaAm: l.namaAm,
      nikAm: l.nikAm,
<<<<<<< HEAD
=======
      nikHandling: l.nikHandling,
      namaPembuatLop: l.namaPembuatLop,
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
      reportDate: l.reportDate,
      tahunAnggaran: l.tahunAnggaran,
    })),
  });
});

export default router;
