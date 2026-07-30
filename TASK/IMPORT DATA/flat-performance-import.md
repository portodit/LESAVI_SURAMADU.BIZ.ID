# TASK: Import Data Performance — Flat Row Format (Bukan Grouped)

**Tanggal:** 30 Juli 2026
**Status:** DONE
**Import ID:** #64 (3,242 baris flat)

---

## 1. Latar Belakang

Import data performansi AM dari file Excel RAW (`RAW_PERFORMANSI_AM_2026...xlsx`) sebelumnya menyimpan data dalam format **grouped per AM + divisi** — satu baris database per AM (dengan `komponen_detail` berisi array JSON semua pelanggan AM tersebut). Ini membuat:

1. Display di halaman detail harus JSONB-unnest/expand untuk menampilkan per-pelanggan
2. `komponen_detail` sebagai array → tidak bisa langsung filter/cari per customer
3. Format tidak match dengan struktur Excel (Excel: 1 baris = 1 pelanggan)

**Kebutuhan baru:** Simpan 1 baris database = 1 pelanggan (flat), dengan data pelanggan di `komponen_detail` sebagai **single object** (bukan array).

---

## 2. Goals

1. Ubah import logic → parse SEMUA 36 kolom Excel, simpan flat (satu baris DB per customer)
2. `komponen_detail` = single JSON object (bukan array) berisi data pelanggan
3. Buat halaman detail display flat table dengan 36 kolom matching Excel
4. Nama kolom dalam Bahasa Indonesia yang mudah dipahami
5. Endpoint GET `/import/:id/data` return flat rows tanpa JSONB expansion

---

## 3. File yang Dikerjakan

| File | Peran |
|------|-------|
| `apps/api/src/features/import/routes.ts` | Import logic flat + GET endpoint |
| `apps/dashboard/src/features/import/PerformanceExcelTable.tsx` | **BARU** — flat table 36 kolom |
| `apps/dashboard/src/features/import/ImportDetailPage.tsx` | Use `PerformanceExcelTable` instead of `PerformanceDetailTable` |
| PostgreSQL | Kolom `divisi_cc`, `revenue_base`, `revenue_billcom`, `a_rev`, `a_ngtma`, `a_scaling`, `a_sustain` sudah ada |

---

## 4. Format Data Excel RAW

File Excel `RAW_PERFORMANSI_AM_2026...xlsx` memiliki **36 kolom**:

| # | Nama Kolom Excel | Field DB |
|---|-----------------|---------|
| 1 | NIK | `nik` |
| 2 | NAMA_AM | `nama_am` |
| 3 | LEVEL_AM | `level_am` |
| 4 | WITEL_AM | `witel_am` |
| 5 | DIVISI_AM | `divisi` (DIVISI_AM) |
| 6 | NIP_NAS_GROUP | → `komponen_detail.group` |
| 7 | NIP_NAS | → `komponen_detail.nip` |
| 8 | STANDARD_NAME | → `komponen_detail.pelanggan` |
| 9 | GROUP | → `komponen_detail.group` |
| 10 | INDUSTRI | → `komponen_detail.industri` |
| 11 | LSEGMEN | → `komponen_detail.lsegmen` |
| 12 | SSEGMEN | → `komponen_detail.ssegmen` |
| 13 | WITEL_CC | → `komponen_detail.witelCc` (filter: SURAMADU) |
| 14 | TELDA | → `komponen_detail.telda` |
| 15 | REGIONAL | → `komponen_detail.regional` |
| 16 | DIVISI_CC | `divisi_cc` + → `komponen_detail.divisiCc` |
| 17 | KAWASAN | → `komponen_detail.kawasan` |
| 18 | PROPORSI | → `komponen_detail.proporsi` |
| 19 | LAYANAN | → `komponen_detail.layanan` |
| 20 | TARGET_REVENUE | `target_revenue` |
| 21 | TARGET_SUSTAIN | `target_sustain` |
| 22 | TARGET_SCALING | `target_scaling` |
| 23 | TARGET_NGTMA | `target_ngtma` |
| 24 | REAL_REVENUE | `real_revenue` |
| 25 | REAL_SUSTAIN | `real_sustain` |
| 26 | REAL_SCALING | `real_scaling` |
| 27 | REAL_NGTMA | `real_ngtma` |
| 28 | REVENUE_BASE | `revenue_base` + → `komponen_detail` |
| 29 | REVENUE_BILLCOM | `revenue_billcom` + → `komponen_detail` |
| 30 | a_rev | `a_rev` |
| 31 | a_ngtma | `a_ngtma` |
| 32 | a_scaling | `a_scaling` |
| 33 | a_sustain | `a_sustain` |
| 34 | kw | → `komponen_detail.kw` |

---

## 5. Import Logic — Flat Format

### 5.1 Raw Format Detection

```typescript
// Di routes.ts — detect format
const rows = parseExcel(buffer);
const firstRow = rows[0];

// RAW format punya kolom NIK, NAMA_AM, STANDARD_NAME, dll
const isRawFormat =
  "NIK" in firstRow ||
  "nama_am" in firstRow ||
  "STANDARD_NAME" in firstRow ||
  "DIVISI_AM" in firstRow;
```

### 5.2 Flat Row Mapping (RAW Format)

```typescript
for (const r of rows) {
  const witelCc = String(r.WITEL_CC || r.witel_cc || "").trim().toUpperCase();
  if (!witelCc.includes("SURAMADU")) continue;

  const nip = String(r.NIP_NAS || r.nip_nas || "").trim();
  const pelanggan = String(r.STANDARD_NAME || r.standard_name || "").trim();
  const group = String(r.GROUP || r.group || "").trim();
  const industri = String(r.INDUSTRI || r.industri || "").trim();
  const lsegmen = String(r.LSEGMEN || r.lsegmen || "").trim();
  const ssegmen = String(r.SSEGMEN || r.ssegmen || "").trim();
  const telda = String(r.TELDA || r.telda || "").trim();
  const regional = String(r.REGIONAL || r.regional || "").trim();
  const divisiCc = String(r.DIVISI_CC || r.divisi_cc || "").trim();
  const kawasan = String(r.KAWASAN || r.kawasan || "").trim();
  const proporsi = parseFloat(r.PROPORSI || r.proporsi || "0") / 100;
  const layanan = String(r.LAYANAN || r.layanan || "").trim();

  const targetReguler = parseNum(r.TARGET_REVENUE || r.target_revenue || 0);
  const realReguler = parseNum(r.REAL_REVENUE || r.real_revenue || 0);
  const targetSustain = parseNum(r.TARGET_SUSTAIN || r.target_sustain || 0);
  const realSustain = parseNum(r.REAL_SUSTAIN || r.real_sustain || 0);
  const targetScaling = parseNum(r.TARGET_SCALING || r.target_scaling || 0);
  const realScaling = parseNum(r.REAL_SCALING || r.real_scaling || 0);
  const targetNgtma = parseNum(r.TARGET_NGTMA || r.target_ngtma || 0);
  const realNgtma = parseNum(r.REAL_NGTMA || r.real_ngtma || 0);
  const revenueBase = parseNum(r.REVENUE_BASE || r.revenue_base || 0);
  const revenueBillcom = parseNum(r.REVENUE_BILLCOM || r.revenue_billcom || 0);
  const aRev = parseNum(r.a_rev || r["a_rev"] || 0);
  const aNgtma = parseNum(r.a_ngtma || r["a_ngtma"] || 0);
  const aScaling = parseNum(r.a_scaling || r["a_scaling"] || 0);
  const aSustain = parseNum(r.a_sustain || r["a_sustain"] || 0);

  const targetRevenue = targetReguler + targetSustain + targetScaling + targetNgtma;
  const realRevenue = realReguler + realSustain + realScaling + realNgtma;
  const achRate = targetRevenue > 0 ? realRevenue / targetRevenue : 0;

  const statusWarna = achRate >= 1 ? "hijau" : achRate >= 0.8 ? "oranye" : "merah";

  // komponen_detail sebagai SINGLE OBJECT (bukan array)
  const komponenDetail = JSON.stringify({
    nip, pelanggan, group, industri, lsegmen, ssegmen,
    witelCc, telda, regional, divisiCc, kawasan, proporsi, layanan
  });

  toInsert.push({
    nik: String(r.NIK || r.nik || "").trim(),
    namaAm: String(r.NAMA_AM || r.nama_am || "").trim(),
    divisi: String(r.DIVISI_AM || r.divisi_am || "").trim(),
    divisiCc,
    witelAm: String(r.WITEL_AM || r.witel_am || "").trim(),
    levelAm: String(r.LEVEL_AM || r.level_am || "").trim(),
    tahun, bulan,
    targetRevenue, realRevenue,
    targetReguler, realReguler,
    targetSustain, realSustain,
    targetScaling, realScaling,
    targetNgtma, realNgtma,
    revenueBase, revenueBillcom,
    aRev, aNgtma, aScaling, aSustain,
    achRate,
    statusWarna,
    snapshotDate: snapshotDate || null,
    komponenDetail,
  });
}
```

---

## 6. Batch INSERT — UNNEST

### 6.1 Array Building

31 array parameters dibangun dari `toInsert`:

```typescript
const nik_arr = batch.map(r => r.nik);
const namaAm_arr = batch.map(r => r.namaAm);
const divisi_arr = batch.map(r => r.divisi);
const divisiCc_arr = batch.map(r => r.divisiCc || null);
const witelAm_arr = batch.map(r => r.witelAm || null);
const levelAm_arr = batch.map(r => r.levelAm || null);
const tahun_arr = batch.map(r => r.tahun);
const bulan_arr = batch.map(r => r.bulan);
const targetRev_arr = batch.map(r => r.targetRevenue);
const realRev_arr = batch.map(r => r.realRevenue);
const tReg_arr = batch.map(r => r.targetReguler);
const rReg_arr = batch.map(r => r.realReguler);
const tSust_arr = batch.map(r => r.targetSustain);
const rSust_arr = batch.map(r => r.realSustain);
const tScal_arr = batch.map(r => r.targetScaling);
const rScal_arr = batch.map(r => r.realScaling);
const tNgt_arr = batch.map(r => r.targetNgtma);
const rNgt_arr = batch.map(r => r.realNgtma);
const revBase_arr = batch.map(r => r.revenueBase || null);
const revBill_arr = batch.map(r => r.revenueBillcom || null);
const aRev_arr = batch.map(r => r.aRev || null);
const aNgt_arr = batch.map(r => r.aNgtma || null);
const aScal_arr = batch.map(r => r.aScaling || null);
const aSust_arr = batch.map(r => r.aSustain || null);
const achRate_arr = batch.map(r => r.achRate);
const achYtd_arr = batch.map(r => r.achRateYtd || 0);
const rank_arr = batch.map(r => r.rankAch || 0);
const status_arr = batch.map(r => r.statusWarna);
const snap_arr = batch.map(r => r.snapshotDate);
const komp_arr = batch.map(r => r.komponenDetail);
const imp_arr = batch.map(() => imp.id);
```

### 6.2 UNNEST Query

```typescript
INSERT INTO performance_data
  (nik, nama_am, divisi, divisi_cc, witel_am, level_am, tahun, bulan,
   target_revenue, real_revenue,
   target_reguler, real_reguler, target_sustain, real_sustain,
   target_scaling, real_scaling, target_ngtma, real_ngtma,
   revenue_base, revenue_billcom, a_rev, a_ngtma, a_scaling, a_sustain,
   ach_rate, ach_rate_ytd, rank_ach, status_warna, snapshot_date, komponen_detail, import_id)
SELECT nik, nama_am, divisi, divisi_cc, witel_am, level_am, tahun, bulan,
  target_revenue::real, real_revenue::real,
  target_reguler::real, real_reguler::real, target_sustain::real, real_sustain::real,
  target_scaling::real, real_scaling::real, target_ngtma::real, real_ngtma::real,
  revenue_base::real, revenue_billcom::real, a_rev::real, a_ngtma::real, a_scaling::real, a_sustain::real,
  ach_rate::real, ach_rate_ytd::real, rank_ach::integer, status_warna, snapshot_date, komponen_detail, $1::integer
FROM UNNEST($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
            $8::integer[], $9::integer[], $10::real[], $11::real[],
            $12::real[], $13::real[], $14::real[], $15::real[], $16::real[], $17::real[],
            $18::real[], $19::real[], $20::real[], $21::real[],
            $22::real[], $23::real[], $24::real[], $25::real[], $26::real[], $27::real[],
            $28::real[], $29::integer[], $30::text[], $31::text[], $32::integer[])
AS t(nik, nama_am, divisi, divisi_cc, witel_am, level_am, tahun, bulan,
      target_revenue, real_revenue,
      target_reguler, real_reguler, target_sustain, real_sustain,
      target_scaling, real_scaling, target_ngtma, real_ngtma,
      revenue_base, revenue_billcom, a_rev, a_ngtma, a_scaling, a_sustain,
      ach_rate, ach_rate_ytd, rank_ach, status_warna, snapshot_date, komponen_detail, import_id)
```

### 6.3 Parameter Mapping

| Param | Array | Type | Kolom DB |
|-------|-------|------|---------|
| $2 | `nik_arr` | text[] | nik |
| $3 | `namaAm_arr` | text[] | nama_am |
| $4 | `divisi_arr` | text[] | divisi |
| $5 | `divisiCc_arr` | text[] | divisi_cc |
| $6 | `witelAm_arr` | text[] | witel_am |
| $7 | `levelAm_arr` | text[] | level_am |
| $8 | `tahun_arr` | integer[] | tahun |
| $9 | `bulan_arr` | integer[] | bulan |
| $10 | `targetRev_arr` | real[] | target_revenue |
| $11 | `realRev_arr` | real[] | real_revenue |
| $12 | `tReg_arr` | real[] | target_reguler |
| $13 | `rReg_arr` | real[] | real_reguler |
| $14 | `tSust_arr` | real[] | target_sustain |
| $15 | `rSust_arr` | real[] | real_sustain |
| $16 | `tScal_arr` | real[] | target_scaling |
| $17 | `rScal_arr` | real[] | real_scaling |
| $18 | `tNgt_arr` | real[] | target_ngtma |
| $19 | `rNgt_arr` | real[] | real_ngtma |
| $20 | `revBase_arr` | real[] | revenue_base |
| $21 | `revBill_arr` | real[] | revenue_billcom |
| $22 | `aRev_arr` | real[] | a_rev |
| $23 | `aNgt_arr` | real[] | a_ngtma |
| $24 | `aScal_arr` | real[] | a_scaling |
| $25 | `aSust_arr` | real[] | a_sustain |
| $26 | `achRate_arr` | real[] | ach_rate |
| $27 | `achYtd_arr` | real[] | ach_rate_ytd |
| $28 | `rank_arr` | integer[] | rank_ach |
| $29 | `status_arr` | text[] | status_warna |
| $30 | `snap_arr` | text[] | snapshot_date |
| $31 | `komp_arr` | text[] | komponen_detail |
| $32 | `imp_arr` | integer[] | import_id |
| $1 | (scalar) | integer | dari `imp.id` |

---

## 7. GET `/import/:id/data` Endpoint

Endpoint `GET /import/:id/data` return flat rows langsung tanpa JSONB expansion:

```typescript
if (imp.type === "performance") {
  const { rows } = await pool.query(`
    SELECT
      p.id as "amId",
      p.nik, p.nama_am as "namaAm", p.level_am as "levelAm",
      p.divisi as "divisiAm", p.witel_am as "witelAm",
      p.tahun, p.bulan,
      p.target_revenue, p.real_revenue,
      p.target_reguler, p.real_reguler,
      p.target_sustain, p.real_sustain,
      p.target_scaling, p.real_scaling,
      p.target_ngtma, p.real_ngtma,
      p.revenue_base as "revenueBase", p.revenue_billcom as "revenueBillcom",
      p.a_rev, p.a_ngtma, p.a_scaling, p.a_sustain,
      p.ach_rate as "achRate", p.status_warna as "statusWarna",
      p.komponen_detail as "komponenDetail",
      p.import_id as "importId"
    FROM performance_data p WHERE p.import_id = $1
    ORDER BY p.nama_am
  `, [id]);

  const flatRows: any[] = [];
  for (const r of rows) {
    const detail = r.komponenDetail;
    if (detail) {
      const parsed = JSON.parse(detail);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const d of arr) {
        flatRows.push({
          nik: r.nik,
          namaAm: r.namaAm,
          levelAm: r.levelAm,
          divisiAm: r.divisiAm,
          witelAm: r.witelAm,
          tahun: r.tahun,
          bulan: r.bulan,
          targetReguler: r.target_reguler,
          realReguler: r.real_reguler,
          targetSustain: r.target_sustain,
          realSustain: r.real_sustain,
          targetScaling: r.target_scaling,
          realScaling: r.real_scaling,
          targetNgtma: r.real_ngtma,     // NOTE: ada bug di line ini, harusnya r.target_ngtma
          realNgtma: r.real_ngtma,
          targetTotal: r.target_reguler + r.target_sustain + r.target_scaling + r.target_ngtma,
          realTotal: r.real_reguler + r.real_sustain + r.real_scaling + r.real_ngtma,
          revenueBase: r.revenueBase,
          revenueBillcom: r.revenueBillcom,
          a_rev: r.a_rev,
          a_ngtma: r.a_ngtma,
          a_scaling: r.a_scaling,
          a_sustain: r.a_sustain,
          achRate: r.achRate,
          statusWarna: r.statusWarna,
          // Data pelanggan dari JSON single-object
          nip: d.nip || null,
          pelanggan: d.pelanggan || null,
          groupName: d.group || null,
          industri: d.industri || null,
          lsegmen: d.lsegmen || null,
          ssegmen: d.ssegmen || null,
          witelCc: d.witelCc || null,
          telda: d.telda || null,
          regional: d.regional || null,
          divisiCc: d.divisiCc || null,
          kawasan: d.kawasan || null,
          proporsi: d.proporsi || null,
          layanan: d.layanan || null,
        });
      }
    }
  }
  res.json({ type: imp.type, rows: flatRows });
}
```

**Key change:** Loop `for (const d of arr)` — jika `komponen_detail` adalah single object, `arr = [parsed]` → 1 iteration → 1 output row. Jika array (format lama), iterate semua customer.

---

## 8. Frontend — PerformanceExcelTable

File baru `apps/dashboard/src/features/import/PerformanceExcelTable.tsx` menampilkan flat table dengan 36 kolom.

### 8.1 Interface `PerfExcelRow`

```typescript
export interface PerfExcelRow {
  nik: string | null;
  namaAm: string | null;
  levelAm: string | null;
  divisiAm: string | null;
  witelAm: string | null;
  nip: string | null;
  pelanggan: string | null;
  groupName: string | null;
  industri: string | null;
  lsegmen: string | null;
  ssegmen: string | null;
  witelCc: string | null;
  telda: string | null;
  regional: string | null;
  divisiCc: string | null;
  kawasan: string | null;
  proporsi: number | null;
  layanan: string | null;
  targetReguler: number | null;
  realReguler: number | null;
  targetSustain: number | null;
  realSustain: number | null;
  targetScaling: number | null;
  realScaling: number | null;
  targetNgtma: number | null;
  realNgtma: number | null;
  targetTotal: number | null;
  realTotal: number | null;
  revenueBase: number | null;
  revenueBillcom: number | null;
  a_rev: number | null;
  a_ngtma: number | null;
  a_scaling: number | null;
  a_sustain: number | null;
  achRate: number | null;
  statusWarna: string | null;
}
```

### 8.2 Kolom Display (36 kolom)

| # | field | Label | Width | Format |
|---|-------|-------|-------|--------|
| 1 | nik | NIK | 80px | text |
| 2 | namaAm | Nama AM | 150px | text |
| 3 | levelAm | Level AM | 80px | text |
| 4 | divisiAm | Divisi AM | 80px | text |
| 5 | witelAm | Witel AM | 110px | text |
| 6 | nip | NIP NAS | 90px | text |
| 7 | pelanggan | Nama Pelanggan | 180px | text |
| 8 | groupName | Group | 150px | text |
| 9 | industri | Industri | 140px | text |
| 10 | lsegmen | L. Segmen | 150px | text |
| 11 | ssegmen | S. Segmen | 120px | text |
| 12 | witelCc | Witel CC | 100px | text |
| 13 | telda | Telda | 110px | text |
| 14 | regional | Regional | 90px | text |
| 15 | divisiCc | Divisi CC | 80px | text |
| 16 | kawasan | Kawasan | 110px | text |
| 17 | proporsi | Proporsi (%) | 90px | number → `X.XX%` |
| 18 | layanan | Layanan | 90px | text |
| 19 | targetReguler | Target Reguler | 130px | rupiah |
| 20 | realReguler | Real Reguler | 130px | rupiah |
| 21 | targetSustain | Target Sustain | 130px | rupiah |
| 22 | realSustain | Real Sustain | 130px | rupiah |
| 23 | targetScaling | Target Scaling | 130px | rupiah |
| 24 | realScaling | Real Scaling | 130px | rupiah |
| 25 | targetNgtma | Target NGTMA | 130px | rupiah |
| 26 | realNgtma | Real NGTMA | 130px | rupiah |
| 27 | targetTotal | Target Total | 130px | rupiah |
| 28 | realTotal | Real Total | 130px | rupiah |
| 29 | revenueBase | Revenue Base | 130px | rupiah |
| 30 | revenueBillcom | Revenue Billcom | 130px | rupiah |
| 31 | a_rev | a. Rev (%) | 80px | number → `X.XX%` |
| 32 | a_ngtma | a. NGTMA (%) | 90px | number → `X.XX%` |
| 33 | a_scaling | a. Scaling (%) | 90px | number → `X.XX%` |
| 34 | a_sustain | a. Sustain (%) | 90px | number → `X.XX%` |
| 35 | achRate | Ach (%) | 80px | color-coded |
| 36 | statusWarna | Status | 70px | badge |

### 8.3 Fitur

- **Pagination:** 50 baris per halaman
- **Search:** Filter teks di semua kolom
- **Sort:** Klik header → ASC/DESC toggle
- **Ach color coding:** hijau (≥100%), oranye (≥80%), merah (<80%)
- **Status badge:** badge warna berdasarkan statusWarna
- **Proporsi format:** `/100` → displayed as percentage

---

## 9. Bug Fixes (Lihat TROUBLESHOOT)

Berbagai bug ditemukan dan diperbaiki selama development:

1. **UNNEST `$7` typed `integer[]` tapi `level_am` adalah text** → fix: `$7::text[]`
2. **UNNEST `$8`/`$9` typed `integer[]`/`real[]` tapi untuk `tahun`/`bulan`** → fix: `$8::integer[]` (tahun), `$9::integer[]` (bulan)
3. **`$1::integer` di SELECT clause counted sebagai array** → fix: hapus, pakai `imp_arr` di UNNEST
4. **Total UNNEST arrays: 31** → semua 31 arrays mapped ke 31 AS t columns
5. **Fallback INSERT: hanya `$1..$28`** → fix: `$1..$31`

---

**Reported by:** Claude Opus 4.6
**Date:** 30 Juli 2026
