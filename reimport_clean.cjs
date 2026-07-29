// Clean reimport using one-by-one inserts (no UNNEST) to bypass the mapping mystery
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
  await pool.query("DELETE FROM performance_data");
  console.log("Cleared ALL performance_data");
  await pool.query("DELETE FROM data_imports WHERE type='performance'");
  console.log("Cleared all performance imports");

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

  const imp = await pool.query(
    "INSERT INTO data_imports(type,rows_imported,period,snapshot_date) VALUES('performance',$1,'2026-07','2026-07-13') RETURNING id",
    [toInsert.length]
  );
  const impId = imp.rows[0].id;
  console.log("New import ID:", impId);

  // ONE-BY-ONE inserts — bypasses UNNEST column mapping issues
  let totalOk = 0, totalFail = 0;
  const start = Date.now();
  for (const r of toInsert) {
    try {
      await pool.query(`
        INSERT INTO performance_data
          (nik, nama_am, divisi, tahun, bulan, target_revenue, real_revenue,
           target_reguler, real_reguler, target_sustain, real_sustain,
           target_scaling, real_scaling, target_ngtma, real_ngtma,
           ach_rate, ach_rate_ytd, rank_ach, status_warna, snapshot_date, komponen_detail, import_id)
        VALUES ($1,$2,$3,$4,$5,$6::numeric(20,4),$7::numeric(20,4),
                $8::numeric(20,4),$9::numeric(20,4),$10::numeric(20,4),$11::numeric(20,4),
                $12::numeric(20,4),$13::numeric(20,4),$14::numeric(20,4),$15::numeric(20,4),
                $16::numeric(20,6),$17::numeric(20,6),$18::integer,$19,$20,$21,$22)
      `, [
        r.nik, r.namaAm, r.divisi, r.tahun, r.bulan,
        r.targetRevenue, r.realRevenue,
        r.targetReguler, r.realReguler, r.targetSustain, r.realSustain,
        r.targetScaling, r.realScaling, r.targetNgtma, r.realNgtma,
        r.achRate, r.achRateYtd, r.rankAch,
        r.statusWarna, r.snapshotDate, r.komponenDetail, impId
      ]);
      totalOk++;
    } catch (e) {
      totalFail++;
      if (totalFail <= 3) console.log("  FAIL:", r.nik, e.message);
    }
  }
  console.log("\nInserted:", totalOk, "ok,", totalFail, "failed in", (Date.now() - start) + "ms");

  // Verify
  const sample = await pool.query(
    "SELECT nik, rank_ach, status_warna, snapshot_date, komponen_detail FROM performance_data WHERE import_id=$1 LIMIT 3",
    [impId]
  );
  console.log("\nVerification (should be: rank=0, status=hijau/oranye/merah, snapshot=2026-07-13, komponen=JSON):");
  for (const s of sample.rows) {
    console.log("  nik=" + s.nik + ", rank=" + s.rank_ach + ", status=" + s.status_warna + ", snap=" + s.snapshot_date + ", komponen=" + (s.komponen_detail ? "JSON" : "null"));
  }

  const total = await pool.query("SELECT COUNT(*) FROM performance_data");
  console.log("Total rows:", total.rows[0].count);

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
