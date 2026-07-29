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
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const resolvedSheet = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[resolvedSheet];

  // Smart parsing: detect title row (row 0 has only 1 non-null cell, rest null)
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false }) as any[][];
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
          if (h) {
            // Normalize header: trim, remove extra spaces, uppercase
            const normalized = String(h).trim().replace(/\s+/g, " ").toUpperCase();
            obj[normalized] = row[i] ?? null;
          }
        });
        return obj;
      });
  }

  // Normal parsing (first row is header)
  // Use sheet_to_json then normalize all keys to uppercase
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false }) as ParsedRow[];
  return rows.map(row => {
    const normalized: ParsedRow = {};
    for (const [k, v] of Object.entries(row)) {
      if (k) normalized[String(k).trim().replace(/\s+/g, " ").toUpperCase()] = v;
    }
    return normalized;
  });
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
}

export function cleanFunnelRows(rows: ParsedRow[], opts?: { skipDivisiFilter?: boolean; strictIsReport?: boolean; skipIsReportFilter?: boolean; skipWitelFilter?: boolean; preferPembuat?: boolean; pembuatOnly?: boolean }): CleanedFunnelRow[] {
  const passed: CleanedFunnelRow[] = [];

  for (const r of rows) {
    // ── STEP 1: Filter witel = SURAMADU
    const witel = cleanUpper(r.WITEL);
    if (!opts?.skipWitelFilter && !witel.includes("SURAMADU")) continue;

    // ── STEP 2: Filter divisi = DPS / DSS
    const divisi = clean(r.DIVISI).toUpperCase();
    const VALID_DIVISI = new Set(["DPS", "DSS"]);
    if (!opts?.skipDivisiFilter && !VALID_DIVISI.has(divisi)) continue;

    // ── STEP 3: NIK AM extraction
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
    const reportYearForNik = reportDateForNik ? parseInt(reportDateForNik.slice(0, 4), 10) : 0;
    let nikAm = String(nikRaw);
    if (nikAm === "850099" && (!opts?.pembuatOnly || reportYearForNik >= 2026)) nikAm = "870022";

    // ── STEP 4: Reject garbage NIKs
    if (nikAm.length < 4 || Number(nikAm) > 9999999) continue;

    // ── STEP 5: Filter is_report = 'Y'
    if (!opts?.skipIsReportFilter) {
      const isReportRaw = r.IS_REPORT ?? null;
      if (opts?.strictIsReport) {
        const isReportStr = isReportRaw !== null && isReportRaw !== undefined && isReportRaw !== ""
          ? String(isReportRaw).trim().toUpperCase() : "";
        if (isReportStr !== "Y" && isReportStr !== "1" && isReportStr !== "YES" && isReportStr !== "TRUE") continue;
      } else if (isReportRaw !== null && isReportRaw !== undefined && isReportRaw !== "") {
        const isReportStr = String(isReportRaw).trim().toUpperCase();
        if (isReportStr !== "Y" && isReportStr !== "1" && isReportStr !== "YES" && isReportStr !== "TRUE") continue;
      }
    }

    // ── STEP 6: Fix AM name — RENI WULANSARI → HAVEA PERTIWI
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
 * 2. Filter divisi = "DPS" atau "DSS"
 * 3. Validasi NIK numerik (Int64 — baris dengan NIK non-numerik di-skip)
 * 4. Simpan datetime penuh (termasuk jam) untuk createdat, start_date, end_date
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
        segmen: clean(getCol(r, "segmen", "SEGMEN")),
        regional: clean(getCol(r, "regional", "REGIONAL")),
        witel,
        nipnas: clean(getCol(r, "nipnas", "NIPNAS")),
        caName: cleanUpper(getCol(r, "ca_name", "CA_NAME")) || "",
        activityType: clean(getCol(r, "activity_type", "ACTIVITY_TYPE")),
        label: clean(getCol(r, "label", "LABEL")),
        lopid: clean(getCol(r, "lopid", "LOPID")),
        createdatActivity: parseRawDateTimeStr(getCol(r, "createdat")),
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
