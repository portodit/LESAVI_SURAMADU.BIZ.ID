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
  // raw:true on workbook read is critical: without it, XLSX formats date cells to
  // locale-aware strings ("7/24/2026") instead of preserving Date objects.
  // cellDates:true converts date serial numbers → Date objects, raw:true preserves them.
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const resolvedSheet = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[resolvedSheet];

  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true }) as any[][];
  if (rawRows.length < 2) return [];

  // Smart header detection: scan rows to find one with known column names AND ≥8 non-null cells.
  // This handles Power BI pivot exports with filter rows (2 non-null) before the real header (10+ non-null).
  const headerKeywords = ["NIK", "PERIODE", "NAMA_AM", "STANDARD_NAME", "LOPID", "NIPNAS", "WITEL", "DIVISI", "PELANGGAN", "PROJECT_ID"];
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const nonNull = row.filter(v => v !== null && v !== "");
    // Header row typically has 8+ non-null cells; filter rows have 2.
    if (nonNull.length >= 8) {
      const rowUpper = row.map(v => v != null ? String(v).trim().toUpperCase() : "");
      const hasKeyword = headerKeywords.some(k => rowUpper.includes(k));
      if (hasKeyword) {
        headerRowIdx = i;
        break;
      }
    }
  }

  let rows: ParsedRow[];
  if (headerRowIdx >= 0) {
    // Found header in a later row — rows above are filter/metadata rows, skip them
    const headers = rawRows[headerRowIdx] as string[];
    const dataRows = rawRows.slice(headerRowIdx + 1);
    rows = dataRows
      .filter(row => row && row.some(v => v !== null && v !== ""))
      .map(row => {
        const obj: ParsedRow = {};
        headers.forEach((h, i) => {
          if (h) {
            const normalized = String(h).trim().replace(/\s+/g, " ").toUpperCase();
            obj[normalized] = row[i] ?? null;
          }
        });
        return obj;
      });
  } else {
    // Fallback: row 0 looks like a title (only 1 non-null cell), use row 1 as header
    const row0 = rawRows[0] as any[];
    const row0NonNull = row0.filter(v => v !== null && v !== "").length;
    if (row0NonNull === 1 && rawRows.length > 2) {
      const headers = rawRows[1] as string[];
      const dataRows = rawRows.slice(2);
      rows = dataRows
        .filter(row => row.some(v => v !== null && v !== ""))
        .map(row => {
          const obj: ParsedRow = {};
          headers.forEach((h, i) => {
            if (h) {
              const normalized = String(h).trim().replace(/\s+/g, " ").toUpperCase();
              obj[normalized] = row[i] ?? null;
            }
          });
          return obj;
        });
    } else {
      // Normal parsing (first row is header)
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true }) as ParsedRow[];
      rows = rows.map(row => {
        const normalized: ParsedRow = {};
        for (const [k, v] of Object.entries(row)) {
          if (k) normalized[String(k).trim().replace(/\s+/g, " ").toUpperCase()] = v;
        }
        return normalized;
      });
    }
  }
  return rows;
}

/**
 * Convert a 2-D array (e.g. from Google Sheets API) directly to ParsedRow[].
 * Same smart-title-row detection as parseExcelBuffer — but no XLSX library involved,
 * so memory usage is ~10x lower for large Google Sheets imports.
 */
export function parseRaw2DArray(rawRows: any[][]): ParsedRow[] {
  if (rawRows.length < 2) return [];

  // Smart header detection: scan rows to find the one with known column names
  const headerKeywords = ["NIK", "PERIODE", "NAMA_AM", "STANDARD_NAME", "LOPID", "NIPNAS", "WITEL", "DIVISI", "PELANGGAN", "PROJECT_ID"];
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const nonNull = row.filter(v => v !== null && v !== "" && v !== undefined);
    if (nonNull.length >= 2) {
      const rowUpper = row.map(v => v != null ? String(v).trim().toUpperCase() : "");
      const hasKeyword = headerKeywords.some(k => rowUpper.includes(k));
      if (hasKeyword) {
        headerRowIdx = i;
        break;
      }
    }
  }

  let headers: string[];
  let dataRows: any[][];
  if (headerRowIdx >= 0) {
    headers = rawRows[headerRowIdx] as string[];
    dataRows = rawRows.slice(headerRowIdx + 1);
  } else {
    const row0 = rawRows[0] as any[];
    const row0NonNull = row0.filter(v => v !== null && v !== "" && v !== undefined).length;
    if (row0NonNull === 1 && rawRows.length > 2) {
      headers = rawRows[1] as string[];
      dataRows = rawRows.slice(2);
    } else {
      headers = rawRows[0] as string[];
      dataRows = rawRows.slice(1);
    }
  }

  return dataRows
    .filter(row => row.some(v => v !== null && v !== "" && v !== undefined))
    .map(row => {
      const obj: ParsedRow = {};
      headers.forEach((h, i) => {
        if (h != null && h !== "") {
          const normalized = String(h).trim().replace(/\s+/g, " ").toUpperCase();
          obj[normalized] = row[i] ?? null;
        }
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
  witel: string;
  witelAm: string;
  witelCc: string;
}

export function cleanFunnelRows(rows: ParsedRow[], opts?: { skipDivisiFilter?: boolean; strictIsReport?: boolean; skipIsReportFilter?: boolean; skipWitelFilter?: boolean; preferPembuat?: boolean; pembuatOnly?: boolean }): CleanedFunnelRow[] {
  const passed: CleanedFunnelRow[] = [];

  for (const rawRow of rows) {
    // Normalize row keys to uppercase so we can handle both old (UPPERCASE) and new (lowercase) CSV headers
    const r: ParsedRow = {};
    for (const [k, v] of Object.entries(rawRow)) {
      r[k.toUpperCase()] = v;
    }
    // ── STEP 1: Filter witel = SURAMADU (using WITEL_AM — AM's own witel)
    const witelAm = cleanUpper(r.WITEL_AM ?? r.WITEL);
    if (!opts?.skipWitelFilter && !witelAm.includes("SURAMADU")) continue;

    // ── STEP 2: Filter divisi = DPS / DSS
    const divisi = clean(r.DIVISI).toUpperCase();
    const VALID_DIVISI = new Set(["DPS", "DSS"]);
    if (!opts?.skipDivisiFilter && !VALID_DIVISI.has(divisi)) continue;

    // ── STEP 3: NIK AM extraction (allow null — NIK can be edited post-import)
    let nikRaw: number | null;
    if (opts?.pembuatOnly) {
      nikRaw = toIntSafe(r.NIK_PEMBUAT_LOP);
    } else {
      const nikHandlingFirst = String(r.NIK_HANDLING ?? "").split(",")[0].trim();
      nikRaw = opts?.preferPembuat
        ? (toIntSafe(r.NIK_PEMBUAT_LOP) ?? toIntSafe(nikHandlingFirst))
        : (toIntSafe(nikHandlingFirst) ?? toIntSafe(r.NIK_PEMBUAT_LOP));
    }

    // Reni (850099) → Havea (870022): Power BI applies this only for report_date.Year >= 2026
    const reportDateForNik = parseDate(r.REPORT_DATE);
    const reportYearForNik = reportDateForNik ? parseInt(reportDateForNik.slice(0, 4), 10) : 0;
    let nikAm = nikRaw !== null ? String(nikRaw) : "";
    if (nikAm === "850099" && (!opts?.pembuatOnly || reportYearForNik >= 2026)) nikAm = "870022";

    // ── STEP 4: Filter is_report = 'Y'
    if (!opts?.skipIsReportFilter) {
      const isReportRaw = r.IS_REPORT ?? null;
      const isReportStr = isReportRaw !== null && isReportRaw !== undefined && isReportRaw !== ""
        ? String(isReportRaw).trim().toUpperCase() : "";
      if (isReportStr !== "Y" && isReportStr !== "1" && isReportStr !== "YES" && isReportStr !== "TRUE") continue;
    }

    // ── STEP 5: Fix AM name — RENI WULANSARI → HAVEA PERTIWI
    let namaAm = cleanUpper(r.NAMA_PEMBUAT_LOP);
    if (namaAm === "RENI WULANSARI" && (!opts?.pembuatOnly || reportYearForNik >= 2026)) namaAm = "HAVEA PERTIWI";

    const lopid = clean(r.LOPID);
    if (!lopid) continue;

    const reportDate = parseDate(r.REPORT_DATE);

    // Tahun Anggaran
    const taParsed = parseInt(String(
      r.TAHUN_ANGGARAN ?? ""
    ).trim(), 10);
    const tahunAnggaran: number | null = !isNaN(taParsed) && taParsed > 2000
      ? taParsed
      : (reportDate ? parseInt(reportDate.slice(0, 4), 10) || null : null);

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
      witel: witelAm,
      witelAm,
      witelCc: cleanUpper(r.WITEL_CC ?? r.WITEL),
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
 * 2. Filter divisi = "DPS", "DSS", atau "DGS"
 * 3. Validasi NIK numerik (Int64 — baris dengan NIK non-numerik di-skip)
 * 4. Timestamp diambil dari kolom activity_end_date (tanggal aktivitas aktual, BUKAN createdat yang adalah tanggal import)
 * 5. activity_start_date dan activity_end_date juga disimpan lengkap
 *
 * TIDAK ada filter fullname — Power BI tidak men-drop baris dengan fullname kosong.
 * TIDAK ada dedup — dedup dilakukan di DB layer via unique constraint (nik, createdat_activity).
 */
export function cleanActivityRows(rows: ParsedRow[]): CleanedActivityRow[] {
  return rows
    .map(r => {
      // ── STEP 1: Filter witel = SURAMADU AND divisi = DPS/DSS
      const witel = cleanUpper(getCol(r, "witel", "WITEL"));
      const divisi = clean(getCol(r, "divisi", "DIVISI")).toUpperCase();

      if (!witel.includes("SURAMADU")) return null;
      if (divisi !== "DPS" && divisi !== "DSS") return null;

      // ── STEP 2: Validasi NIK numerik
      const nikRaw = toIntSafe(getCol(r, "nik", "NIK"));
      if (nikRaw === null) return null;

      // ── STEP 3: fullname boleh kosong
      const fullname = clean(getCol(r, "fullname", "FULLNAME"));

      return {
        nik: String(nikRaw),
        fullname,
        divisi,
        nipnas: clean(getCol(r, "nipnas", "NIPNAS")),
        caName: cleanUpper(getCol(r, "ca_name", "CA_NAME")) || "",
        activityType: clean(getCol(r, "activity_type", "ACTIVITY_TYPE")),
        label: clean(getCol(r, "label", "LABEL")),
        lopid: clean(getCol(r, "lopid", "LOPID")),
        activityEndDate: parseRawDateTimeStr(getCol(r, "activity_end_date", "ACTIVITY_END_DATE")),
        activityNotes: clean(getCol(r, "activity_notes", "ACTIVITY_NOTES")),
      };
    })
    .filter((row): row is CleanedFunnelRow => row !== null);
}

// ── NIPNAS → AM mapping from NIPNAS2AM sheet in RLEGS Perf files ───────────────
export interface NipnasAmMapping {
  nik: string;
  namaAm: string;
  divisi: string;
}

/**
 * Parse the NIPNAS2AM sheet from a RLEGS Perf Excel file.
 * Format: col A = NIPNAS (string like "920064"), col B = AM info
 *   AM info format: "920064-ERVINA HANDAYANI" or "920064-ERVINA HANDAYANI,9200642-OTHER AM"
 *   (one NIPNAS can map to multiple AMs — we take the first one)
 * Returns: Map< nipnas_string, { nik, namaAm, divisi } >
 */
export function parseNipnas2AmSheet(buffer: Buffer): Map<string, NipnasAmMapping> {
  const map = new Map<string, NipnasAmMapping>();
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = "NIPNAS2AM";
    if (!wb.SheetNames.includes(sheetName)) {
      console.log("[NIPNAS2AM] Sheet not found in workbook");
      return map;
    }
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1, defval: null, raw: true }) as any[][];
    for (let i = 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || row.length < 2) continue;
      const nipnasRaw = row[0];
      const amRaw = row[1];
      if (nipnasRaw == null || amRaw == null) continue;
      const nipnas = String(nipnasRaw).trim();
      const amStr = String(amRaw).trim();
      if (!nipnas || !amStr) continue;
      // Format: "920064-ERVINA HANDAYANI" or "920064-ERVINA HANDAYANI,9200642-OTHER"
      const firstAm = amStr.split(",")[0].trim();
      const dashIdx = firstAm.indexOf("-");
      if (dashIdx <= 0) continue;
      const nik = firstAm.slice(0, dashIdx).trim();
      const namaAm = firstAm.slice(dashIdx + 1).trim().toUpperCase();
      if (!nik || !namaAm) continue;
      map.set(nipnas, { nik, namaAm, divisi: "DPS" }); // divisi resolved later
    }
    console.log(`[NIPNAS2AM] Parsed ${map.size} NIPNAS→AM mappings`);
  } catch (e) {
    console.log("[NIPNAS2AM] Parse error: " + (e as Error).message);
  }
  return map;
}

// ── Detect whether a Buffer is pivot-cache format ─────────────────────────────
export async function detectExcelFormat(buffer: Buffer): Promise<{ isPivot: boolean; cacheCount: number }> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    // Check for pivot cache XML files
    let count = 0;
    if (zip.file("xl/pivotCache/pivotCacheDefinition1.xml")) count++;
    if (zip.file("xl/pivotCache/pivotCacheDefinition2.xml")) count++;

    // Prefer RAW sheet when present — RAW_AM is the authoritative data source.
    // Some RLEGS exports contain both a RAW sheet and pivot cache XML;
    // the RAW sheet has more complete row data and doesn't depend on NIPNAS2AM mapping,
    // so it avoids the NIPNAS2AM→AM attribution ambiguity that causes row count discrepancies.
    const wb = XLSX.read(buffer, { type: "buffer", raw: true });
    const hasRawSheet = wb.SheetNames.some(n => /RAW/i.test(n));
    if (hasRawSheet) {
      return { isPivot: false, cacheCount: 0 };
    }

    return { isPivot: count > 0, cacheCount: count };
  } catch {
    return { isPivot: false, cacheCount: 0 };
  }
}

/**
 * Parse a specific pivot cache from an Excel buffer.
 * cacheIndex 1 = Perf. CC (WITEL only, no AM attribution).
 * cacheIndex 2 = Perf. AM (NIK/NAMA_AM/WITEL_AM attribution per AM).
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

  console.log(`[PIVOT-CACHE-${cacheIndex}] defFile=${!!defFile} recFile=${!!recFile} availableFiles=${zip.file(/xl\/pivotCache/).map((f:any)=>f.name).join(",")}`);

  if (!defFile || !recFile) {
    throw new Error(`Pivot cache ${cacheIndex} tidak ditemukan dalam file Excel`);
  }

  const defXml = await defFile.async("string");
  const recXml = await recFile.async("string");

  // ── Step 1: Extract all cacheField blocks with their sharedItems ───────────
  // Each cacheField: <cacheField name="FIELDNAME"><sharedItems ...>...</sharedItems></cacheField>
  // We need to extract the field name and ALL shared items (strings, numbers, errors).
  const fieldNames: string[] = [];
  const sharedItemsList: (string | number | null)[][] = [];

  // Split defXml on <cacheField  boundaries to get per-field blocks
  // We can't just split naively because cacheField names may contain the delimiter.
  // Strategy: find each <cacheField name="..."> position, then find its matching </cacheField>.
  let pos = 0;
  const cfPattern = /<cacheField\s/g;
  let match;

  while ((match = cfPattern.exec(defXml)) !== null) {
    const cfStart = match.index;
    // Find the name attribute value inside this <cacheField tag
    const tagEnd = defXml.indexOf(">", cfStart);
    const tagContent = defXml.slice(cfStart, tagEnd + 1);
    const nameMatch = tagContent.match(/name="([^"]+)"/);
    if (!nameMatch) { pos = cfStart + 1; continue; }
    const fieldName = nameMatch[1];

    // Find matching </cacheField> — not the next one (they nest)
    // Count nesting level starting from this tag
    let searchPos = tagEnd + 1;
    let depth = 1;
    while (depth > 0 && searchPos < defXml.length) {
      if (defXml.slice(searchPos, searchPos + 12) === "</cacheField>") { depth--; searchPos += 12; }
      else if (defXml.slice(searchPos, searchPos + 11) === "<cacheField ") { depth++; searchPos += 11; }
      else searchPos++;
    }
    const blockContent = defXml.slice(tagEnd + 1, searchPos);

    // Extract all sharedItems values: <s v="..."/>, <n v="..."/>, <e v="..."/>, <m/>
    const siVals: (string | number | null)[] = [];
    // Strings: <s v="text" t="s"/> or just <s v="text"/>
    for (const sm of blockContent.matchAll(/<s\s[^>]*v="([^"]*)"[^>]*>/g)) siVals.push(sm[1]);
    // Numbers: <n v="123.45"/>
    for (const sm of blockContent.matchAll(/<n\s[^>]*v="([^"]*)"[^>]*>/g)) siVals.push(parseFloat(sm[1]) || 0);
    // Errors: <e v="..."/> → map to string
    for (const sm of blockContent.matchAll(/<e\s[^>]*v="([^"]*)"[^>]*>/g)) siVals.push("#ERR:" + sm[1]);
    // Missing: <m/> → null
    const missing = (blockContent.match(/<m\s*\/>/g) || []).length;
    for (let i = 0; i < missing; i++) siVals.push(null);

    fieldNames.push(fieldName);
    sharedItemsList.push(siVals);
    pos = searchPos;
  }

  // ── Step 2: Parse records ──────────────────────────────────────────────────
  // Each record: <r><x v="0"/><x v="1"/><n v="123"/><m/></r>
  // x = shared-item index, n = number, s = inline string, m = missing/null
  const records: Record<string, string | number | null>[] = [];

  // Split on </r> to get per-record XML strings
  const recRows = recXml.split("</r>");

  // Tag patterns — use sticky-free approach with matchAll
  const xTag = /<x\s[^>]*v="(\d+)"[^>]*>/g;
  const nTag = /<n\s[^>]*v="([^"]*)"[^>]*>/g;
  const sTag = /<s\s[^>]*v="([^"]*)"[^>]*>/g;
  const mTag = /<m\s*\/>/g;

  for (const rowXml of recRows) {
    if (rowXml.trim().length < 5) continue;
    const t = rowXml.trim();
    if (t.startsWith("<?xml") || t.startsWith("<pivotCacheRecords")) continue;

    // Count total field slots in this row
    const xCount = (rowXml.match(/<x\s/g) || []).length;
    const nCount = (rowXml.match(/<n\s/g) || []).length;
    const sCount = (rowXml.match(/<s\s/g) || []).length;
    const mCount = (rowXml.match(/<m\s/g) || []).length;
    const totalSlots = xCount + nCount + sCount + mCount;

    if (totalSlots === 0) continue;

    // Parse values in document order
    const values: (string | number | null)[] = [];
    let i = 0;

    // Collect all tags with their positions
    const tags: Array<{ pos: number; type: string; value: string | number | null }> = [];

    for (const m of rowXml.matchAll(xTag)) {
      tags.push({ pos: m.index!, type: "x", value: parseInt(m[1], 10) });
    }
    for (const m of rowXml.matchAll(nTag)) {
      tags.push({ pos: m.index!, type: "n", value: parseFloat(m[1]) || 0 });
    }
    for (const m of rowXml.matchAll(sTag)) {
      tags.push({ pos: m.index!, type: "s", value: m[1] });
    }
    for (const m of rowXml.matchAll(mTag)) {
      tags.push({ pos: m.index!, type: "m", value: null });
    }
    tags.sort((a, b) => a.pos - b.pos);

    const record: Record<string, string | number | null> = {};
    for (let f = 0; f < fieldNames.length; f++) {
      if (i < tags.length) {
        const tag = tags[i];
        if (tag.type === "x") {
          record[fieldNames[f]] = sharedItemsList[f]?.[tag.value as number] ?? null;
        } else if (tag.type === "n") {
          record[fieldNames[f]] = tag.value;
        } else if (tag.type === "s") {
          record[fieldNames[f]] = tag.value as string;
        } else {
          record[fieldNames[f]] = null;
        }
        i++;
      } else {
        record[fieldNames[f]] = null;
      }
    }

    records.push(record);
  }

  return { fields: fieldNames, records, recordCount: records.length };
}

/**
 * Convert Cache 1 parsePivotCache result to ParsedRow format.
 * Cache 1 (Perf. CC) has: PERIODE, NIP_NAS_GROUP (= customer NIPNAS), WITEL (= SURAMADU etc.)
 * NIK/NAMA_AM attribution comes from NIPNAS2AM sheet mapping.
 */
export function pivotCacheRowsToParsedRows(
  result: PivotCacheResult,
  nipnas2am: Map<string, NipnasAmMapping> = new Map()
): ParsedRow[] {
  console.log("[PIVOT-TO-ROWS] fields=" + JSON.stringify(result.fields) + " recordCount=" + result.recordCount);
  if (result.recordCount > 0) console.log("[PIVOT-TO-ROWS] sample record=" + JSON.stringify(result.records[0]));

  // Precompute unique NIPNAS values from cache
  const uniqueNipnas = new Set<string>();
  for (const record of result.records) {
    const nipnas = String(record.NIP_NAS_GROUP ?? record.NIP_NAS ?? "").trim();
    if (nipnas) uniqueNipnas.add(nipnas);
  }
  console.log(`[PIVOT-TO-ROWS] unique NIPNAS in cache: ${uniqueNipnas.size}, mapped: ${[...uniqueNipnas].filter(n => nipnas2am.has(n)).length}`);

  return result.records.map(record => {
    // NIP_NAS_GROUP is the customer's NIPNAS — use it to resolve AM attribution
    const customerNipnas = String(record.NIP_NAS_GROUP ?? record.NIP_NAS ?? "").trim();
    const amMapping = customerNipnas ? nipnas2am.get(customerNipnas) : undefined;

    const row: ParsedRow = {
      // AM attribution: resolved from NIPNAS2AM sheet
      NIK: amMapping?.nik ?? "",
      NAMA_AM: amMapping?.namaAm ?? "",
      LEVEL_AM: "",
      POSITION: String(record.POSITION ?? "").trim(),
      // WITEL_AM: derive from pivot cache WITEL directly (customer's witel = AM's witel in RLEGS exports).
      // NIPNAS2AM mapping is used only for NIK + NAMA_AM attribution, NOT for WITEL determination.
      WITEL_AM: String(record.WITEL ?? "").trim() || "SURAMADU",
      // Customer / pelanggan data
      PERIODE: String(record.PERIODE ?? "").trim(),
      NIP_NAS_GROUP: customerNipnas,
      NIP_NAS: customerNipnas,
      STANDARD_NAME: String(record.STANDARD_NAME ?? "").trim(),
      GROUP: String(record.GROUP ?? "").trim(),
      INDUSTRI: String(record.INDUSTRI ?? "").trim(),
      LSEGMEN: String(record.LSEGMEN ?? "").trim(),
      SSEGMEN: String(record.SSEGMEN ?? "").trim(),
      WITEL_CC: String(record.WITEL_CC ?? record.WITEL ?? "").trim() || "SURAMADU",
      TELDA: String(record.TELDA ?? "").trim(),
      REGIONAL: String(record.REGIONAL ?? "").trim(),
      DIVISI_CC: String(record.DIVISI ?? "").trim(),
      KAWASAN: String(record.KAWASAN ?? "").trim(),
      PROPORSI: record.PROPORSI ?? 0,
      LAYANAN: String(record.LAYANAN ?? "").trim(),
      // Revenue data
      TARGET_REVENUE: typeof record.TARGET_REVENUE === "number" ? record.TARGET_REVENUE : parseIndonesianNumber(record.TARGET_REVENUE),
      TARGET_SUSTAIN: typeof record.TARGET_SUSTAIN === "number" ? record.TARGET_SUSTAIN : parseIndonesianNumber(record.TARGET_SUSTAIN),
      TARGET_SCALING: typeof record.TARGET_SCALING === "number" ? record.TARGET_SCALING : parseIndonesianNumber(record.TARGET_SCALING),
      TARGET_NGTMA: typeof record.TARGET_NGTMA === "number" ? record.TARGET_NGTMA : parseIndonesianNumber(record.TARGET_NGTMA),
      REAL_REVENUE: typeof record.REAL_REVENUE === "number" ? record.REAL_REVENUE : parseIndonesianNumber(record.REAL_REVENUE),
      REAL_SUSTAIN: typeof record.REAL_SUSTAIN === "number" ? record.REAL_SUSTAIN : parseIndonesianNumber(record.REAL_SUSTAIN),
      REAL_SCALING: typeof record.REAL_SCALING === "number" ? record.REAL_SCALING : parseIndonesianNumber(record.REAL_SCALING),
      REAL_NGTMA: typeof record.REAL_NGTMA === "number" ? record.REAL_NGTMA : parseIndonesianNumber(record.REAL_NGTMA),
      REVENUE_BASE: typeof record.REVENUE_BASE === "number" ? record.REVENUE_BASE : parseIndonesianNumber(record.REVENUE_BASE),
      REVENUE_BILLCOM: typeof record.REVENUE_BILLCOM === "number" ? record.REVENUE_BILLCOM : parseIndonesianNumber(record.REVENUE_BILLCOM),
      a_rev: record.a_rev ?? null,
      a_ngtma: record.a_ngtma ?? null,
      a_scaling: record.a_scaling ?? null,
      a_sustain: record.a_sustain ?? null,
      // Extra columns (not in DB but kept for compatibility)
      DIVISI_AM: amMapping?.divisi ?? String(record.DIVISI ?? "").trim(),
      kw: record.kw ?? null,
    };
    return row;
  });
}

/**
 * Convert Cache 2 (Perf. AM pivot cache) result to ParsedRow format.
 * Cache 2 has NIK/NAMA_AM/WITEL_AM directly — use it as authoritative source.
 */
export function pivotCacheRowsToParsedRowsFromCache2(
  result: PivotCacheResult,
  nipnas2am: Map<string, NipnasAmMapping> = new Map()
): ParsedRow[] {
  console.log("[PIVOT-C2-TO-ROWS] recordCount=" + result.recordCount);
  return result.records.map(record => {
    const nik = String(record.NIK ?? "").trim();
    const namaAm = String(record.NAMA_AM ?? "").trim();
    const nipNasGroup = String(record.NIP_NAS_GROUP ?? "").trim();

    const resolvedNik = nik || (nipNasGroup ? nipnas2am.get(nipNasGroup)?.nik ?? "" : "");
    const resolvedNamaAm = namaAm || (nipNasGroup ? nipnas2am.get(nipNasGroup)?.namaAm ?? "" : "");

    const witelAm = String(record.WITEL_AM ?? "").trim().toUpperCase();
    if (!witelAm.includes("SURAMADU")) return null;

    const row: ParsedRow = {
      NIK: resolvedNik,
      NAMA_AM: resolvedNamaAm,
      LEVEL_AM: String(record.LEVEL_AM ?? "").trim(),
      POSITION: String(record.POSITION ?? "").trim(),
      WITEL_AM: witelAm,
      DIVISI_AM: String(record.DIVISI_AM ?? "").trim(),
      PERIODE: String(record.PERIODE ?? "").trim(),
      NIP_NAS_GROUP: nipNasGroup,
      NIP_NAS: String(record.NIP_NAS ?? "").trim(),
      STANDARD_NAME: String(record.STANDARD_NAME ?? "").trim(),
      GROUP: String(record.GROUP ?? "").trim(),
      INDUSTRI: String(record.INDUSTRI ?? "").trim(),
      LSEGMEN: String(record.LSEGMEN ?? "").trim(),
      SSEGMEN: String(record.SSEGMEN ?? "").trim(),
      WITEL_CC: String(record.WITEL_CC ?? "").trim() || "SURAMADU",
      TELDA: String(record.TELDA ?? "").trim(),
      REGIONAL: String(record.REGIONAL ?? "").trim(),
      DIVISI_CC: String(record.DIVISI_CC ?? "").trim(),
      KAWASAN: String(record.KAWASAN ?? "").trim(),
      PROPORSI: record.PROPORSI ?? 0,
      LAYANAN: String(record.LAYANAN ?? "").trim(),
      TARGET_REVENUE: typeof record.TARGET_REVENUE === "number" ? record.TARGET_REVENUE : parseIndonesianNumber(record.TARGET_REVENUE),
      TARGET_SUSTAIN: typeof record.TARGET_SUSTAIN === "number" ? record.TARGET_SUSTAIN : parseIndonesianNumber(record.TARGET_SUSTAIN),
      TARGET_SCALING: typeof record.TARGET_SCALING === "number" ? record.TARGET_SCALING : parseIndonesianNumber(record.TARGET_SCALING),
      TARGET_NGTMA: typeof record.TARGET_NGTMA === "number" ? record.TARGET_NGTMA : parseIndonesianNumber(record.TARGET_NGTMA),
      REAL_REVENUE: typeof record.REAL_REVENUE === "number" ? record.REAL_REVENUE : parseIndonesianNumber(record.REAL_REVENUE),
      REAL_SUSTAIN: typeof record.REAL_SUSTAIN === "number" ? record.REAL_SUSTAIN : parseIndonesianNumber(record.REAL_SUSTAIN),
      REAL_SCALING: typeof record.REAL_SCALING === "number" ? record.REAL_SCALING : parseIndonesianNumber(record.REAL_SCALING),
      REAL_NGTMA: typeof record.REAL_NGTMA === "number" ? record.REAL_NGTMA : parseIndonesianNumber(record.REAL_NGTMA),
      REVENUE_BASE: typeof record.REVENUE_BASE === "number" ? record.REVENUE_BASE : parseIndonesianNumber(record.REVENUE_BASE),
      REVENUE_BILLCOM: typeof record.REVENUE_BILLCOM === "number" ? record.REVENUE_BILLCOM : parseIndonesianNumber(record.REVENUE_BILLCOM),
      a_rev: record.a_rev ?? null,
      a_ngtma: record.a_ngtma ?? null,
      a_scaling: record.a_scaling ?? null,
      a_sustain: record.a_sustain ?? null,
      kw: record.kw ?? null,
    };
    return row;
  }).filter((r): r is ParsedRow => r !== null);
}

// Debug: export parsed pivot cache to XLSX file in .tmp-import for inspection
async function debugExportPivotCache(result: PivotCacheResult) {
  try {
    const ws = XLSX.utils.json_to_sheet(result.records.slice(0, 10)); // first 10 rows
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "pivot_cache");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fs = await import("fs");
    const path = await import("path");
    const tmpPath = path.join(process.cwd(), ".tmp-import", `pivot_debug_${Date.now()}.xlsx`);
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, buf);
    console.log("[PIVOT-DEBUG] Exported to " + tmpPath + " | fields=" + result.fields.join(","));
  } catch (e) {
    console.log("[PIVOT-DEBUG] Export failed: " + (e as Error).message);
  }
}


export function exportPivotCacheToXlsx(result: PivotCacheResult): Buffer {
  const ws = XLSX.utils.json_to_sheet(result.records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PivotCache");
  const xlsxb = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(xlsxb);
}

// ─── RAW Format Detection & Multi-Sheet Transformation ─────────────────────────

const RAW_REQUIRED_COLS = ["PERIODE", "NIK", "NAMA_AM", "STANDARD_NAME", "WITEL_CC", "PROPORSI"];

/**
 * Check if rows are already in RAW format (one row per customer).
 * RAW rows have PERIODE + NIK + NAMA_AM + STANDARD_NAME + WITEL_CC + PROPORSI columns.
 */
export function isRawFormat(rows: ParsedRow[]): boolean {
  if (rows.length < 1) return false;
  const first = rows[0];
  const keys = Object.keys(first).map(k => k.toUpperCase());
  const score = RAW_REQUIRED_COLS.filter(col => keys.includes(col)).length;
  // All 6 required columns must be present
  return score === RAW_REQUIRED_COLS.length;
}

/**
 * Detect if a workbook is a multi-sheet Perf. AM file (not RAW).
 * Returns true when the workbook has multiple sheets and the first sheet
 * lacks the PERIODE column (indicating it's the Perf. AM aggregated format).
 */
export function isMultiSheetPerfFile(buffer: Buffer): boolean {
  try {
    const wb = XLSX.read(buffer, { type: "buffer", bookSheets: true });
    // Has multiple sheets = likely Perf. AM multi-sheet format
    return wb.SheetNames.length > 1;
  } catch {
    return false;
  }
}

/**
 * Transform a multi-sheet Perf. AM file into RAW format (one row per customer per period).
 *
 * Strategy: parse "Perf. CC" sheet for customer-level data, join with "NIPNAS2AM"
 * sheet to resolve NIPNAS → AM (NIK + NAMA_AM), then reshape from
 * "periods-as-columns" layout into "one-row-per-period" rows.
 *
 * Perf. CC column layout (multi-period version):
 *   A: DIVISI      B: NIP_NAS_GROUP  C: STANDARD_NAME
 *   D: TARGET_REV_1  E: REAL_REV_1  F: a_rev_1
 *   G: TARGET_REV_2  H: REAL_REV_2  I: a_rev_2
 *   ... (repeating for each period)
 *   last 3 cols: Total TARGET, Total REAL, Total a_rev
 *
 * The header row (row 6) has nulls where period values would be in columns D,E,F,
 * and the actual period codes (e.g. "202601") appear in row 5.
 */
export function transformMultiSheetToRaw(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: true, defval: null, cellDates: true });

  // ── 1. Build NIPNAS → AM lookup from "NIPNAS2AM" sheet ──────────────────
  // Format: NIPNAS (number), AM (string like "920064-ERVINA HANDAYANI")
  const nipnas2am = new Map<string, { nik: string; namaAm: string }>();
  const nipnasSheet = wb.Sheets["NIPNAS2AM"];
  if (nipnasSheet) {
    const nipnasRaw = XLSX.utils.sheet_to_json(nipnasSheet, { header: 1, defval: null, raw: true }) as any[][];
    for (let i = 1; i < nipnasRaw.length; i++) {
      const row = nipnasRaw[i];
      if (!row || row[0] == null) continue;
      const nipnasStr = String(row[0]).trim();
      const amRaw = String(row[1] ?? "").trim();
      if (!nipnasStr || !amRaw) continue;
      // AM field may contain multiple AMs separated by ", " — take the first one
      const amFirst = amRaw.split(",")[0].trim();
      const dashIdx = amFirst.indexOf("-");
      if (dashIdx > 0) {
        const nik = amFirst.slice(0, dashIdx);
        const namaAm = amFirst.slice(dashIdx + 1).trim();
        nipnas2am.set(nipnasStr, { nik, namaAm });
      }
    }
  }

  // ── 2. Parse "Perf. CC" sheet for customer data ─────────────────────────
  const ccSheet = wb.Sheets["Perf. CC"];
  if (!ccSheet) return [];

  const ccRaw = XLSX.utils.sheet_to_json(ccSheet, { header: 1, defval: null, raw: true }) as any[][];
  if (ccRaw.length < 8) return [];

  // Find header row (row with "DIVISI" and "NIP_NAS_GROUP")
  let headerRowIdx = -1;
  for (let i = 0; i < ccRaw.length; i++) {
    const row = ccRaw[i];
    if (row && (row[0] === "DIVISI" || row[0] === "NIP_NAS_GROUP")) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) return [];

  const headerRow = ccRaw[headerRowIdx] as any[];
  const dataRows = ccRaw.slice(headerRowIdx + 1);

  // Parse period codes from row 5 (index 5) — columns D onwards (index 3+)
  // Row 5: [null, null, null, "202601", null, null, "202602", null, null, ...]
  // Period codes appear in columns 3, 6, 9, 12, ... (every 3rd column after col 3)
  const periodRow = ccRaw[5] || [];
  const periods: string[] = [];
  for (let col = 3; col < periodRow.length - 3; col += 3) {
    const p = periodRow[col];
    if (p != null && String(p).trim()) {
      periods.push(String(p).trim());
    }
  }

  // Header indices within data rows (relative to headerRowIdx):
  // Col 0 = DIVISI, Col 1 = NIP_NAS_GROUP, Col 2 = STANDARD_NAME
  // For each period at offset colOffset, we have: colOffset = TARGET, colOffset+1 = REAL, colOffset+2 = a_rev
  // Total columns at end: 3 cols before periods (DIVISI, NIP_NAS, NAME) + periods.length*3 + 3 total cols

  // ── 3. Transform: one row per customer per period ────────────────────────
  // Note: Perf. CC uses merged cells for DIVISI — forward-fill through groups
  const rawRows: ParsedRow[] = [];
  let currentDivisi = "";

  for (const dataRow of dataRows) {
    if (!dataRow || dataRow.length < 3) continue;
    // Forward-fill DIVISI: merged cells only have value in first row of group
    const divisiCell = String(dataRow[0] ?? "").trim();
    if (divisiCell) currentDivisi = divisiCell;
    const nipNasGroup = String(dataRow[1] ?? "").trim();
    const stdName = String(dataRow[2] ?? "").trim();

    // Skip subtotal / total rows
    if (!nipNasGroup || isNaN(Number(nipNasGroup))) continue;

    // Look up AM from NIPNAS2AM
    const amInfo = nipnas2am.get(nipNasGroup);
    if (!amInfo) continue;

    // Extract revenue for each period
    for (let pIdx = 0; pIdx < periods.length; pIdx++) {
      const periode = periods[pIdx];
      const colBase = 3 + pIdx * 3; // TARGET_REV column for this period
      const targetRev = dataRow[colBase] != null ? parseIndonesianNumber(dataRow[colBase]) : 0;
      const realRev = dataRow[colBase + 1] != null ? parseIndonesianNumber(dataRow[colBase + 1]) : 0;
      const aRev = dataRow[colBase + 2] != null ? parseFloat(String(dataRow[colBase + 2])) || 0 : 0;

      // Compute achievement rate
      const achRate = targetRev > 0 ? realRev / targetRev : 0;

      // Default fields that don't exist in the non-RAW source
      const tahun = parseInt(periode.slice(0, 4), 10);
      const bulan = parseInt(periode.slice(4, 6), 10);

      rawRows.push({
        PERIODE: periode,
        NIK: amInfo.nik,
        NAMA_AM: amInfo.namaAm,
        LEVEL_AM: "",
        POSITION: "",
        WITEL_AM: "SURAMADU",
        DIVISI_AM: currentDivisi,
        NIP_NAS_GROUP: nipNasGroup,
        NIP_NAS: nipNasGroup,
        STANDARD_NAME: stdName,
        GROUP: "",
        INDUSTRI: "",
        LSEGMEN: "",
        SSEGMEN: "",
        WITEL_CC: "SURAMADU",
        TELDA: "",
        REGIONAL: "TREG 3",
        DIVISI_CC: currentDivisi,
        KAWASAN: "",
        PROPORSI: 0,
        LAYANAN: "",
        TARGET_REVENUE: targetRev,
        TARGET_SUSTAIN: 0,
        TARGET_SCALING: 0,
        TARGET_NGTMA: 0,
        REAL_REVENUE: realRev,
        REAL_SUSTAIN: 0,
        REAL_SCALING: 0,
        REAL_NGTMA: 0,
        REVENUE_BASE: 0,
        REVENUE_BILLCOM: 0,
        a_rev: aRev,
        a_ngtma: 0,
        a_scaling: 0,
        a_sustain: 0,
        kw: achRate >= 1 ? "hijau" : achRate >= 0.8 ? "oranye" : "merah",
        // Extra columns (not in DB but kept for compatibility)
        divisi_raw: currentDivisi,
        tahun,
        bulan,
        ach_rate: achRate,
      });
    }
  }

  return rawRows;
}
