// Reimport performance data with corrected VALUES order
const fs = require("fs");
const XLSX = require("xlsx");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: "postgresql://lesavi:lesavi123@localhost:5432/lesavi_db" });

function parseIndNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  let s = String(v).trim().replace(/\s/g, "");
  if (s === "") return 0;
  const hasDot = s.includes("."), hasComma = s.includes(",");
  if (hasDot && hasComma) {
    const li = s.lastIndexOf("."), lc = s.lastIndexOf(",");
    if (lc > li) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    const p = s.split(",");
    if (p.length === 2 && p[1].length <= 3 && p[0].length > 0) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  return parseFloat(s) || 0;
}

async function main() {
  await pool.query("DELETE FROM performance_data WHERE import_id = 40");
  await pool.query("DELETE FROM data_imports WHERE id = 40");
  console.log("Cleared import #40");

  const buf = fs.readFileSync("C:/Users/USER/Downloads/RAW_PERFORMANSI_AM_20260713.xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }).map(row => {
    const n = {};
    for (const [k, v] of Object.entries(row)) if (k) n[String(k).trim().replace(/\s+/g, " ").toUpperCase()] = v;
    return n;
  });

  const amMap = new Map();
  for (const r of rawRows) {
    const nik = String(r.NIK || "").trim();
    const namaAm = String(r.NAMA_AM || "").trim();
    const divisiRaw = String(r.DIVISI_CC || r.DIVISI_AM || "").trim();
    const periodeStr = String(r.PERIODE || "").trim();
    if (!nik || !namaAm || !periodeStr || periodeStr.length < 6 || !divisiRaw) continue;
    const key = nik + "__" + periodeStr + "__" + divisiRaw.toUpperCase();
    const tReg = parseIndNum(r.TARGET_REVENUE);
    const rReg = parseIndNum(r.REAL_REVENUE);
    const tSust = parseIndNum(r.TARGET_SUSTAIN || 0);
    const rSust = parseIndNum(r.REAL_SUSTAIN || 0);
    const tScal = parseIndNum(r.TARGET_SCALING || 0);
    const rScal = parseIndNum(r.REAL_SCALING || 0);
    const tNgt = parseIndNum(r.TARGET_NGTMA || 0);
    const rNgt = parseIndNum(r.REAL_NGTMA || 0);
    const targetTotal = tReg + tSust + tScal + tNgt;
    const realTotal = (
      Math.max(0, rReg) + Math.max(0, rSust) + Math.max(0, rScal) + Math.max(0, rNgt)
    ) - (
      Math.abs(Math.min(0, rReg)) + Math.abs(Math.min(0, rSust)) + Math.abs(Math.min(0, rScal)) + Math.abs(Math.min(0, rNgt))
    );
    if (!amMap.has(key)) amMap.set(key, { nik, namaAm, divisi: divisiRaw, periodeStr, target: 0, real: 0, tReg: 0, rReg: 0, tSust: 0, rSust: 0, tScal: 0, rScal: 0, tNgt: 0, rNgt: 0, customers: [] });
    const e = amMap.get(key);
    e.target += targetTotal; e.real += realTotal;
    e.tReg += tReg; e.rReg += rReg; e.tSust += tSust; e.rSust += rSust; e.tScal += tScal; e.rScal += rScal; e.tNgt += tNgt; e.rNgt += rNgt;
    const pelanggan = String(r.STANDARD_NAME || "").trim(), nip = String(r.NIP_NAS || "").trim();
    if (pelanggan || nip) e.customers.push({
      nip, pelanggan,
      Reguler: { target: tReg, real: rReg },
      Sustain: { target: tSust, real: rSust },
      Scaling: { target: tScal, real: rScal },
      NGTMA: { target: tNgt, real: rNgt },
      targetTotal, realTotal
    });
  }

  const toInsert = [...amMap.values()].map(entry => {
    const year = parseInt(entry.periodeStr.slice(0, 4), 10);
    const month = parseInt(entry.periodeStr.slice(4, 6), 10);
    const achRate = entry.target > 0 ? entry.real / entry.target : 0;
    return {
      nik: entry.nik, namaAm: entry.namaAm, divisi: entry.divisi,
      tahun: year, bulan: month,
      targetRevenue: entry.target, realRevenue: entry.real,
      targetReguler: entry.tReg, realReguler: entry.rReg,
      targetSustain: entry.tSust, realSustain: entry.rSust,
      targetScaling: entry.tScal, realScaling: entry.rScal,
      targetNgtma: entry.tNgt, realNgtma: entry.rNgt,
      achRate, achRateYtd: achRate, rankAch: 0,
      statusWarna: achRate >= 1 ? "hijau" : achRate >= 0.8 ? "oranye" : "merah",
      snapshotDate: "2026-07-13",
      komponenDetail: entry.customers.length > 0 ? JSON.stringify(entry.customers) : null,
    };
  }).filter(r => r.nik && r.namaAm);

  console.log("Entries:", toInsert.length);

  // Re-create import #40
  await pool.query("INSERT INTO data_imports(id,type,rows_imported,period,snapshot_date) VALUES(40,'performance',$1,'2026-07','2026-07-13')", [toInsert.length]);
  console.log("Created import #40");

  // UNNEST batch with CORRECT order: rank(int), snap(text), status(text), komp(text)
  const BATCH = 200;
  let totalOk = 0;
  const start = Date.now();
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const nik_arr = batch.map(r => r.nik), namaAm_arr = batch.map(r => r.namaAm), divisi_arr = batch.map(r => r.divisi);
    const tahun_arr = batch.map(r => r.tahun), bulan_arr = batch.map(r => r.bulan);
    const targetRev_arr = batch.map(r => r.targetRevenue), realRev_arr = batch.map(r => r.realRevenue);
    const tReg_arr = batch.map(r => r.targetReguler), rReg_arr = batch.map(r => r.realReguler);
    const tSust_arr = batch.map(r => r.targetSustain), rSust_arr = batch.map(r => r.realSustain);
    const tScal_arr = batch.map(r => r.targetScaling), rScal_arr = batch.map(r => r.realScaling);
    const tNgt_arr = batch.map(r => r.targetNgtma), rNgt_arr = batch.map(r => r.realNgtma);
    const achRate_arr = batch.map(r => r.achRate), achYtd_arr = batch.map(r => r.achRateYtd);
    const rank_arr = batch.map(r => r.rankAch), status_arr = batch.map(r => r.statusWarna);
    const snap_arr = batch.map(r => r.snapshotDate), komp_arr = batch.map(r => r.komponenDetail);

    try {
      const r = await pool.query(`
        INSERT INTO performance_data
          (nik, nama_am, divisi, tahun, bulan, target_revenue, real_revenue,
           target_reguler, real_reguler, target_sustain, real_sustain,
           target_scaling, real_scaling, target_ngtma, real_ngtma,
           ach_rate, ach_rate_ytd, rank_ach, status_warna, snapshot_date, komponen_detail, import_id)
        SELECT
          nik, nama_am, divisi, tahun, bulan, target_revenue::numeric(20,4), real_revenue::numeric(20,4),
          target_reguler::numeric(20,4), real_reguler::numeric(20,4), target_sustain::numeric(20,4), real_sustain::numeric(20,4),
          target_scaling::numeric(20,4), real_scaling::numeric(20,4), target_ngtma::numeric(20,4), real_ngtma::numeric(20,4),
          ach_rate::numeric(20,6), ach_rate_ytd::numeric(20,6), rank_ach::integer, status_warna, snapshot_date, komponen_detail, $1::integer
        FROM UNNEST($2::text[], $3::text[], $4::text[], $5::integer[], $6::integer[],
                    $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::numeric[], $12::numeric[],
                    $13::numeric[], $14::numeric[], $15::numeric[], $16::numeric[], $17::numeric[], $18::numeric[],
                    $19::integer[], $20::text[], $21::text[], $22::text[])
        AS t(nik, nama_am, divisi, tahun, bulan, target_revenue, real_revenue,
              target_reguler, real_reguler, target_sustain, real_sustain,
              target_scaling, real_scaling, target_ngtma, real_ngtma,
              ach_rate, ach_rate_ytd, rank_ach, status_warna, snapshot_date, komponen_detail)
      `, [40, nik_arr, namaAm_arr, divisi_arr, tahun_arr, bulan_arr,
          targetRev_arr, realRev_arr, tReg_arr, rReg_arr, tSust_arr, rSust_arr,
          tScal_arr, rScal_arr, tNgt_arr, rNgt_arr, achRate_arr, achYtd_arr,
          rank_arr, snap_arr, status_arr, komp_arr]);
      totalOk += r.rowCount;
      console.log("  Batch " + (Math.floor(i / BATCH) + 1) + " UNNEST OK:", r.rowCount);
    } catch (e) {
      console.log("  Batch FAILED:", e.message);
      for (const r of batch) {
        try {
          await pool.query(`INSERT INTO performance_data(nik,nama_am,divisi,tahun,bulan,target_revenue,real_revenue,target_reguler,real_reguler,target_sustain,real_sustain,target_scaling,real_scaling,target_ngtma,real_ngtma,ach_rate,ach_rate_ytd,rank_ach,status_warna,snapshot_date,komponen_detail,import_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
            [r.nik, r.namaAm, r.divisi, r.tahun, r.bulan, r.targetRevenue, r.realRevenue,
             r.targetReguler, r.realReguler, r.targetSustain, r.realSustain,
             r.targetScaling, r.realScaling, r.targetNgtma, r.realNgtma,
             r.achRate, r.achRateYtd, r.rankAch, r.statusWarna, r.snapshotDate, r.komponenDetail, 40]);
          totalOk++;
        } catch (e2) { console.log("  Row FAILED:", r.nik, e2.message); }
      }
    }
  }
  console.log("\nInserted:", totalOk, "/", toInsert.length, "in", (Date.now() - start) + "ms");

  // Verify fix
  const sample = await pool.query("SELECT nik, rank_ach, status_warna, snapshot_date FROM performance_data WHERE import_id=40 LIMIT 1");
  console.log("\nVerification (should be: rank=0, status=hijau/oranye/merah, snapshot=2026-07-13):");
  console.log("  ", JSON.stringify(sample.rows[0]));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
