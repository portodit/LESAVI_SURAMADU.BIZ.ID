# Analisis File: RAW_PERFORMANSI_AM_20260713.xlsx

## Overview

| Property | Value |
|---|---|
| **File** | `RAW_PERFORMANSI_AM_20260713.xlsx` |
| **Sheet** | `RAW_AM` |
| **Total Records** | 7,750 baris |
| **Kolom** | 36 |
| **Periode Coverage** | 12 bulan (202601 – 202612) |
| **Unique AM** | 94 |
| **Format** | Flat sheet (bukan pivot cache) |

---

## Struktur Kolom (6 Grup)

### Grup 1 — Identitas AM

| Kolom | Deskripsi | Catatan |
|---|---|---|
| `PERIODE` | Tahun-bulan dalam format `YYYYMM` | 12 nilai unik (202601–202612) |
| `NIK` | Nomor Induk Karyawan AM | String numerik, 4–8 digit |
| `NAMA_AM` | Nama Account Manager | 94 nama unik |
| `LEVEL_AM` | Jenjang level AM | AM 1 / AM 2 / AM 3 / AM / SAM |
| `POSITION` | — | **100% NULL**, kolom kosong, di-skip |

### Grup 2 — Customer Identity

| Kolom | Deskripsi | Catatan |
|---|---|---|
| `NIP_NAS_GROUP` | NIP NAS Group | Bisa sama dengan NIP_NAS |
| `NIP_NAS` | NIP NAS pelanggan | Identitas pelanggan per am |
| `STANDARD_NAME` | Nama pelanggan (perusahaan) | primary key per baris |
| `GROUP` | Group perusahaan pelanggan | 107 grup unik (PEMKAB, Astra Group, dll) |
| `INDUSTRI` | Sektor industri | 31 jenis (Process Manufacturing, Developer, dll) |

### Grup 3 — Segmentation

| Kolom | Deskripsi | Catatan |
|---|---|---|
| `LSEGMEN` | Large Segment (nama lengkap) | 11 segmen |
| `SSEGMEN` | Sub-Segment (kode singkat) | 11 kode: B2B TREG, FWS, LMS, PRS, TWS, PCS, RMS, MIS, FRBS, ERS, PBS |
| `WITEL_CC` | Witelspelkat Customer Center | 9 witel |
| `TELDA` | Terminal Data | 67 wilayah (Manyar, Tandes, Ketintang, dll) |
| `REGIONAL` | Regional | Hanya TREG 3 (7,678 baris) dan HQ (72 baris) |
| `KAWASAN` | Status Kawasan | KAWASAN (132) vs NON KAWASAN (7,618) |

### Grup 4 — Proportion & Attribute

| Kolom | Deskripsi | Catatan |
|---|---|---|
| `PROPORSI` | Proporsi revenue terhadap AM | 1.0 = AM penuh, 0.99, 0.5, 0.3, 0.2, dll |
| `LAYANAN` | — | **100% = "0"**, tidak berguna, di-skip |

### Grup 5 — Revenue TARGET (Per Customer Per Bulan)

| Kolom | Deskripsi | Zero Rate |
|---|---|---|
| `TARGET_REVENUE` | Target revenue total | 0.2% |
| `TARGET_SUSTAIN` | Target sustain | 9.6% |
| `TARGET_SCALING` | Target scaling | 0.9% |
| `TARGET_NGTMA` | Target NGTMA | 30.4% |

### Grup 6 — Revenue REALIZATION (Per Customer Per Bulan)

| Kolom | Deskripsi | Zero Rate | Neg Rate |
|---|---|---|---|
| `REAL_REVENUE` | Realisasi revenue total | 55.9% | **1.4%** |
| `REAL_SUSTAIN` | Realisasi sustain | 92.8% | **0.3%** |
| `REAL_SCALING` | Realisasi scaling | 95.5% | **0.2%** |
| `REAL_NGTMA` | Realisasi NGTMA | 99.7% | 0% |
| `REVENUE_BASE` | Revenue base | 56.0% | **0.1%** |
| `REVENUE_BILLCOM` | Revenue billable/communicom | 91.2% | **0.8%** |

### Grup 7 — Achievement Rate

| Kolom | Deskripsi | Zero Rate | Range |
|---|---|---|---|
| `a_rev` | Achievement rate = REAL_REVENUE / TARGET_REVENUE | 55.9% | -71.85 s/d 109.58 |
| `a_ngtma` | Achievement rate NGTMA | 99.7% | 0.24 s/d 23.81 |
| `a_scaling` | Achievement rate scaling | 95.5% | -1.10 s/d 2033.46 |
| `a_sustain` | Achievement rate sustain | 92.8% | -2.85 s/d 25.14 |

---

## Analisis Nilai Revenue: Tipe, Tanda, dan Desimal

### 3.1 — Nilai Target: Semua Positif, Desimal Presisi Tinggi

Semua kolom TARGET tidak memiliki nilai negatif. Namun, kolom ini menyimpan **presisi desimal tinggi** yang berasal dari formula pembagian (achievement rate):

- **TARGET_REVENUE** → majority memiliki floating point artifact (94.3%) karena merupakan hasil turunan: `TARGET_REVENUE = REAL_REVENUE / a_rev`
- **TARGET_SUSTAIN** → 49.4% memiliki floating point artifact
- **TARGET_SCALING** → 94.8% floating point artifact
- **TARGET_NGTMA** → 75.1% floating point artifact

**Contoh:**
```
PERIODE=202603, NAMA=NADYA ZAHROTUL HAYATI
  TARGET_REVENUE = 695,938.936735888  ← bukan 695,938.94 (formula-derived)
  REAL_REVENUE   = 471,521.00
  a_rev          = 0.677532144144055  ← 471,521 / 695,938.94 ≈ 0.6775
  Implied: 471,521 / 0.6775 = 695,938.94
```

> **Kesimpulan:** Kolom TARGET adalah nilai yang **dihitung/diderivasi** — bukan angka nominal kasar. Presisi desimal tinggi mencerminkan bahwa TARGET_REVENUE = REAL_REVENUE / a_rev, sehingga desimal di TARGET mengikuti akurasi pembagian.

### 3.2 — Nilai Realisasi: Campuran Positif, Nol, dan Negatif

Ini adalah temuan paling penting dari file ini.

#### Distribusi Nilai per Kolom Realisasi

| Kolom | Positif | Zero | Negatif | Total |
|---|---|---|---|---|
| `REAL_REVENUE` | 3,310 (42.7%) | 4,334 (55.9%) | **106 (1.4%)** | 7,750 |
| `REAL_SUSTAIN` | 535 (6.9%) | 7,194 (92.8%) | **21 (0.3%)** | 7,750 |
| `REAL_SCALING` | 332 (4.3%) | 7,403 (95.5%) | **15 (0.2%)** | 7,750 |
| `REAL_NGTMA` | 25 (0.3%) | 7,725 (99.7%) | 0 | 7,750 |
| `REVENUE_BASE` | 3,402 (43.9%) | 4,339 (56.0%) | **9 (0.1%)** | 7,750 |
| `REVENUE_BILLCOM` | 617 (8.0%) | 7,068 (91.2%) | **65 (0.8%)** | 7,750 |

#### Apa Arti Nilai Negatif?

Nilai negatif bukan error Excel atau floating-point artifact. Semua nilai negatif di file ini adalah **real dan valid** — mereka mewakili **reversal/billing correction**:

- **REAL_REVENUE negatif** → pendapatan yang sebelumnya dicatat kemudian di-reversal/dikoreksi (pelanggan batal, billing adjustment, atau koreksi laporan)
- **REAL_SUSTAIN, REAL_SCALING negatif** → koreksi serupa untuk komponen masing-masing
- **REVENUE_BASE negatif** → koreksi pada base revenue
- **REVENUE_BILLCOM negatif** → koreksi pada billable/communicom revenue

**Contoh konkret:**

```
NIK=930041, NAMA=AHMAD KHOIRUDIN ANWAR, PERIODE=202603
  REAL_REVENUE = -3,850,462,703.00  ← reversal sangat besar (miliaran)

NIK=920064, NAMA=ERVINA HANDAYANI, PERIODE=202603
  REAL_REVENUE = -989,627,359.88  ← desimal juga negatif
```

> **Semua nilai negatif REAL_REVENUE terjadi di bulan 202603 (Maret 2026) secara konsentrasi:**
> - 202603: **73 negative** REAL_REVENUE (dari 106 total)
> - 202601: 2 negative
> - 202602: 5 negative
> - 202604–202606: 6, 13, 7 negative
> - 202607: 0 negative
>
> Pola ini mengindikasikan **billing reversal massal di Maret 2026** — kemungkinan koreksi dari sistem billing yang mereversi transaksi bulan sebelumnya.

#### Contoh Nilai Negatif Realisasi

**REAL_REVENUE (106 record negatif):**

| NIK | NAMA_AM | PERIODE | REAL_REVENUE | Catatan |
|---|---|---|---|---|
| 930041 | AHMAD KHOIRUDIN ANWAR | 202603 | **-3,850,462,703** | Reversal miliaran |
| 405271 | DAMASTYA PRAYOGO | 202603 | -1,757,446,724 | Reversal besar |
| 407118 | RIZAL AGUSTA | 202603 | -1,696,250,000 | Reversal besar |
| 850046 | MOH RIZAL... | 202603 | -1,118,375,188 | Reversal besar |
| 940218 | FAISAL RAMADHAN | 202603 | -989,627,360 | Desimal: .875 |
| 936156 | HANIF WICAKSONO | 202603 | -881,892,209 | Desimal: .604087 |

**REAL_SUSTAIN (21 record negatif):** Contoh: HAVEA PERTIWI (NIK=870022) muncul di 4 periode berbeda dengan nilai negatif (-5,979,378 s/d -4,242,443).

**REVENUE_BILLCOM (65 record negatif):** Konsentrasi di 202601–202603 (10, 14, 16 record).

### 3.3 — Pola Desimal: Presisi vs Bilangan Bulat

Pola desimal sangat berbeda antar kolom, dan mencerminkan **asal-usul data**:

#### NUMBER FORMAT

Semua kolom revenue (TARGET dan REAL) menggunakan format Excel yang sama:

```
#,##0;\(#,##0\);\-
```

Format ini adalah **format accounting Indonesia** — menampilkan ribuan separator dan angka bulat, tetapi **tidak menyembunyikan desimal**. Cell Excel tetap menyimpan presisi penuh.

#### Pola Desimal: Kolom TARGET (Formula-Derived)

Kolom TARGET menyimpan hasil kalkulasi (bukan angka mentah), sehingga memiliki banyak floating-point precision:

| Kolom | Integer/2-decimal | Floating-point artifact | Contoh artifact |
|---|---|---|---|
| TARGET_REVENUE | 5.7% | **94.3%** | 695,938.936735888 |
| TARGET_SUSTAIN | 50.6% | **49.4%** | 215,554,9093.664 |
| TARGET_SCALING | 5.2% | **94.8%** | 715,318,800.207118 |
| TARGET_NGTMA | 24.9% | **75.1%** | 752,289,669.814321 |

> Presisi tinggi (sampai 15 digit desimal) terjadi karena TARGET_REVENUE dihitung sebagai `REAL_REVENUE / a_rev`, dan `a_rev` sendiri memiliki presisi tinggi (contoh: 0.677532144144055).

#### Pola Desimal: Kolom REAL

Kolom REAL adalah **data mentah dari sistem billing**, dengan pola berbeda:

| Kolom | Integer (tanpa desimal) | 2-Decimal Currency | Floating-point | Contoh |
|---|---|---|---|---|
| REAL_REVENUE | 38.2% | 42.3% | **19.5%** | 471,521.00 / 44036104.8 / -989,627,359.88 |
| REAL_SUSTAIN | 4.1% | 7.0% | **88.9%** | 61050614.13 / -329,612,721.57 |
| REAL_SCALING | 2.4% | 3.8% | **93.8%** | 3230533.35 / -608,850.00 |
| REAL_NGTMA | 0.2% | 0.3% | **99.5%** | Hampir semua floating-point |
| REVENUE_BASE | 40.2% | 43.9% | **15.9%** | 471,521.00 / -133,650.00 |
| REVENUE_BILLCOM | 7.2% | 8.8% | **84.0%** | Campuran |

#### Catatan Penting: Nilai Desimal pada Bilangan Bulat

Beberapa nilai yang *tampaknya* bulat sebenarnya tersimpan dengan desimal:

```
Row 44:  REAL_REVENUE = 44,036,104.8  (desimal .8 — billing fractional)
Row 48:  REAL_REVENUE = 89,180,477.7  (desimal .7)
Row 216: REAL_REVENUE = 134,903,7514.8 (desimal .8)
Row 5673: REAL_SUSTAIN = 7,647,388.65  (desimal .65 — accounting precision)
Row 5678: REAL_SUSTAIN = 1,589,292,024.8 (desimal .8 — miliaran dengan .8)
Row 1660895.2496 (REAL_SCALING, 4 desimal: .2496)
```

> **Implikasi:** Jangan membulatkan nilai REAL_REVENUE ke 2 desimal sebelum menyimpan ke database. Desimal di sini adalah presisi asli dari sistem billing (kemungkinan hasil bagi atau kalkulasi internal). Decimal precision yang tepat harus dipertahankan.

### 3.4 — Hubungan Antar Kolom Revenue

#### REAL_REVENUE ≠ REVENUE_BASE + REVENUE_BILLCOM

Dari 7,750 baris, hanya **5,084 (65.5%)** yang persis match. Sisanya memiliki selisih:

```
REAL_REVENUE = 3,364,877.00
REVENUE_BASE = 3,970,600.00
REVENUE_BILLCOM = 0.00
Selisih = -605,723.00  ← tidak nol
```

Selisih ini kemungkinan merupakan komponen **REGULER** yang tidak tercermin dalam kolom terpisah:

```
TARGET_REVENUE ≠ TARGET_SUSTAIN + TARGET_SCALING + TARGET_NGTMA
```

TARGET_REVENUE mengandung komponen REGULER/REGEN yang tidak ada kolom sendiri:

```
PERIODE=202603, ERVINA HANDAYANI, Row A:
  TARGET_REVENUE = 31,464,324.05
  T_SUSTAIN      = 27,818,521.78
  T_SCALING      = 3,645,823.08
  T_NGTMA        = 10,810,206.69
  SUM            = 42,274,551.55
  Selisih        = -10,810,227.50  ← komponen REGULER?
```

> **Kesimpulan:** TARGET_REVENUE dan REAL_REVENUE adalah **gross total** yang menyertakan komponen REGULER. Kolom REGULER tidak tersedia sebagai kolom terpisah dalam file ini — nilainya harus dihitung sebagai residual:
> `REGULER = TOTAL - SUSTAIN - SCALING - NGTMA`

---

## Implikasi untuk Sistem Import LESAVI

### 5.1 — Kondisi File: Compatible dengan Import Existing

File ini adalah format **RAW** (isRawFormat = true) karena memiliki:
- ✅ Kolom `PERIODE`
- ✅ Kolom `NIK`
- ✅ Kolom `NAMA_AM`
- ✅ Kolom `STANDARD_NAME` (pelanggan)
- ✅ Kolom `DIVISI_CC` (DPS/DSS/DGS)

### 5.2 — Perubahan yang Sudah Ditangani Branch HEAD

Branch `HEAD` dari `routes.ts` sudah memiliki fix untuk:

1. **Negative revenue handling** — menjumlahkan bagian positif dan negatif secara terpisah:
   ```typescript
   const realTotal = (
     Math.max(0, rReg) + Math.max(0, rSustain) + Math.max(0, rScaling) + Math.max(0, rNgtma)
   ) - (
     Math.abs(Math.min(0, rReg)) + Math.abs(Math.min(0, rSustain)) +
     Math.abs(Math.min(0, rScaling)) + Math.abs(Math.min(0, rNgtma))
   );
   ```

2. **Pivot cache format detection** — support untuk file Excel yang menyimpan data sebagai pivot cache (ada 2 cache: Perf. CC dan Perf. AM).

3. **NAMA_AM resolution via account_managers lookup** — pivot cache tidak selalu menyertakan NAMA_AM.

### 5.3 — Pending: Field Baru yang Belum Tersimpan

| Field | Status | Perlu |
|---|---|---|
| `LEVEL_AM` | Ada di file, ada di import code | ✅ Tersimpan |
| `PROPORSI` | Ada di file | ❌ Belum — simpan di `komponen_detail` JSON |
| `REVENUE_BASE` | Ada di file | ❌ Belum — simpan di `komponen_detail` JSON |
| `REVENUE_BILLCOM` | Ada di file | ❌ Belum — simpan di `komponen_detail` JSON |
| `a_rev`, `a_ngtma`, `a_scaling`, `a_sustain` | Ada di file | ❌ Belum — simpan di `komponen_detail` JSON |
| `kw` (selalu = 4) | Ada di file | ❌ Belum — mungkin tidak perlu |
| `LAYANAN` | 100% nol | ❌ Tidak berguna, skip |

### 5.4 — Rekomendasi Rounding dan Presisi

| Sumber | Rekomendasi |
|---|---|
| Kolom TARGET | Simpan apa adanya (high precision) — hasil derivasi |
| Kolom REAL positif | Simpan presisi penuh — data billing asli |
| Kolom REAL negatif | **JANGAN bulatkan** — nilai reversal harus akurat |
| Decimal database type | `REAL` (PostgreSQL) sudah cukup untuk presisi ini |

---

## Catatan Tambahan

### Negatif vs Floating-Point Artifact

Nilai negatif (106 record REAL_REVENUE) **bukan floating-point artifact** — mereka adalah nilai yang disengaja:

- Tipe data cell: selalu `"n"` (numerik)
- Nilai: -3,850,462,703.00, -989,627,359.88, -881,892,208.60 — semua dengan desimal yang legitimate
- Desimal pada negatif mencerminkan presisi billing sistem asalnya

### Billing Reversal Pattern

Konsentrasi 73 dari 106 nilai negatif REAL_REVENUE di **PERIODE=202603** menunjukkan:
- Mungkin ada koreksi/reversal massal dari sistem billing di Maret 2026
- AM dengan nilai negatif besar (miliaran) perlu diverifikasi dengan Tim Finance
- Aggregate AM-level revenue akan secara otomatis"netralisasi" reversals jika dijumlahkan sebagai-is

### Proporsi AM

Kolom `PROPORSI` menunjukkan bahwa satu customer bisa dibagi oleh lebih dari satu AM:
- PROPORSI = 1.0 → AM penuh menangani customer
- PROPORSI = 0.5 → AM menangani 50% revenue customer
- PROPORSI = 0.01 → AM menangani 1% revenue customer

Ini penting untuk akurasi perhitungan achievement per AM.
