# TROUBLESHOOT: Import Performance Data — UNNEST Batch INSERT

**Tanggal:** 30 Juli 2026
**Error:** Import gagal HTTP 500, data tidak tersimpan di DB

---

## Gejala

1. Import file Excel RAW `RAW_PERFORMANSI_AM_2026...xlsx` → HTTP 500
2. `data_imports` record terbuat (`rows_imported: 3242`) tapi `performance_data` kosong
3. Endpoint GET `/import/:id/data` return `[]`

---

## Root Cause

Batch INSERT via UNNEST gagal tanpa error yang ter-catch. Beberapa bug di query template:

### Bug 1: `$7` typed `integer[]` seharusnya `text[]`

`level_am` adalah kolom `text`, tapi di UNNEST typed sebagai `$7::integer[]`.

```sql
-- SALAH:
FROM UNNEST($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::integer[],
--                                                     ↑
-- level_am adalah text, tidak bisa di-cast ke integer
```

Fix:
```sql
-- BENAR:
FROM UNNEST($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
```

### Bug 2: `$8` dan `$9` typed salah

`tahun` typed `$8::integer[]` (benar), tapi `$9::real[]` untuk `bulan` seharusnya `$9::integer[]`. Kemudian `target_revenue` yang harusnya `$10::real[]` tertulis `$9::real[]`, menggeser semua type berikutnya.

```sql
-- SALAH (original):
$8::integer[], $9::integer[], $9::real[], $10::real[],   -- tahun, bulan, targetRev, realRev
--                                                                 ↑ duplikat $9, $10 seharusnya real[]

-- BENAR:
$8::integer[], $9::integer[], $10::real[], $11::real[],   -- tahun, bulan, targetRev, realRev
```

### Bug 3: `$1::integer` di SELECT clause counted sebagai array

Query asli punya:
```sql
SELECT ..., komponen_detail, $1::integer   -- $1 = imp.id (scalar)
  FROM UNNEST($2::text[], ..., $31::text[]) -- 30 arrays
  AS t(nik, ..., komponen_detail)          -- 29 columns
```

Masalah: `$1` counted sebagai expression ke-30 di SELECT, tapi tidak ada parameter array ke-30 (UNNEST hanya punya 30 arrays). Ini menyebabkan "30 columns specified but 29 available in AS t".

Fix: Hapus `$1::integer` dari SELECT, tambahkan `imp_arr` sebagai `$32::integer[]` di UNNEST, dan map ke `import_id` di AS t(...).

```sql
-- BENAR:
SELECT ..., komponen_detail, import_id
  FROM UNNEST($2::text[], ..., $31::text[], $32::integer[])
  AS t(nik, ..., komponen_detail, import_id)
```

### Bug 4: Fallback INSERT hanya `$1..$28`, seharusnya `$1..$31`

Fallback INSERT (digunakan jika UNNEST gagal) punya placeholder `$1..$28` tapi ada 31 kolom + `import_id`:

Kolom INSERT: `nik, nama_am, divisi, divisi_cc, witel_am, level_am, tahun, bulan, target_revenue, real_revenue, target_reguler, real_reguler, target_sustain, real_sustain, target_scaling, real_scaling, target_ngtma, real_ngtma, revenue_base, revenue_billcom, a_rev, a_ngtma, a_scaling, a_sustain, ach_rate, ach_rate_ytd, rank_ach, status_warna, snapshot_date, komponen_detail, import_id`

Total: 31 parameter.

```sql
-- SALAH (original):
VALUES ($1,$2,...,$27,$28)   -- hanya 28 placeholder

-- BENAR:
VALUES ($1,$2,...,$30,$31)   -- 31 placeholder
```

---

## Dampak Bug

| Bug | Dampak |
|-----|--------|
| Bug 1 (`$7::integer[]`) | `level_am` selalu NULL, error integer coercion |
| Bug 2 (type shift) | Semua revenue/target columns typed salah, data corruption |
| Bug 3 (scalar counted) | UNNEST query fail silently, 0 rows inserted |
| Bug 4 (fallback) | Fallback juga fail karena parameter mismatch |

Kesimpulan: UNNEST fail (Bug 3) + Fallback fail (Bug 4) = 0 rows inserted.

---

## Fix Summary

File: `apps/api/src/features/import/routes.ts`

### Fix 1: UNNEST parameter types
```sql
-- Sebelum:
$7::integer[], $8::integer[], $9::real[], $10::real[], ...

-- Sesudah:
$7::text[], $8::integer[], $9::integer[], $10::real[], $11::real[], ...
```

### Fix 2: Hapus `$1::integer` dari SELECT, tambahkan `import_id` ke UNNEST dan AS t
```sql
-- SELECT: hapus $1::integer
-- UNNEST: tambahkan $32::integer[] (imp_arr)
-- AS t: tambahkan import_id di akhir
-- Params array: tambahkan imp_arr
```

### Fix 3: Fallback VALUES
```sql
-- Sebelum:
VALUES ($1,$2,...,$27,$28)

-- Sesudah:
VALUES ($1,$2,...,$30,$31)
```

---

## Debugging Steps yang Dilakukan

1. **DB check:** `SELECT COUNT(*) FROM performance_data WHERE import_id=62` → 0
2. **Import history check:** `data_imports` punya record dengan `rows_imported=3242` tapi DB kosong
3. **Schema check:** Semua 33 kolom ada di DB (termasuk `divisi_cc`, `revenue_base`, dll)
4. **Test insert via node pg:** Berulang kali test UNNEST query sampai menemukan exact mismatch
5. **Source vs dist sync:** Build ulang (`rm -rf dist && pnpm run build`) untuk pastikan dist terbaru

### Test Command (PostgreSQL)

```sql
-- Test UNNEST dengan 1 baris:
INSERT INTO performance_data
  (nik,nama_am,divisi,divisi_cc,witel_am,level_am,tahun,bulan,
   target_revenue,real_revenue,
   target_reguler,real_reguler,target_sustain,real_sustain,
   target_scaling,real_scaling,target_ngtma,real_ngtma,
   revenue_base,revenue_billcom,a_rev,a_ngtma,a_scaling,a_sustain,
   ach_rate,ach_rate_ytd,rank_ach,status_warna,snapshot_date,komponen_detail,import_id)
SELECT nik,nama_am,divisi,divisi_cc,witel_am,level_am,tahun,bulan,
  target_revenue::real,real_revenue::real,
  target_reguler::real,real_reguler::real,target_sustain::real,real_sustain::real,
  target_scaling::real,real_scaling::real,target_ngtma::real,real_ngtma::real,
  revenue_base::real,revenue_billcom::real,a_rev::real,a_ngtma::real,a_scaling::real,a_sustain::real,
  ach_rate::real,ach_rate_ytd::real,rank_ach::integer,status_warna,snapshot_date,komponen_detail,import_id
FROM UNNEST($2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],
            $8::integer[],$9::integer[],$10::real[],$11::real[],
            $12::real[],$13::real[],$14::real[],$15::real[],$16::real[],$17::real[],
            $18::real[],$19::real[],$20::real[],$21::real[],
            $22::real[],$23::real[],$24::real[],$25::real[],$26::real[],$27::real[],
            $28::real[],$29::integer[],$30::text[],$31::text[],$32::integer[])
AS t(nik,nama_am,divisi,divisi_cc,witel_am,level_am,tahun,bulan,
      target_revenue,real_revenue,
      target_reguler,real_reguler,target_sustain,real_sustain,
      target_scaling,real_scaling,target_ngtma,real_ngtma,
      revenue_base,revenue_billcom,a_rev,a_ngtma,a_scaling,a_sustain,
      ach_rate,ach_rate_ytd,rank_ach,status_warna,snapshot_date,komponen_detail,import_id)

-- Params: [imp_arr, nik_arr, namaAm_arr, divArr, dccArr, witelArr, levelArr,
--          tahunArr, bulanArr, tRevArr, rRevArr, tRegArr, rRegArr, tSustArr, rSustArr,
--          tScalArr, rScalArr, tNgtArr, rNgtArr, revBaseArr, revBillArr,
--          aRevArr, aNgtArr, aScalArr, aSustArr, achRateArr, achYtdArr,
--          rankArr, statusArr, snapArr, kompArr]
```

---

## Lesson Learned

1. **UNNEST column count harus match AS t(...) count** — scalar expressions di SELECT di-count oleh PG
2. **Type consistency antara template dan params** — `$N` numbered params di template string harus match number of arrays
3. **Build dist verification** — selalu verify `dist/` setelah `rm -rf dist && build`
4. **Fallback INSERT** — harus di-treat sama ketatnya dengan primary path; selalu test keduanya

---

**Reported by:** Claude Opus 4.6
**Date:** 30 Juli 2026
