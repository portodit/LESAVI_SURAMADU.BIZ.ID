import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, ChevronLeft, Search, X, ArrowUp, ArrowDown, Download, Loader2 } from "lucide-react";
import { cn, formatRupiah } from "@/shared/lib/utils";
import * as XLSX from "xlsx";

const PAGE_SIZE = 50;

export interface PerformanceRow {
  id: number;
  nik: string | null;
  namaAm: string | null;
  divisi: string | null;
  divisiCc: string | null;
  witelAm: string | null;
  levelAm: string | null;
  tahun: number | null;
  bulan: number | null;
  targetRevenue: string | null;
  realRevenue: string | null;
  targetReguler: string | null;
  realReguler: string | null;
  targetSustain: string | null;
  realSustain: string | null;
  targetScaling: string | null;
  realScaling: string | null;
  targetNgtma: string | null;
  realNgtma: string | null;
  revenueBase: string | null;
  revenueBillcom: string | null;
  aRev: string | null;
  aNgtma: string | null;
  aScaling: string | null;
  aSustain: string | null;
  achRate: string | null;
  achRateYtd: string | null;
  rankAch: number | null;
  statusWarna: string | null;
  komponenDetail: string | null;
  snapshotDate: string | null;
  importId: number | null;
  createdAt: string | null;
}

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

type AchTimeScope = "monthly" | "yearly";
type AchComponent = "real" | "sustain" | "scaling";

interface SortState {
  field: string;
  direction: "asc" | "desc";
}

interface FilterCol {
  field: string;
  label: string;
  width: string;
  align?: "right" | "center";
  sortable?: boolean;
  editable?: boolean;
  editableType?: "text" | "number";
  defaultEditable?: boolean;
}

const COLUMNS: FilterCol[] = [
  { field: "periode", label: "Periode", width: "90px", align: "center", sortable: true, editable: true },
  { field: "nik", label: "NIK", width: "90px", sortable: true, editable: true },
  { field: "namaAm", label: "Nama AM", width: "140px", sortable: true, editable: true },
  { field: "levelAm", label: "Level AM", width: "80px", sortable: true, editable: true },
  { field: "witelAm", label: "Witel", width: "90px", sortable: true, editable: true },
  { field: "divisi", label: "Divisi AM", width: "70px", sortable: true, editable: true },
  { field: "divisiCc", label: "Divisi CC", width: "70px", sortable: true, editable: true },
  { field: "targetRevenue", label: "T. Revenue", width: "110px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "realRevenue", label: "R. Revenue", width: "110px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "targetSustain", label: "T. Sustain", width: "100px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "realSustain", label: "R. Sustain", width: "100px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "targetScaling", label: "T. Scaling", width: "100px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "realScaling", label: "R. Scaling", width: "100px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "targetNgtma", label: "T. NGTMA", width: "100px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "realNgtma", label: "R. NGTMA", width: "100px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "achRate", label: "Ach %", width: "70px", align: "right", sortable: true, editable: true, editableType: "number" },
  { field: "rankAch", label: "Rank", width: "50px", align: "center", sortable: true, editable: true, editableType: "number" },
  { field: "statusWarna", label: "Status", width: "70px", align: "center", sortable: true, editable: true },
];

// ─── Column Filter Popup ────────────────────────────────────────────────────────
function ColumnFilterPopup({
  field, options, selected, onToggle, onClear, onSelectAll, anchorRect, onClose,
}: {
  field: string; options: string[]; selected: Set<string>;
  onToggle: (val: string) => void; onClear: () => void; onSelectAll: () => void;
  anchorRect: DOMRect; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.bottom + 4,
    left: Math.min(anchorRect.left, window.innerWidth - 260),
    zIndex: 9999,
  };

  const colLabel = COLUMNS.find(c => c.field === field)?.label || field;

  return createPortal(
    <div ref={ref} style={style} className="bg-card border border-border rounded-xl shadow-2xl w-64 overflow-hidden"
      onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <span className="text-xs font-semibold text-foreground">{colLabel}</span>
        <button onMouseDown={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-2 py-1.5 border-b border-border/50">
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..."
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
          onMouseDown={e => e.stopPropagation()} />
      </div>
      <div className="flex gap-1 px-2 py-1.5 border-b border-border/50">
        <button onMouseDown={e => { e.stopPropagation(); onSelectAll(); }} className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground">Select All</button>
        <button onMouseDown={e => { e.stopPropagation(); onClear(); }} className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground">Clear</button>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.length === 0 && <div className="text-center py-4 text-xs text-muted-foreground">Tidak ada hasil</div>}
        {filtered.map(opt => (
          <label key={opt} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-secondary/30 cursor-pointer text-xs">
            <input type="checkbox" checked={selected.has(opt)} onChange={() => onToggle(opt)} className="w-3.5 h-3.5 rounded accent-primary" />
            <span className="truncate flex-1">{opt || <em className="text-muted-foreground">[Kosong]</em>}</span>
          </label>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border/50 text-[10px] text-muted-foreground bg-secondary/10">
        {selected.size} dipilih dari {options.length}
      </div>
    </div>,
    document.body
  );
}

// ─── Cascading Ach Selectors ─────────────────────────────────────────────────────
function AchDropdown({
  label, options, value, onChange,
}: {
  label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-7 pl-2 pr-6 text-[11px] font-semibold rounded-lg border border-primary/30 bg-primary/8 text-primary appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 hover:bg-primary/15 transition-colors"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{label}: {o.label}</option>
      ))}
    </select>
  );
}

const TIME_SCOPES = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly (YTD)" },
];

const ACH_COMPONENTS = [
  { value: "real", label: "Real Revenue" },
  { value: "sustain", label: "Sustain" },
  { value: "scaling", label: "Scaling" },
];

function num(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function formatPeriode(tahun: number | null, bulan: number | null): string {
  if (!tahun || !bulan) return "–";
  return `${MONTHS_SHORT[bulan - 1] || ""} ${tahun}`;
}

function calcAch(timeScope: AchTimeScope, component: AchComponent, row: PerformanceRow): number {
  if (timeScope === "yearly") return num(row.achRateYtd);
  if (component === "sustain") {
    const t = num(row.targetSustain); const r = num(row.realSustain);
    return t > 0 ? r / t : 0;
  }
  if (component === "scaling") {
    const t = num(row.targetScaling); const r = num(row.realScaling);
    return t > 0 ? r / t : 0;
  }
  // real (default)
  const t = num(row.targetRevenue); const r = num(row.realRevenue);
  return t > 0 ? r / t : 0;
}

export default function PerformanceDetailTable({ rows: initialRows, importId }: { rows: PerformanceRow[]; importId: number }) {
  const [rows, setRows] = useState<PerformanceRow[]>(initialRows);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [activeFilter, setActiveFilter] = useState<{ field: string; rect: DOMRect } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<SortState>({ field: "", direction: "asc" });
  const [achTimeScope, setAchTimeScope] = useState<AchTimeScope>("monthly");
  const [achComponent, setAchComponent] = useState<AchComponent>("real");
  const [editCell, setEditCell] = useState<{ rowId: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const [saving, setSaving] = useState(false);
  const rowCount = rows.length;

  useEffect(() => { setPage(1); }, [search, columnFilters, sort, achTimeScope, achComponent]);

  // ── Ach mode column label
  const achCol = COLUMNS.find(c => c.field === "achRate")!;
  const timeScopeLabel = TIME_SCOPES.find(t => t.value === achTimeScope)?.label ?? "Monthly";
  const compLabel = ACH_COMPONENTS.find(c => c.value === achComponent)?.label ?? "Real Revenue";
  const achLabel = `Ach ${timeScopeLabel} ${compLabel}`;

  const getCellValue = useCallback((row: PerformanceRow, field: string): string | number => {
    switch (field) {
      case "periode": return (row.tahun ?? 0) * 100 + (row.bulan ?? 0);
      case "achRate": return calcAch(achTimeScope, achComponent, row);
      case "rankAch": return row.rankAch ?? 0;
      case "targetRevenue": return num(row.targetRevenue);
      case "realRevenue": return num(row.realRevenue);
      case "targetSustain": return num(row.targetSustain);
      case "realSustain": return num(row.realSustain);
      case "targetScaling": return num(row.targetScaling);
      case "realScaling": return num(row.realScaling);
      case "targetNgtma": return num(row.targetNgtma);
      case "realNgtma": return num(row.realNgtma);
      default: return String((row as any)[field] ?? "");
    }
  }, [achTimeScope, achComponent]);

  const displayValue = useCallback((row: PerformanceRow, col: FilterCol): string => {
    const isAch = col.field === "achRate";
    if (isAch) {
      const v = calcAch(achTimeScope, achComponent, row);
      return v === 0 ? "–" : (v * 100).toFixed(1) + "%";
    }
    if (col.field === "periode") return formatPeriode(row.tahun, row.bulan);
    if (col.align === "right" && col.field !== "statusWarna") {
      return formatRupiah(num((row as any)[col.field]));
    }
    return String((row as any)[col.field] ?? "–");
  }, [achTimeScope, achComponent]);

  const dropdownOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const col of COLUMNS) {
      const vals = [...new Set(rows.map(r => displayValue(r, col)))];
      opts[col.field] = vals.sort((a, b) => String(a).localeCompare(String(b), "id-ID"));
    }
    return opts;
  }, [rows, displayValue]);

  const filtered = useMemo(() => {
    let result = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(r =>
        COLUMNS.some(col => {
          const val = displayValue(r, col);
          return typeof val === "string" && val.toLowerCase().includes(q);
        })
      );
    }
    for (const [field, selected] of Object.entries(columnFilters)) {
      if (selected.size === 0) continue;
      result = result.filter(r => {
        const val = displayValue(r, COLUMNS.find(c => c.field === field)!, row);
        return selected.has(typeof val === "number" ? val.toString() : val);
      });
    }
    return result;
  }, [rows, search, columnFilters, displayValue]);

  const sorted = useMemo(() => {
    if (!sort.field) return filtered;
    return [...filtered].sort((a, b) => {
      const av = getCellValue(a, sort.field);
      const bv = getCellValue(b, sort.field);
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "id-ID");
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort, getCellValue]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleExpand = useCallback((idx: number) => {
    setExpandedRows(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  }, []);

  const handleFilterToggle = useCallback((field: string, value: string) => {
    setColumnFilters(prev => {
      const cur = prev[field] || new Set<string>();
      const next = new Set(cur);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [field]: next };
    });
  }, []);

  const handleFilterClear = useCallback((field: string) => {
    setColumnFilters(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const handleFilterSelectAll = useCallback((field: string) => {
    const opts = dropdownOptions[field] || [];
    setColumnFilters(prev => ({ ...prev, [field]: new Set(opts) }));
  }, [dropdownOptions]);

  const handleSort = useCallback((field: string) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!editCell) return;
    const { rowId, field } = editCell;
    setSaving(true);
    try {
      const res = await fetch(`/api/import/${importId}/rows/${rowId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: editValue }),
      });
      if (res.ok) {
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: editValue } : r));
      } else {
        alert("Gagal menyimpan.");
      }
      setEditCell(null);
    } catch {
      alert("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }, [editCell, editValue, importId]);

  const handleCellDoubleClick = useCallback((rowId: number, field: string, value: string) => {
    setEditCell({ rowId, field });
    setEditValue(value || "");
    setOriginalValue(value || "");
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditCell(null);
      setEditValue(originalValue);
    }
  }, [handleSave, originalValue]);

  const handleExportExcel = useCallback((data: PerformanceRow[], filename: string) => {
    const EXCEL_COLS = [
      { header: "NIK", field: "nik" },
      { header: "Nama AM", field: "namaAm" },
      { header: "Level AM", field: "levelAm" },
      { header: "Witel", field: "witelAm" },
      { header: "Divisi AM", field: "divisi" },
      { header: "Divisi CC", field: "divisiCc" },
      { header: "Periode", field: "periode" },
      { header: "T. Revenue", field: "targetRevenue" },
      { header: "R. Revenue", field: "realRevenue" },
      { header: "T. Sustain", field: "targetSustain" },
      { header: "R. Sustain", field: "realSustain" },
      { header: "T. Scaling", field: "targetScaling" },
      { header: "R. Scaling", field: "realScaling" },
      { header: "T. NGTMA", field: "targetNgtma" },
      { header: "R. NGTMA", field: "realNgtma" },
      { header: "Ach %", field: "achRate" },
      { header: "Rank", field: "rankAch" },
      { header: "Status", field: "statusWarna" },
    ];

    const sheetData = data.map(row => {
      const rowData: Record<string, any> = {};
      for (const col of EXCEL_COLS) {
        if (col.field === "periode") {
          rowData[col.header] = formatPeriode(row.tahun, row.bulan);
        } else if (col.field === "achRate") {
          const v = calcAch(achTimeScope, achComponent, row);
          rowData[col.header] = v === 0 ? null : v * 100;
        } else if (["targetRevenue", "realRevenue", "targetSustain", "realSustain",
                     "targetScaling", "realScaling", "targetNgtma", "realNgtma"].includes(col.field)) {
          const v = num((row as any)[col.field]);
          rowData[col.header] = v === 0 ? null : v;
        } else {
          rowData[col.header] = (row as any)[col.field] ?? "";
        }
      }
      return rowData;
    });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const colWidths = EXCEL_COLS.map(col => {
      const vals = sheetData.map(r => String(r[col.header] ?? ""));
      const maxLen = Math.max(col.header.length, ...vals.map(v => v.length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws["!cols"] = colWidths;

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[addr]) continue;
      ws[addr].s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Performa AM");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }, [achTimeScope, achComponent]);

  // Build columns with dynamic Ach label
  const activeColumns = useMemo(() => COLUMNS.map(col =>
    col.field === "achRate" ? { ...col, label: achLabel } : col
  ), [achLabel]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-3">
          <AchDropdown label="Periode" options={TIME_SCOPES} value={achTimeScope} onChange={v => setAchTimeScope(v as AchTimeScope)} />
          <AchDropdown label="Komponen" options={ACH_COMPONENTS} value={achComponent} onChange={v => setAchComponent(v as AchComponent)} />
          <div className="h-5 w-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {filtered.length !== rowCount
              ? <span><strong className="text-foreground">{filtered.length}</strong> dari <strong className="text-foreground">{rowCount}</strong> baris</span>
              : <span><strong className="text-foreground">{rowCount}</strong> baris</span>
            }
            {Object.keys(columnFilters).length > 0 && (
              <button onClick={() => setColumnFilters({})} className="ml-2 text-[10px] px-2 py-0.5 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground">
                Reset filter
              </button>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length < rowCount && (
            <button onClick={() => handleExportExcel(sorted, "import_performa_filtered")}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium border border-border rounded-lg bg-white hover:bg-secondary/50 transition-colors text-foreground shadow-sm">
              <Download className="w-3.5 h-3.5" />
              Unduh Filtered ({filtered.length})
            </button>
          )}
          <button onClick={() => handleExportExcel(rows, "import_performa")}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium border border-border rounded-lg bg-white hover:bg-secondary/50 transition-colors text-foreground shadow-sm">
            <Download className="w-3.5 h-3.5" />
            Unduh All ({rowCount})
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari semua kolom..."
              className="pl-8 pr-3 h-8 text-xs border border-border rounded-lg bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all w-56" />
          </div>
        </div>
      </div>

      {/* Edit hint */}
      <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span>Klik dua kali sel untuk edit langsung (seperti Excel)</span>
      </div>

      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-secondary/50 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">
              <th className="px-2 py-2.5 w-5"></th>
              {activeColumns.map(col => {
                const hasFilter = (columnFilters[col.field]?.size ?? 0) > 0;
                const isActive = activeFilter?.field === col.field;
                const isSorted = sort.field === col.field;
                return (
                  <th key={col.field} className="px-2 py-2.5 relative" style={{ minWidth: col.width, width: col.width }}>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => col.sortable !== false && handleSort(col.field)}
                        className={cn("flex items-center gap-0.5 truncate", col.sortable !== false && "cursor-pointer hover:text-foreground", col.sortable === false && "cursor-default")}
                      >
                        <span>{col.label}</span>
                        {isSorted && (
                          sort.direction === "asc"
                            ? <ArrowUp className="w-2.5 h-2.5 shrink-0" />
                            : <ArrowDown className="w-2.5 h-2.5 shrink-0" />
                        )}
                      </button>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget).getBoundingClientRect();
                        setActiveFilter(isActive ? null : { field: col.field, rect });
                      }} className={cn("shrink-0 p-0.5 rounded transition-colors", hasFilter ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:text-muted-foreground")}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M7 2a1 1 0 0 1 2 0v1H7V2zM5 4a1 1 0 0 0-2 0v8a1 1 0 0 0 2 0V4zm5 3a1 1 0 0 0-2 0v5a1 1 0 0 0 2 0V7zm1-4H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z"/>
                        </svg>
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.length === 0 && (
              <tr><td colSpan={activeColumns.length + 1} className="text-center py-12 text-muted-foreground">
                {search || Object.keys(columnFilters).length > 0 ? "Tidak ada baris yang cocok" : "Tidak ada data"}
              </td></tr>
            )}
            {paged.map((r, i) => {
              const absIdx = (page - 1) * PAGE_SIZE + i;
              const customers: any[] = (() => {
                try { return r.komponenDetail ? JSON.parse(r.komponenDetail) : []; } catch { return []; }
              })();
              const isExpanded = expandedRows.has(absIdx);
              const achVal = calcAch(achTimeScope, achComponent, r);

              return (
                <React.Fragment key={r.id}>
                  <tr className={cn("transition-colors group", editCell?.rowId === r.id && "bg-primary/5", customers.length > 0 ? "cursor-pointer hover:bg-secondary/20" : "hover:bg-secondary/10", isExpanded && "bg-secondary/10")}
                    onClick={() => customers.length > 0 && !editCell && toggleExpand(absIdx)}>
                    <td className="px-2 py-2 text-muted-foreground">
                      {customers.length > 0 ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
                    </td>
                    {activeColumns.map(col => {
                      const isEditing = editCell?.rowId === r.id && editCell?.field === col.field;

                      // Ach% color
                      const achColor = col.field === "achRate" ? (
                        achVal >= 1 ? "text-green-600 font-bold" :
                        achVal >= 0.8 ? "text-orange-500 font-bold" :
                        achVal > 0 ? "text-red-600 font-bold" : ""
                      ) : "";

                      if (isEditing) {
                        const numType = col.editableType === "number";
                        return (
                          <td
                            key={col.field}
                            className={cn("px-1 py-1.5", col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "")}
                          >
                            <input
                              autoFocus
                              type={numType ? "number" : "text"}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onBlur={() => { if (editValue !== originalValue) handleSave(); else setEditCell(null); }}
                              className="w-full h-7 px-1 bg-white border-2 border-primary rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 tabular-nums"
                            />
                          </td>
                        );
                      }

                      return (
                        <td
                          key={col.field}
                          className={cn("px-1 py-1.5 relative group", col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "", achColor)}
                          onDoubleClick={() => handleCellDoubleClick(r.id, col.field, String((r as any)[col.field] ?? ""))}
                        >
                          {col.field === "statusWarna" ? (
                            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                              r.statusWarna === "hijau" ? "text-green-700 bg-green-50 border-green-200" :
                              r.statusWarna === "oranye" ? "text-orange-700 bg-orange-50 border-orange-200" :
                              "text-red-700 bg-red-50 border-red-200")}>{r.statusWarna?.toUpperCase()}</span>
                          ) : (
                            <>
                              <span className="px-1 truncate block tabular-nums">{displayValue(r, col)}</span>
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/30">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </div>
                              </div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {isExpanded && customers.length > 0 && (
                    <tr>
                      <td colSpan={activeColumns.length + 1} className="px-0 py-0 bg-secondary/5">
                        <div className="mx-3 my-1.5 border border-border/60 rounded-lg overflow-x-auto">
                          <table className="w-full text-[10px] text-left">
                            <thead>
                              <tr className="bg-secondary/60 text-muted-foreground font-semibold uppercase tracking-wide">
                                <th className="px-3 py-1.5">NIP NAS</th>
                                <th className="px-3 py-1.5">Nama</th>
                                <th className="px-3 py-1.5">Group</th>
                                <th className="px-3 py-1.5">Industri</th>
                                <th className="px-3 py-1.5">L.Segmen</th>
                                <th className="px-3 py-1.5">S.Segmen</th>
                                <th className="px-3 py-1.5">Witel</th>
                                <th className="px-3 py-1.5">Telda</th>
                                <th className="px-3 py-1.5">Regional</th>
                                <th className="px-3 py-1.5">Kawasan</th>
                                <th className="px-3 py-1.5 text-right">Proporsi</th>
                                <th className="px-3 py-1.5 text-right">T.Revenue</th>
                                <th className="px-3 py-1.5 text-right">R.Revenue</th>
                                <th className="px-3 py-1.5 text-right">T.Sustain</th>
                                <th className="px-3 py-1.5 text-right">R.Sustain</th>
                                <th className="px-3 py-1.5 text-right">T.Scaling</th>
                                <th className="px-3 py-1.5 text-right">R.Scaling</th>
                                <th className="px-3 py-1.5 text-right">T.NGTMA</th>
                                <th className="px-3 py-1.5 text-right">R.NGTMA</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {customers.map((c: any, ci: number) => (
                                <tr key={ci} className="hover:bg-secondary/30">
                                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{c.nip || "–"}</td>
                                  <td className="px-3 py-1.5 font-medium max-w-[160px] truncate" title={c.pelanggan}>{c.pelanggan || "–"}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{c.group || "–"}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{c.industri || "–"}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{c.lsegmen || "–"}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{c.ssegmen || "–"}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{c.witelCc || "–"}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{c.telda || "–"}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{c.regional || "–"}</td>
                                  <td className="px-3 py-1.5 text-muted-foreground">{c.kawasan || "–"}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{typeof c.proporsi === "number" && !isNaN(c.proporsi) ? c.proporsi.toFixed(2) : "–"}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatRupiah(c.targetTotal ?? 0)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">{formatRupiah(c.realTotal ?? 0)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatRupiah(c.Sustain?.target ?? 0)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatRupiah(c.Sustain?.real ?? 0)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatRupiah(c.Scaling?.target ?? 0)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatRupiah(c.Scaling?.real ?? 0)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatRupiah(c.NGTMA?.target ?? 0)}</td>
                                  <td className="px-3 py-1.5 text-right tabular-nums">{formatRupiah(c.NGTMA?.real ?? 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Halaman {page} dari {totalPages}</span>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-secondary transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
            return (
              <button key={p} onClick={() => setPage(p)}
                className={cn("px-2.5 py-1 border rounded text-xs", p === page ? "bg-primary text-white border-primary" : "hover:bg-secondary transition-colors")}>
                {p}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-secondary transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Column filter popup */}
      {activeFilter && (() => {
        const col = activeColumns.find(c => c.field === activeFilter.field)!;
        const opts = dropdownOptions[activeFilter.field] || [];
        if (opts.length === 0) return null;
        return (
          <ColumnFilterPopup
            field={activeFilter.field} options={opts}
            selected={columnFilters[activeFilter.field] || new Set()}
            onToggle={(val) => handleFilterToggle(activeFilter.field, val)}
            onClear={() => handleFilterClear(activeFilter.field)}
            onSelectAll={() => handleFilterSelectAll(activeFilter.field)}
            anchorRect={activeFilter.rect}
            onClose={() => setActiveFilter(null)}
          />
        );
      })()}
    </div>
  );
}

// Lazy import Loader2 for the saving spinner
function Loader2({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
