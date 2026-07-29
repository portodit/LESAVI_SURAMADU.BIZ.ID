# Deskriptif Analytics — Sales Activity TREG3

**File:** `TREG3_ACTIVITY_20260728.xlsx`
**Sheet:** Data
**Total Record:** 49,555 baris
**Periode:** 16 Des 2025 — 28 Jul 2026
**Regional:** REG-3

---

## Kolom (21)

| # | Nama Kolom | Deskripsi | Missing % |
|---|---|---|---|
| 1 | nik | NIK employee | 0% |
| 2 | fullname | Nama lengkap | 0% |
| 3 | role | Peran (AM, HOTD, Sales, dll) | 0% |
| 4 | jobtitle | Jabatan | 0% |
| 5 | divisi | Divisi (DPS, DSS, dll) | 0% |
| 6 | segmen | Segment pelanggan | **100%** |
| 7 | regional | Regional (REG-3) | 0% |
| 8 | witel | Witel kerja | 0.4% |
| 9 | nipnas | NIPNAS pelanggan | 10.6% |
| 10 | ca_name | Nama CA/customer | 0% |
| 11 | activity_type | Tipe aktivitas (Kunjungan, Survey, dll) | 0% |
| 12 | label | Label aktivitas (Dengan Pelanggan, dll) | 0% |
| 13 | lopid | ID leads/opportunity | 0% |
| 14 | createdat | Tanggal created record | 0% |
| 15 | activity_start_date | Tanggal mulai aktivitas | 0% |
| 16 | activity_end_date | Tanggal selesai aktivitas | 0% |
| 17 | pic_jobtitle | Jabatan PIC | 11.0% |
| 18 | pic_name | Nama PIC | 10.8% |
| 19 | pic_role | Peran PIC | **44.7%** |
| 20 | pic_phone | No. HP PIC | 10.8% |
| 21 | activity_notes | Catatan aktivitas | 0% |

> **Catatan:** Kolom `segmen` kosong 100% — tidak ada data segmentasi pelanggan. Kolom `pic_role` hampir separuh kosong.

---

## Distribusi Role

| Role | Jumlah | % |
|---|---|---|
| Account Manager | 42,800 | 86.4% |
| Head Of Telkom Daerah | 5,161 | 10.4% |
| Sales | 653 | 1.3% |
| Management | 599 | 1.2% |
| Guest | 342 | 0.7% |

---

## Distribusi Tipe Aktivitas (19 jenis)

| Tipe | Jumlah | % |
|---|---|---|
| Kunjungan | 29,123 | 58.8% |
| Survey | 3,471 | 7.0% |
| Follow up | 2,948 | 5.9% |
| Rapat | 2,903 | 5.9% |
| Submit Penawaran | 2,732 | 5.5% |
| Administrasi | 2,246 | 4.5% |
| Penanganan Gangguan dan Isolir | 1,644 | 3.3% |
| Penanganan Invoice | 1,619 | 3.3% |
| Dealing Kontrak | 719 | 1.5% |
| Lainnya | 585 | 1.2% |
| Negosiasi | 500 | 1.0% |
| Koordinasi internal | 491 | 1.0% |
| Engage | 137 | 0.3% |
| Experience | 105 | 0.2% |
| Rekonsiliasi | 99 | 0.2% |
| Coaching dengan atasan | 83 | 0.2% |
| Pendekatan pelanggan baru | 68 | 0.1% |
| Explore | 56 | 0.1% |
| Pelatihan | 26 | 0.05% |

---

## Distribusi Label

| Label | Jumlah | % |
|---|---|---|
| Dengan Pelanggan | 38,794 | 78.3% |
| Pelanggan Dengan Proyek | 5,403 | 10.9% |
| Pelanggan Dengan POI | 4,181 | 8.4% |
| Tanpa Pelanggan | 1,177 | 2.4% |

---

## Distribusi per Witel

| Witel | Total | % |
|---|---|---|
| SEMARANG JATENG UTARA | 9,718 | 19.6% |
| **SURAMADU** | **8,722** | **17.6%** |
| YOGYA JATENG SELATAN | 7,580 | 15.3% |
| JATIM TIMUR | 5,936 | 12.0% |
| BALI | 5,112 | 10.3% |
| JATIM BARAT | 4,997 | 10.1% |
| SOLO JATENG TIMUR | 3,709 | 7.5% |
| NUSA TENGGARA | 3,561 | 7.2% |

---

## Aktivitas per Bulan

| Bulan | Total |
|---|---|
| 2025-12 | 92 |
| 2026-01 | 7,164 |
| 2026-02 | **7,760** (peak) |
| 2026-03 | 6,879 |
| 2026-04 | 7,712 |
| 2026-05 | 6,951 |
| 2026-06 | 7,089 |
| 2026-07 | 5,902 |

> Ada 7 record anomali tanggal di luar periode normal (2026-08, 2026-12, 2029-01) yang perlu dibersihkan saat import.

---

## Filter: SURAMADU + DPS/DSS + Juli 2026

Criteria:
- `witel` = SURAMADU
- `divisi` = DPS atau DSS
- `activity_end_date` = Juli 2026

**Total: 239 record** (100% DPS, 100% Account Manager)

### Per AM
| Nama AM | Total |
|---|---|
| NI MADE NOVI WIRANA | 47 |
| HANDIKA DAGNA NEVANDA | 32 |
| SAFIRINA FEBRYANTI | 27 |
| VIVIN VIOLITA | 26 |
| ERVINA HANDAYANI | 25 |
| NADYA ZAHROTUL HAYATI | 25 |
| NYARI KUSUMANINGRUM | 25 |
| CAESAR RIO ANGGINA TORUAN | 21 |
| HAVEA PERTIWI | 6 |
| WILDAN ARIEF | 5 |

**10 AM unik, 49 CA_Name unik**

### Per Tipe Aktivitas
| Tipe | Jumlah |
|---|---|
| Kunjungan | 87 |
| Follow up | 33 |
| Rapat | 25 |
| Administrasi | 23 |
| Penanganan Invoice | 21 |
| Penanganan Gangguan & Isolir | 12 |
| Survey | 11 |
| Dealing Kontrak | 9 |
| Submit Penawaran | 9 |
| Rekonsiliasi | 6 |

### Per Label
| Label | Jumlah |
|---|---|
| Dengan Pelanggan | 152 (63.6%) |
| Pelanggan Dengan Proyek | 87 (36.4%) |

### Daily Distribution (Juli 2026)
| Tanggal | Total | Tanggal | Total |
|---|---|---|---|
| 01 Jul | 11 | 14 Jul | 9 |
| 02 Jul | 19 | 15 Jul | 5 |
| 03 Jul | 16 | 16 Jul | 17 |
| 04 Jul | 1 | 17 Jul | 10 |
| 06 Jul | 14 | 18 Jul | 2 |
| 07 Jul | 15 | 20 Jul | 19 |
| 08 Jul | **21** | 21 Jul | 9 |
| 09 Jul | 14 | 22 Jul | 13 |
| 10 Jul | 8 | 23 Jul | 10 |
| 11 Jul | 2 | 24 Jul | 11 |
| 13 Jul | 13 | | |

> Peak: **8 Jul (21)** dan **2 Jul (19)**. Tidak ada aktivitas di tanggal weekend (5, 12, 19, 25 Jul).
