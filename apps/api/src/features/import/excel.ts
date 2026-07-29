import * as XLSX from "xlsx";
import JSZip from "jszip";

export interface ParsedRow {
  [key: string]: string | number | null;
}

export async function parseExcelFromUrl(url: string, sheetName?: string): Promise<ParsedRow[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gagal mengunduh file Excel: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return parseExcelBuffer(buffer, sheetName);
}

export function parseExcelFromBase64(base64: string, sheetName?: string): ParsedRow[] {
  const buffer = Buffer.from(base64, "base64");
  return parseExcelBuffer(buffer, sheetName);
}

/** Baca hanya nama sheet dari buffer Excel tanpa parse data (lebih cepat) */
export function getWorkbookSheetNames(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer", bookSheets: true });
  return workbook.SheetNames;
}

export function parseExcelBuffer(buffer: Buffer, sheetName?: string): ParsedRow[] {
<<<<<<< HEAD
  // raw:true on workbook read is critical: without it, XLSX formats date cells to
  // locale-aware strings ("7/24/2026") instead of preserving Date objects.
  // cellDates:true converts date serial numbers → Date objects, raw:true preserves them.
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
=======
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  const resolvedSheet = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[resolvedSheet];

  // Smart parsing: detect title row (row 0 has only 1 non-null cell, rest null)
<<<<<<< HEAD
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true }) as any[][];
=======
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false }) as any[][];
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  if (rawRows.length < 2) return [];

  const row0 = rawRows[0] as any[];
  const row0NonNull = row0.filter(v => v !== null && v !== "").length;

  // If row 0 looks like a title (only first cell filled), skip it and use row 1 as header
  if (row0NonNull === 1 && rawRows.length > 2) {
    const headers = rawRows[1] as string[];
    const dataRows = rawRows.slice(2);
    return dataRows
      .filter(row => row.some(v => v !== null && v !== ""))
      .map(row => {
        const obj: ParsedRow = {};
        headers.forEach((h, i) => {
<<<<<<< HEAD
          if (h) {
            // Normalize header: trim, remove extra spaces, uppercase
            // Cell values (row[i]) are preserved as-is including Date objects
            const normalized = String(h).trim().replace(/\s+/g, " ").toUpperCase();
            obj[normalized] = row[i] ?? null;
          }
=======
          if (h) obj[h] = row[i] ?? null;
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
        });
        return obj;
      });
  }

<<<<<<< HEAD
  // Normal parsing (first row is header) — raw:true preserves Date objects
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true }) as ParsedRow[];
  return rows.map(row => {
    const normalized: ParsedRow = {};
    for (const [k, v] of Object.entries(row)) {
      if (k) normalized[String(k).trim().replace(/\s+/g, " ").toUpperCase()] = v;
    }
    return normalized;
  });
=======
  // Normal parsing (first row is header)
  return XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false }) as ParsedRow[];
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
}

/**
 * Convert a 2-D array (e.g. from Google Sheets API) directly to ParsedRow[].
 * Same smart-title-row detection as parseExcelBuffer — but no XLSX library involved,
 * so memory usage is ~10x lower for large Google Sheets imports.
 */
export function parseRaw2DArray(rawRows: any[][]): ParsedRow[] {
  if (rawRows.length < 2) return [];
  const row0 = rawRows[0] as any[];
  const row0NonNull = row0.filter(v => v !== null && v !== "" && v !== undefined).length;

  let headers: string[];
  let dataRows: any[][];

  if (row0NonNull === 1 && rawRows.length > 2) {
    // First row is a title row — use row 1 as header
    headers = rawRows[1] as string[];
    dataRows = rawRows.slice(2);
  } else {
    // First row is the header
    headers = rawRows[0] as string[];
    dataRows = rawRows.slice(1);
  }

  return dataRows
    .filter(row => row.some(v => v !== null && v !== "" && v !== undefined))
    .map(row => {
      const obj: ParsedRow = {};
      headers.forEach((h, i) => {
<<<<<<< HEAD
        if (h != null && h !== "") {
          const normalized = String(h).trim().replace(/\s+/g, " ").toUpperCase();
          obj[normalized] = row[i] ?? null;
        }
=======
        if (h != null && h !== "") obj[String(h)] = row[i] ?? null;
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
      });
      return obj;
    });
}

/** Parse number string from Excel (handles Indonesian & US/standard formats) */
export function parseIndonesianNumber(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let s = String(val).trim().replace(/\s/g, "");
  if (s === "") return 0;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      // Indonesian format: 1.234.567,89 — remove dots, comma → dot
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US/standard format: 1,234,567.89 — remove commas
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Comma only: treat as decimal separator if it looks like one (e.g. "1234,56")
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 3 && parts[0].length > 0) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }
  // Only dots (or no separators): treat as-is — dot is decimal point

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function detectPeriodFromUrl(url: string): string | null {
  // Extract YYYYMMDD from filename e.g. TREG3_ACTIVITY_20260316.xlsx or TREG3_ACTIVITY_20260316 (no ext)
  const match = url.match(/[_-](\d{8})(?:[._?&\s]|$)/);
  if (match) {
    const raw = match[1];
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    return `${year}-${month}`;
  }
  return null;
}

<<<<<<< HEAD
/**
 * Get column value from a ParsedRow by trying multiple key variants.
 * Normalizes keys internally so callers can use any casing.
 */
function getCol(row: ParsedRow, ...keys: string[]): any {
  for (const k of keys) {
    // Try exact match
    let val = row[k];
    if (val !== undefined && val !== null && val !== "") return val;
    // Try uppercase
    val = row[k.toUpperCase()];
    if (val !== undefined && val !== null && val !== "") return val;
    // Try lowercase
    val = row[k.toLowerCase()];
    if (val !== undefined && val !== null && val !== "") return val;
    // Try with underscores removed
    val = row[k.replace(/[_\s-]/g, "")];
    if (val !== undefined && val !== null && val !== "") return val;
    val = row[k.toUpperCase().replace(/[_\s-]/g, "")];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
}

=======
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
export function extractSnapshotDateFromUrl(url: string): string | null {
  // Returns YYYY-MM-DD from YYYYMMDD in filename (handles with or without extension)
  const match = url.match(/[_-](\d{8})(?:[._?&\s]|$)/);
  if (match) {
    const raw = match[1];
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return null;
}

export function detectPeriod(rows: ParsedRow[], url?: string): string {
  if (url) {
    const fromUrl = detectPeriodFromUrl(url);
    if (fromUrl) return fromUrl;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ─── Funnel Data Cleaning (mirip Power Query di Power BI) ─────────────────────

/** Convert Excel serial date number or date string to "YYYY-MM-DD" */
function parseDate(val: any): string {
  if (!val) return "";
  // If it's already a Date object
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  // Excel serial date number
  const num = parseFloat(s);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    if (XLSX?.SSF?.parse_date_code) {
      const jsDate = XLSX.SSF.parse_date_code(num);
      if (jsDate) {
        const d = new Date(jsDate.y, jsDate.m - 1, jsDate.d);
        return d.toISOString().slice(0, 10);
      }
    }
    // Fallback (tsx ESM tidak expose XLSX.SSF) — Excel epoch 1899-12-30
    const ms = Math.round((num - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // dd/MM/yyyy format (from GSheets: "07/03/2026")
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // YYYY-MM-DD or other ISO-like formats
  const isoDate = new Date(s);
  if (!isNaN(isoDate.getTime())) return isoDate.toISOString().slice(0, 10);
  return s;
}

function clean(val: any): string {
  if (val == null) return "";
  return String(val).trim();
}

function cleanUpper(val: any): string {
  return clean(val).toUpperCase();
}

function toIntSafe(val: any): number | null {
  const n = parseInt(String(val ?? "").replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
}

function getReportYear(row: any): number {
  const dateStr = parseDate(row.report_date);
  if (!dateStr) return 0;
  return parseInt(dateStr.slice(0, 4), 10);
}

export interface CleanedFunnelRow {
  lopid: string;
  judulProyek: string;
  pelanggan: string;
  nilaiProyek: number;
  estRev: number;
  divisi: string;
  segmen: string;
  witel: string;
  statusF: string;
  proses: string;
  statusProyek: string;
  kategoriKontrak: string;
  projectType: string;
  isReport: string;
  estimateBulan: string;
  monthSubs: number | null;
  namaAm: string;
  nikAm: string;
  nikHandling: string | null;
  namaPembuatLop: string | null;
  reportDate: string;
  createdDate: string;
  tahunAnggaran: number | null;
}

export function cleanFunnelRows(rows: ParsedRow[], opts?: { skipDivisiFilter?: boolean; strictIsReport?: boolean; skipIsReportFilter?: boolean; skipWitelFilter?: boolean; preferPembuat?: boolean; pembuatOnly?: boolean }): CleanedFunnelRow[] {
  const passed: CleanedFunnelRow[] = [];

  for (const r of rows) {
    // ── STEP 1: Filter witel = SURAMADU
<<<<<<< HEAD
    const witel = cleanUpper(r.WITEL);
    if (!opts?.skipWitelFilter && !witel.includes("SURAMADU")) continue;

    // ── STEP 2: Filter divisi = DPS / DSS
    const divisi = clean(r.DIVISI).toUpperCase();
=======
    // skipWitelFilter: include all LOPs for the AM regardless of customer witel
    // (AMs may manage projects in other witel areas — e.g. NI MADE handles PLN NPS in Maluku)
    const witel = cleanUpper(r.witel);
    if (!opts?.skipWitelFilter && !witel.includes("SURAMADU")) continue;

    // ── STEP 2: Filter divisi = DPS / DSS (Witel Suramadu tidak handle DGS)
    // NOTE: In GSheets nationwide funnel, divisi = business segment (RSMES etc), NOT AM divisi.
    // Skip this filter when importing from GSheets — rely on activeNikSet instead.
    const divisi = clean(r.divisi).toUpperCase();
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
    const VALID_DIVISI = new Set(["DPS", "DSS"]);
    if (!opts?.skipDivisiFilter && !VALID_DIVISI.has(divisi)) continue;

    // ── STEP 3: NIK AM extraction
<<<<<<< HEAD
    let nikRaw: number | null;
    if (opts?.pembuatOnly) {
      nikRaw = toIntSafe(r.NIK_PEMBUAT_LOP);
    } else {
      const nikHandlingFirst = String(r.NIK_HANDLING ?? "").split(",")[0].trim();
      nikRaw = opts?.preferPembuat
        ? (toIntSafe(r.NIK_PEMBUAT_LOP) ?? toIntSafe(nikHandlingFirst))
        : (toIntSafe(nikHandlingFirst) ?? toIntSafe(r.NIK_PEMBUAT_LOP));
    }
    if (nikRaw === null) continue;

    // Reni (850099) → Havea (870022): Power BI applies this only for report_date.Year >= 2026
    const reportDateForNik = parseDate(r.REPORT_DATE);
=======
    // pembuatOnly: use ONLY nik_pembuat_lop — discard non-numeric (Power BI: Int64 + RemoveRowsWithErrors)
    // preferPembuat: nik_pembuat_lop first, nik_handling[0] as fallback
    // default: nik_handling[0] first, nik_pembuat_lop as fallback (Excel/Power BI detail export)
    let nikRaw: number | null;
    if (opts?.pembuatOnly) {
      nikRaw = toIntSafe(r.nik_pembuat_lop); // ONLY pembuat — non-numeric = skip row
    } else {
      const nikHandlingFirst = String(r.nik_handling ?? "").split(",")[0].trim();
      nikRaw = opts?.preferPembuat
        ? (toIntSafe(r.nik_pembuat_lop) ?? toIntSafe(nikHandlingFirst))
        : (toIntSafe(nikHandlingFirst) ?? toIntSafe(r.nik_pembuat_lop));
    }
    if (nikRaw === null) continue; // skip rows with non-numeric NIK

    // Reni (850099) → Havea (870022): Power BI applies this only for report_date.Year >= 2026
    // When pembuatOnly=true we honour the conditional; otherwise map unconditionally for safety
    const reportDateForNik = parseDate(r.report_date);
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
    const reportYearForNik = reportDateForNik ? parseInt(reportDateForNik.slice(0, 4), 10) : 0;
    let nikAm = String(nikRaw);
    if (nikAm === "850099" && (!opts?.pembuatOnly || reportYearForNik >= 2026)) nikAm = "870022";

<<<<<<< HEAD
    // ── STEP 4: Reject garbage NIKs
    if (nikAm.length < 4 || Number(nikAm) > 9999999) continue;

    // ── STEP 5: Filter is_report = 'Y'
    if (!opts?.skipIsReportFilter) {
      const isReportRaw = r.IS_REPORT ?? null;
=======
    // ── STEP 4: Reject garbage NIKs (too short or clearly invalid)
    if (nikAm.length < 4 || Number(nikAm) > 9999999) continue;

    // ── STEP 5: Filter is_report = 'Y'
    // skipIsReportFilter: skip filter entirely (Power BI behaviour — show all LOPs regardless of is_report)
    // strictIsReport: reject rows where is_report is null/empty (treat as not-Y)
    if (!opts?.skipIsReportFilter) {
      const isReportRaw = r.is_report ?? r.IS_REPORT ?? r.isReport ?? null;
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
      if (opts?.strictIsReport) {
        const isReportStr = isReportRaw !== null && isReportRaw !== undefined && isReportRaw !== ""
          ? String(isReportRaw).trim().toUpperCase() : "";
        if (isReportStr !== "Y" && isReportStr !== "1" && isReportStr !== "YES" && isReportStr !== "TRUE") continue;
      } else if (isReportRaw !== null && isReportRaw !== undefined && isReportRaw !== "") {
        const isReportStr = String(isReportRaw).trim().toUpperCase();
        if (isReportStr !== "Y" && isReportStr !== "1" && isReportStr !== "YES" && isReportStr !== "TRUE") continue;
      }
    }

<<<<<<< HEAD
    // ── STEP 6: Fix AM name — RENI WULANSARI → HAVEA PERTIWI
    let namaAm = cleanUpper(r.NAMA_PEMBUAT_LOP);
    if (namaAm === "RENI WULANSARI" && (!opts?.pembuatOnly || reportYearForNik >= 2026)) namaAm = "HAVEA PERTIWI";

    const lopid = clean(r.LOPID);
    if (!lopid) continue;

    const reportDate = parseDate(r.REPORT_DATE);

    // Tahun Anggaran
    const taParsed = parseInt(String(
      r.TAHUN_ANGGARAN ?? ""
=======
    // ── STEP 6: Fix AM name — RENI WULANSARI → HAVEA PERTIWI (unconditional)
    let namaAm = cleanUpper(r.nama_pembuat_lop);
    // Reni→Havea for nama: same conditional as NIK (pembuatOnly: year>=2026 only; else unconditional)
    if (namaAm === "RENI WULANSARI" && (!opts?.pembuatOnly || reportYearForNik >= 2026)) namaAm = "HAVEA PERTIWI";

    const lopid = clean(r.lopid);
    if (!lopid) continue; // skip rows without lopid

    const reportDate = parseDate(r.report_date);

    // Tahun Anggaran: try explicit column first, fallback to report_date year
    const taParsed = parseInt(String(
      r.TAHUN_ANGGARAN ?? r.tahun_anggaran ?? r["Tahun Anggaran"] ?? r["TAHUN ANGGARAN"] ?? ""
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
    ).trim(), 10);
    const tahunAnggaran: number | null = !isNaN(taParsed) && taParsed > 2000
      ? taParsed
      : (reportDate ? parseInt(reportDate.slice(0, 4), 10) || null : null);

<<<<<<< HEAD
    // month_subs: try multiple possible column names
    let monthSubsVal: number | null = null;
    const monthSubsRaw = r.MONTH_SUBS ?? r["MONTH SUBS"] ?? r["RENcana DURASI KONTRAK"] ?? r.RENCANA_DURASI_KONTRAK ?? null;
    if (monthSubsRaw != null) {
      const parsed = parseInt(String(monthSubsRaw), 10);
      if (!isNaN(parsed)) monthSubsVal = parsed;
    }

    passed.push({
      lopid,
      judulProyek: clean(r.JUDUL_PROYEK),
      pelanggan: cleanUpper(r.PELANGGAN) || "–",
      nilaiProyek: parseFloat(String(r.NILAI_PROYEK ?? 0)) || 0,
      estRev: parseIndonesianNumber(r.EST_REV ?? 0),
      divisi,
      segmen: clean(r.SEGMEN),
      witel,
      statusF: clean(r.STATUS_F),
      proses: clean(r.PROSES),
      statusProyek: clean(r.STATUS_PROYEK),
      kategoriKontrak: clean(r.KATEGORI_KONTRAK) || "–",
      projectType: clean(r.PROJECT_TYPE),
      isReport: clean(r.IS_REPORT).toUpperCase(),
      estimateBulan: parseDate(r.ESTIMATE_BULAN_BILLCOMP) || clean(r.ESTIMATE_BULAN_BILLCOMP),
      monthSubs: monthSubsVal,
      namaAm,
      nikAm,
      nikHandling: clean(r.NIK_HANDLING),
      namaPembuatLop: clean(r.NAMA_PEMBUAT_LOP),
      reportDate,
      createdDate: parseDate(r.CREATED_DATE) || clean(r.CREATED_DATE),
=======
    passed.push({
      lopid,
      judulProyek: clean(r.judul_proyek),
      pelanggan: cleanUpper(r.pelanggan) || "–",
      nilaiProyek: parseFloat(String(r.nilai_proyek ?? 0)) || 0,
      estRev: parseIndonesianNumber(r[" est_rev "] ?? r.est_rev ?? r["est_rev"] ?? 0),
      divisi,
      segmen: clean(r.segmen),
      witel,
      statusF: clean(r.status_f),
      proses: clean(r.proses),
      statusProyek: clean(r.status_proyek),
      kategoriKontrak: clean(r.kategori_kontrak) || "–",
      projectType: clean(r.project_type),
      isReport: clean(r.is_report).toUpperCase(),
      estimateBulan: parseDate(r.estimate_bulan_billcomp) || clean(r.estimate_bulan_billcomp),
      monthSubs: r.month_subs != null
        ? (parseInt(String(r.month_subs), 10) || null)
        : r["Month Subs"] != null
          ? (parseInt(String(r["Month Subs"]), 10) || null)
          : r.rencana_durasi_kontrak != null
            ? (parseInt(String(r.rencana_durasi_kontrak), 10) || null)
            : r["Rencana Durasi Kontrak"] != null
              ? (parseInt(String(r["Rencana Durasi Kontrak"]), 10) || null)
              : r["rencana durasi kontrak"] != null
                ? (parseInt(String(r["rencana durasi kontrak"]), 10) || null)
                : null,
      namaAm,
      nikAm,
      nikHandling: clean(r.nik_handling),
      namaPembuatLop: clean(r.nama_pembuat_lop),
      reportDate,
      createdDate: parseDate(r.created_date) || clean(r.created_date),
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
      tahunAnggaran,
    });
  }

  // ── STEP 7: Deduplicate by lopid — keep only the row with the LATEST report_date
  // MYTENS export files may contain the same LOP across multiple monthly snapshots
  const deduped = new Map<string, CleanedFunnelRow>();
  for (const row of passed) {
    const existing = deduped.get(row.lopid);
    if (!existing || row.reportDate > existing.reportDate) {
      deduped.set(row.lopid, row);
    }
  }

  return Array.from(deduped.values());
}

// ─── Activity Data Cleaning ────────────────────────────────────────────────────

/**
 * Parse a datetime value from Excel/GSheets, preserving the full datetime string
 * (tidak dipotong jadi date-only).
 *
 * Power BI menyimpan activity_end_date, activity_start_date, dan createdat sebagai
 * `datetime` (bukan `date`). Kita harus simpan lengkap termasuk jam/menit/detik
 * agar:
 *   1. Filter bulan di API tetap benar (`startsWith("YYYY-MM")` bekerja pada datetime string)
 *   2. Unique constraint `(nik, createdat_activity)` bisa membedakan dua aktivitas
 *      yang terjadi pada hari yang sama
 */
function parseRawDateTimeStr(val: any): string {
  if (!val) return "";
  // Date object dari XLSX cellDates:true — convert ke "YYYY-MM-DD HH:mm:ss" dalam waktu lokal server
  if (val instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }
  const s = String(val).trim();
  if (!s) return "";
<<<<<<< HEAD

  // Excel serial number (e.g. 45623.52083) — dari Google Sheets SERIAL_NUMBER option
  const num = parseFloat(s);
  if (!isNaN(num) && num > 30000) {
    // Excel epoch: 1899-12-30 (matches how XLSX stores dates)
    const ms = Math.round((num - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const frac = num % 1;
      if (frac > 0.00001) {
        // Has fractional part → includes time component
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
      } else {
        // Date only (no fractional part)
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      }
    }
  }

=======
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  // Jika sudah dalam format datetime ISO/SQL, kembalikan apa adanya (ganti T dengan spasi)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return s.replace("T", " ").slice(0, 19);
  // Format US: "M/D/YYYY H:MM:SS AM/PM" (dari XLSX raw:false)
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
  if (usMatch) {
    const [, mm, dd, yyyy, hRaw, min, sec = "00", ampm] = usMatch;
    let h = parseInt(hRaw, 10);
    if (ampm?.toUpperCase() === "PM" && h < 12) h += 12;
    if (ampm?.toUpperCase() === "AM" && h === 12) h = 0;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${yyyy}-${pad(parseInt(mm))}-${pad(parseInt(dd))} ${pad(h)}:${min}:${sec.padStart(2, "0")}`;
  }
  // Fallback ke parseDate (tanpa jam) kalau tidak bisa parse datetime
  return parseDate(val);
}

export interface CleanedActivityRow {
  nik: string;
  fullname: string;
  divisi: string;
  segmen: string;
  regional: string;
  witel: string;
  nipnas: string;
  caName: string;
  activityType: string;
  label: string;
  lopid: string;
  createdatActivity: string;
  activityStartDate: string;
  activityEndDate: string;
  picName: string;
  picJobtitle: string;
  picRole: string;
  picPhone: string;
  activityNotes: string;
}

/**
 * Prosedur cleaning data Sales Activity — mengikuti langkah Power Query Power BI:
 *
 * 1. Filter witel = SURAMADU (contains, case-insensitive)
<<<<<<< HEAD
 * 2. Filter divisi = "DPS", "DSS", atau "DGS"
 * 3. Validasi NIK numerik (Int64 — baris dengan NIK non-numerik di-skip)
 * 4. Timestamp diambil dari kolom activity_end_date (tanggal aktivitas aktual, BUKAN createdat yang adalah tanggal import)
 * 5. activity_start_date dan activity_end_date juga disimpan lengkap
=======
 * 2. Filter divisi = "DPS" atau "DSS"
 * 3. Validasi NIK numerik (Int64 — baris dengan NIK non-numerik di-skip)
 * 4. Simpan datetime penuh (termasuk jam) untuk createdat, start_date, end_date
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
 *
 * TIDAK ada filter fullname — Power BI tidak men-drop baris dengan fullname kosong.
 * TIDAK ada dedup — dedup dilakukan di DB layer via unique constraint (nik, createdat_activity).
 */
export function cleanActivityRows(rows: ParsedRow[]): CleanedActivityRow[] {
  return rows
    .map(r => {
<<<<<<< HEAD
      // ── STEP 1: Filter witel = SURAMADU AND divisi = DPS/DSS
      const witel = cleanUpper(getCol(r, "witel", "WITEL"));
      const divisi = clean(getCol(r, "divisi", "DIVISI")).toUpperCase();
=======
      // ── STEP 1: Filter witel = SURAMADU AND divisi = DPS/DSS (Witel Suramadu tidak handle DGS)
      const witel = cleanUpper(r.witel);
      const divisi = clean(r.divisi).toUpperCase();
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829

      if (!witel.includes("SURAMADU")) return null;
      if (divisi !== "DPS" && divisi !== "DSS") return null;

      // ── STEP 2: Validasi NIK numerik
<<<<<<< HEAD
      const nikRaw = toIntSafe(getCol(r, "nik", "NIK"));
      if (nikRaw === null) return null;

      // ── STEP 3: fullname boleh kosong
      const fullname = clean(getCol(r, "fullname", "FULLNAME"));
=======
      // Power BI menggunakan Int64.Type untuk kolom nik — baris dengan NIK tidak-numerik
      // menghasilkan error dan di-drop oleh RemoveRowsWithErrors (jika ada) atau diabaikan.
      const nikRaw = toIntSafe(r.nik);
      if (nikRaw === null) return null;

      // ── STEP 3: fullname boleh kosong (tidak di-filter Power BI)
      const fullname = clean(r.fullname);
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829

      return {
        nik: String(nikRaw),
        fullname,
        divisi,
<<<<<<< HEAD
        segmen: clean(getCol(r, "segmen", "SEGMEN")),
        regional: clean(getCol(r, "regional", "REGIONAL")),
        witel,
        nipnas: clean(getCol(r, "nipnas", "NIPNAS")),
        caName: cleanUpper(getCol(r, "ca_name", "CA_NAME")) || "",
        activityType: clean(getCol(r, "activity_type", "ACTIVITY_TYPE")),
        label: clean(getCol(r, "label", "LABEL")),
        lopid: clean(getCol(r, "lopid", "LOPID")),
        createdatActivity: parseRawDateTimeStr(getCol(r, "activity_end_date", "ACTIVITY_END_DATE")),
        activityStartDate: parseRawDateTimeStr(getCol(r, "activity_start_date", "ACTIVITY_START_DATE")),
        activityEndDate: parseRawDateTimeStr(getCol(r, "activity_end_date", "ACTIVITY_END_DATE")),
        picName: clean(getCol(r, "pic_name", "PIC_NAME")),
        picJobtitle: clean(getCol(r, "pic_jobtitle", "PIC_JOBTITLE")),
        picRole: clean(getCol(r, "pic_role", "PIC_ROLE")),
        picPhone: clean(getCol(r, "pic_phone", "PIC_PHONE")),
        activityNotes: clean(getCol(r, "activity_notes", "ACTIVITY_NOTES")),
      };
    })
    .filter((row): row is CleanedFunnelRow => row !== null);
=======
        segmen: clean(r.segmen),
        regional: clean(r.regional),
        witel,
        nipnas: clean(r.nipnas),
        caName: cleanUpper(r.ca_name) || "",
        activityType: clean(r.activity_type),
        label: clean(r.label),
        lopid: clean(r.lopid),
        // ── Simpan datetime penuh (jam:menit:detik), bukan date-only
        createdatActivity: parseRawDateTimeStr(r.createdat),
        activityStartDate: parseRawDateTimeStr(r.activity_start_date),
        activityEndDate: parseRawDateTimeStr(r.activity_end_date),
        picName: clean(r.pic_name),
        picJobtitle: clean(r.pic_jobtitle),
        picRole: clean(r.pic_role),
        picPhone: clean(r.pic_phone),
        activityNotes: clean(r.activity_notes),
      };
    })
    .filter((row): row is CleanedActivityRow => row !== null);
}

// ── Pivot Cache Excel Parser ───────────────────────────────────────────────────
// Parses .xlsx files that store data as pivot cache (pivotCacheDefinition{N}.xml
// + pivotCacheRecords{N}.xml) instead of flat sheets.
//
// Format: each <r> element in pivotCacheRecords is a row, each <x> is a shared-item
// index, each <n> is a numeric value, each <s> is an inline string, <m/> is null.
//
// Cache 1 = Perf. AM (36 fields, per-AM × per-pelanggan, NIK+NAMA_AM present)
// Cache 2 = Perf. CC (31 fields, per-CC tanpa AM attribution)

interface CacheField {
  name: string;
  sharedItems: string[] | null; // null = numeric field
}

interface ParsedCache {
  fields: CacheField[];
  records: Record<string, any>[];
  recordCount: number;
}

const PIVOT_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

/** Extract all child element values from a pivot cache record element */
function parseRecordCells(recordElem: Element, fieldCount: number, sharedMaps: (string[] | null)[]): Record<string, any> {
  const row: Record<string, any> = {};
  const children = Array.from(recordElem.children);
  for (let vi = 0; vi < Math.min(children.length, fieldCount); vi++) {
    const child = children[vi];
    const tag = child.tag.split("}")[1] ?? child.tag;
    if (tag === "x") {
      const idx = parseInt(child.getAttribute("v") ?? "0", 10);
      const sm = sharedMaps[vi];
      row[vi] = sm && idx < sm.length ? sm[idx] : null;
    } else if (tag === "n") {
      row[vi] = parseFloat(child.getAttribute("v") ?? "0");
    } else if (tag === "s") {
      row[vi] = child.getAttribute("v") ?? "";
    } else if (tag === "m") {
      row[vi] = null; // null/missing
    } else {
      row[vi] = null;
    }
  }
  return row;
}

/**
 * Parse a pivot cache from an xlsx buffer.
 * Returns field metadata and flat row objects (indexed by field position, use fields[] to map).
 *
 * Cache selection:
 * - cacheIndex 1 = first pivot cache (in PERFORMANSI RLEGS = Perf. CC, 31 fields, no AM)
 * - cacheIndex 2 = second pivot cache (in PERFORMANSI RLEGS = Perf. AM, 36 fields, with AM)
 */
export async function parsePivotCache(buffer: Buffer, cacheIndex: 1 | 2 = 2): Promise<ParsedCache> {
  const zip = await JSZip.loadAsync(buffer as unknown as NodeJS.ReadableStreamParameter);
  const zipFiles: Record<string, string> = {};
  await Promise.all(
    Object.keys(zip.files).map(async (name) => {
      zipFiles[name] = await zip.files[name].async("string");
    })
  );

  // Find pivot cache definition file
  const defPattern = `xl/pivotCache/pivotCacheDefinition${cacheIndex}.xml`;
  const defContent = zipFiles[defPattern];
  if (!defContent) {
    // Try alternative path patterns
    const altPatterns = [
      `xl/pivotCache/pivotCacheDefinition${cacheIndex}.xml`,
      `xl/worksheets/pivotCacheDefinition${cacheIndex}.xml`,
    ];
    throw new Error(`Pivot cache ${cacheIndex} tidak ditemukan dalam file. Available: ${Object.keys(zipFiles).filter(k => k.includes('pivot') || k.includes('cache')).join(', ')}`);
  }

  // Parse definition XML using regex (faster, no external parser needed)
  const fieldMatches: CacheField[] = [];

  // Extract all cacheField blocks
  const cacheFieldRegex = /<cacheField[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/cacheField>/g;
  let match: RegExpExecArray | null;
  while ((match = cacheFieldRegex.exec(defContent)) !== null) {
    const fieldName = match[1];
    const fieldContent = match[2];
    const siMatch = /<sharedItems[^>]*count="(\d+)"[^>]*>([\s\S]*?)<\/sharedItems>/.exec(fieldContent);
    if (siMatch) {
      const sItems = Array.from(fieldContent.matchAll(/<s[^>]*v="([^"]+)"/g)).map(m => m[1]);
      fieldMatches.push({ name: fieldName, sharedItems: sItems });
    } else {
      fieldMatches.push({ name: fieldName, sharedItems: null });
    }
  }

  // Fallback: parse with DOMParser if regex missed anything
  if (fieldMatches.length === 0) {
    const { DOMParser } = await import("@xmldom/xmldom" as string);
    const doc = new DOMParser().parseFromString(defContent, "text/xml");
    const ns = PIVOT_NS;
    const cacheFields = doc.getElementsByTagName("cacheField");
    for (let i = 0; i < cacheFields.length; i++) {
      const cf = cacheFields[i] as Element;
      const name = cf.getAttribute("name") ?? `field_${i}`;
      const sharedEl = cf.getElementsByTagName("sharedItems")[0] as Element | undefined;
      if (sharedEl) {
        const sItems: string[] = [];
        const sEls = sharedEl.getElementsByTagName("s");
        for (let j = 0; j < sEls.length; j++) sItems.push((sEls[j] as Element).getAttribute("v") ?? "");
        fieldMatches.push({ name, sharedItems: sItems });
      } else {
        fieldMatches.push({ name, sharedItems: null });
      }
    }
  }

  // Build shared maps for fast lookup
  const sharedMaps = fieldMatches.map(f => f.sharedItems);

  // Parse records
  const recFile = `xl/pivotCache/pivotCacheRecords${cacheIndex}.xml`;
  const recContent = zipFiles[recFile];
  if (!recContent) throw new Error(`Pivot cache records ${cacheIndex} tidak ditemukan`);

  // Extract recordCount from records XML
  const countMatch = /count="(\d+)"/.exec(recContent.substring(0, 500));
  const totalRecords = countMatch ? parseInt(countMatch[1], 10) : 0;

  // Parse records via DOMParser (simpler than regex for nested XML)
  const { DOMParser } = await import("@xmldom/xmldom" as string);
  const recDoc = new DOMParser().parseFromString(recContent, "text/xml");
  const ns = PIVOT_NS;
  const recordElems = recDoc.getElementsByTagName("r");

  const records: Record<string, any>[] = [];
  const fieldCount = fieldMatches.length;

  for (let ri = 0; ri < recordElems.length; ri++) {
    const rec = recordElems[ri] as Element;
    const children = Array.from(rec.children);
    const row: Record<string, any> = {};
    for (let vi = 0; vi < Math.min(children.length, fieldCount); vi++) {
      const child = children[vi] as Element;
      const tag = child.tagName; // without ns prefix
      if (tag === "x") {
        const idx = parseInt(child.getAttribute("v") ?? "0", 10);
        const sm = sharedMaps[vi];
        row[fieldMatches[vi].name] = sm && idx < sm.length ? sm[idx] : null;
      } else if (tag === "n") {
        row[fieldMatches[vi].name] = parseFloat(child.getAttribute("v") ?? "0");
      } else if (tag === "s") {
        row[fieldMatches[vi].name] = child.getAttribute("v") ?? "";
      } else if (tag === "m") {
        row[fieldMatches[vi].name] = null;
      } else {
        row[fieldMatches[vi].name] = null;
      }
    }
    records.push(row);
  }

  return { fields: fieldMatches, records, recordCount: totalRecords };
}

/**
 * Detect if an xlsx buffer is a pivot-cache-format file (vs flat sheet).
 * Returns { isPivot: true, cacheCount: N } or { isPivot: false }.
 */
export async function detectExcelFormat(buffer: Buffer): Promise<{ isPivot: boolean; cacheCount: number }> {
  const zip = await JSZip.loadAsync(buffer as unknown as NodeJS.ReadableStreamParameter);
  const pivotFiles = Object.keys(zip.files).filter(k => k.includes("pivotCacheDefinition"));
  if (pivotFiles.length > 0) {
    return { isPivot: true, cacheCount: pivotFiles.length };
  }
  return { isPivot: false, cacheCount: 0 };
}

/** Export pivot cache parsed rows to a clean flat Excel file (xlsx) */
export function exportPivotCacheToXlsx(cache: ParsedCache, sheetName?: string): Buffer {
  // Build header + data rows
  const headers = cache.fields.map(f => f.name);
  const dataRows = cache.records.map(rec =>
    headers.map(h => rec[h] ?? null)
  );

  const wsData = [headers, ...dataRows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, sheetName ?? "Pivot Cache Export");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/** Convert parsed pivot cache rows to the same ParsedRow format used by existing import logic */
export function pivotCacheRowsToParsedRows(cache: ParsedCache): ParsedRow[] {
  return cache.records.map(rec => {
    const row: ParsedRow = {};
    for (const field of cache.fields) {
      const val = rec[field.name];
      row[field.name] = val ?? null;
    }
    return row;
  });
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
}

// ── Detect whether a Buffer is pivot-cache format ─────────────────────────────
export async function detectExcelFormat(buffer: Buffer): Promise<{ isPivot: boolean; cacheCount: number }> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    let count = 0;
    if (zip.file("xl/pivotCache/pivotCacheDefinition1.xml")) count++;
    if (zip.file("xl/pivotCache/pivotCacheDefinition2.xml")) count++;
    return { isPivot: count > 0, cacheCount: count };
  } catch {
    return { isPivot: false, cacheCount: 0 };
  }
}

/**
 * Parse a specific pivot cache from an Excel buffer.
 * cacheIndex 1 = Perf. CC (no AM attribution), 2 = Perf. AM (has NIK/NAMA_AM).
 * Returns flat records compatible with the RAW format handling in routes.ts.
 */
export interface PivotCacheResult {
  fields: string[];
  records: Record<string, string | number | null>[];
  recordCount: number;
}
export async function parsePivotCache(buffer: Buffer, cacheIndex: 1 | 2 = 2): Promise<PivotCacheResult> {
  const zip = await JSZip.loadAsync(buffer);
  const defFile = zip.file(`xl/pivotCache/pivotCacheDefinition${cacheIndex}.xml`);
  const recFile = zip.file(`xl/pivotCache/pivotCacheRecords${cacheIndex}.xml`);

  if (!defFile || !recFile) {
    throw new Error(`Pivot cache ${cacheIndex} tidak ditemukan dalam file Excel`);
  }

  const defXml = await defFile.async("string");
  const recXml = await recFile.async("string");

  // ── Step 1: Parse field names and shared-items lookup tables ─────────────
  // Format: each <cacheField name="FIELDNAME"> block contains <sharedItems ...>
  // We extract per-field blocks by splitting on <cacheField boundaries.
  // We MUST NOT use a greedy global regex — iterating defXml.matchAll() once
  // gives us field names in document order without needing split.
  const fieldNames: string[] = [];
  const sharedItemsList: string[][] = [];

  // Use a global scan — safe since we only read the name attribute here
  const fieldBlockMap = new Map<number, string>();
  for (const m of defXml.matchAll(/<cacheField\s[^>]*name="([^"]+)"[^>]*>/g)) {
    fieldBlockMap.set(m.index!, m[1]);
  }

  // Build per-field blocks by extracting content between cacheField tags
  for (const [startIdx, fieldName] of [...fieldBlockMap.entries()].sort((a, b) => a[0] - b[0])) {
    fieldNames.push(fieldName);
    // Find the range of this cacheField: from startIdx to the next <cacheField or </pivotCacheDefinition>
    const afterStart = defXml.slice(startIdx);
    const nextCacheIdx = afterStart.indexOf("<cacheField ");
    const nextDefIdx = afterStart.indexOf("</pivotCacheDefinition>");
    const blockEnd = nextCacheIdx > 0 && nextCacheIdx < nextDefIdx ? nextCacheIdx : nextDefIdx;
    const fieldBlock = afterStart.slice(0, blockEnd);

    const siMatch = fieldBlock.match(/<sharedItems[^>]*>([\s\S]*?)<\/sharedItems>/);
    if (siMatch) {
      const vals: string[] = [];
      for (const sm of siMatch[1].matchAll(/<s\s[^>]*v="([^"]*)"[^>]*>/g)) {
        vals.push(sm[1]);
      }
      sharedItemsList.push(vals);
    } else {
      sharedItemsList.push([]); // Numeric field — no shared items lookup
    }
  }

  // ── Step 2: Parse records (rows) ─────────────────────────────────────────
  // Each <r> element contains field values as <x v="idx"/> | <n v="num"/> | <s v="str"/> | <m/>
  // <m/> has NO v= attribute (missing/null value), count them separately.
  // Records are split on the closing tag so we get clean per-record XML strings.
  const records: Record<string, string | number | null>[] = [];

  // Tagged values: <x v="..."/>, <n v="..."/>, <s v="..."/>  (note: no 'm' here — handled separately)
  // NON-GREEDY [^>]*? is critical: self-closing tags like <x v="0"/> must not swallow the
  // next tag's v= value. Without the ? the greedy [^>]* matches past /> and consumes v="next".
  const taggedRegex = /<(x|n|s)\s[^>]*?v="([^"]*)"[^>]*?(?:\/>|>)/g;
  const missingRegex = /<m\s*\/>/g;
  // Split on </r> — each record ends with this tag
  const recRows = recXml.split("</r>");

  for (const rowXml of recRows) {
    if (!rowXml.trim()) continue;
    // Skip XML declaration and root element chunks
    const trimmed = rowXml.trim();
    if (trimmed.startsWith("<?xml") || trimmed.startsWith("<pivotCacheRecords")) continue;

    // Collect non-missing tagged values in field order
    const tagMatches: Array<{ type: string; value: string }> = [];
    let m: RegExpExecArray | null;
    const localTagged = new RegExp(taggedRegex.source, "g");
    while ((m = localTagged.exec(rowXml)) !== null) {
      tagMatches.push({ type: m[1], value: m[2] });
    }

    // Count missing-value placeholders (each consumes one field slot)
    const missingCount = (rowXml.match(missingRegex) || []).length;
    const totalVals = tagMatches.length + missingCount;

    const record: Record<string, string | number | null> = {};
    let tagPos = 0; // next read position in tagMatches

    for (let f = 0; f < fieldNames.length; f++) {
      if (tagPos < tagMatches.length) {
        const { type, value } = tagMatches[tagPos];
        if (type === "x") {
          // Shared-item index → resolve via lookup table for this field
          const idx = parseInt(value, 10);
          record[fieldNames[f]] = sharedItemsList[f]?.[idx] ?? null;
          tagPos++;
        } else if (type === "n") {
          record[fieldNames[f]] = parseFloat(value) || 0;
          tagPos++;
        } else if (type === "s") {
          record[fieldNames[f]] = value || "";
          tagPos++;
        } else {
          // shouldn't happen (type x/n/s only in taggedRegex)
          record[fieldNames[f]] = null;
        }
      } else {
        // No more tagged values → remaining fields are null
        record[fieldNames[f]] = null;
      }
    }

    records.push(record);
  }

  return { fields: fieldNames, records, recordCount: records.length };
}

/**
 * Convert parsePivotCache result to the same flat ParsedRow format
 * used by the existing RAW format handler in routes.ts.
 *
 * Column renaming (pivot cache field → expected column name):
 *   NIP_NAS_GROUP  → NIK       (AM's NIK — unique per AM, primary lookup key)
 *   NAMA           → NAMA_AM  (AM name — may not exist in some files; skip if absent)
 *   DIVISI         → DIVISI   (already correct — DPS/DSS)
 *   WITEL          → WITEL_AM (AM's witel)
 *   LEVEL          → LEVEL_AM (AM level — may be absent)
 *
 * Note: PERIODE values are shared-item indices resolved to actual strings
 * (e.g. "202612"). Numeric revenue fields are stored as <n/> in pivot cache,
 * so parseFloat() already extracted them.
 */
export function pivotCacheRowsToParsedRows(result: PivotCacheResult): ParsedRow[] {
  const hasNamaField = result.fields.includes("NAMA");
  return result.records.map(record => {
    const row: ParsedRow = {};
    for (const [k, v] of Object.entries(record)) {
      if (k === "NIP_NAS_GROUP") {
        row["NIK"] = v;
      } else if (k === "NAMA" && hasNamaField) {
        row["NAMA_AM"] = v;
      } else if (k === "WITEL") {
        row["WITEL_AM"] = v;
      } else if (k === "LEVEL") {
        row["LEVEL_AM"] = v;
      } else {
        row[k] = v;
      }
    }
    return row;
  });
}

/**
 * Export pivot cache data back to a simple XLSX Buffer.
 * Useful for debugging / verifying the parsed data.
 */
export function exportPivotCacheToXlsx(result: PivotCacheResult): Buffer {
  const ws = XLSX.utils.json_to_sheet(result.records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PivotCache");
  const xlsxb = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(xlsxb);
}
