import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, ChevronLeft, Search, X } from "lucide-react";
import { cn, formatRupiah } from "@/shared/lib/utils";

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

interface FilterCol {
  field: string;
  label: string;
  width: string;
  align?: "right" | "center";
  categorical?: boolean;
  options?: string[];
  format?: (val: any) => string;
}

const COLUMNS: FilterCol[] = [
  { field: "nik", label: "NIK", width: "90px" },
  { field: "namaAm", label: "Nama AM", width: "140px" },
  { field: "levelAm", label: "Level AM", width: "80px" },
  { field: "witelAm", label: "Witel", width: "90px" },
  { field: "divisi", label: "Divisi AM", width: "70px" },
  { field: "divisiCc", label: "Divisi CC", width: "70px" },
  { field: "tahun", label: "Tahun", width: "60px", align: "center" },
  { field: "bulan", label: "Bulan", width: "55px", align: "center" },
  { field: "targetRevenue", label: "T. Revenue", width: "110px", align: "right" },
  { field: "realRevenue", label: "R. Revenue", width: "110px", align: "right" },
  { field: "targetSustain", label: "T. Sustain", width: "100px", align: "right" },
  { field: "realSustain", label: "R. Sustain", width: "100px", align: "right" },
  { field: "targetScaling", label: "T. Scaling", width: "100px", align: "right" },
  { field: "realScaling", label: "R. Scaling", width: "100px", align: "right" },
  { field: "targetNgtma", label: "T. NGTMA", width: "100px", align: "right" },
  { field: "realNgtma", label: "R. NGTMA", width: "100px", align: "right" },
  { field: "achRate", label: "Ach %", width: "70px", align: "right" },
  { field: "rankAch", label: "Rank", width: "50px", align: "center" },
  { field: "statusWarna", label: "Status", width: "70px", align: "center", categorical: true, options: ["hijau","oranye","merah"] },
];

function num(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function formatVal(col: FilterCol, val: any): string {
  if (val === null || val === undefined || val === "") return "–";
  if (col.format) return col.format(val);
  if (col.field === "bulan") return String(val).padStart(2, "0");
  if (col.field === "achRate" || col.field === "achRateYtd") {
    const pct = num(val) * 100;
    return isNaN(pct) ? "–" : pct.toFixed(1) + "%";
  }
  if (col.align === "right" && !col.categorical) {
    return formatRupiah(num(val));
  }
  return String(val);
}

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

  return createPortal(
    <div ref={ref} style={style} className="bg-card border border-border rounded-xl shadow-2xl w-64 overflow-hidden"
      onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <span className="text-xs font-semibold text-foreground">{COLUMNS.find(c => c.field === field)?.label}</span>
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

export default function PerformanceDetailTable({ rows }: { rows: PerformanceRow[] }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [activeFilter, setActiveFilter] = useState<{ field: string; rect: DOMRect } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const rowCount = rows.length;

  useEffect(() => { setPage(1); }, [search, columnFilters]);

  const dropdownOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const col of COLUMNS) {
      if (col.categorical && !col.options) {
        const vals = [...new Set(rows.map(r => (r as any)[col.field] || ""))];
        opts[col.field] = vals.sort((a, b) => a.localeCompare(b));
      }
    }
    return opts;
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(r =>
        COLUMNS.some(col => {
          const val = (r as any)[col.field];
          return typeof val === "string" && val.toLowerCase().includes(q);
        })
      );
    }
    for (const [field, selected] of Object.entries(columnFilters)) {
      if (selected.size === 0) continue;
      result = result.filter(r => {
        const val = (r as any)[field] || "";
        return selected.has(val);
      });
    }
    return result;
  }, [rows, search, columnFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
    const opts = COLUMNS.find(c => c.field === field)?.options || dropdownOptions[field] || [];
    setColumnFilters(prev => ({ ...prev, [field]: new Set(opts) }));
  }, [dropdownOptions]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-xs text-muted-foreground">
          {filtered.length !== rowCount
            ? <span><strong className="text-foreground">{filtered.length}</strong> dari {rowCount} baris</span>
            : <span><strong className="text-foreground">{rowCount}</strong> baris</span>
          }
          {Object.keys(columnFilters).length > 0 && (
            <button onClick={() => setColumnFilters({})} className="ml-3 text-[10px] px-2 py-0.5 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground">
              Reset filter
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari semua kolom..."
            className="pl-8 pr-3 h-8 text-xs border border-border rounded-lg bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all w-56" />
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-secondary/50 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">
              <th className="px-2 py-2.5 w-5"></th>
              {COLUMNS.map(col => {
                const hasFilter = (columnFilters[col.field]?.size ?? 0) > 0;
                const isActive = activeFilter?.field === col.field;
                return (
                  <th key={col.field} className="px-2 py-2.5 relative" style={{ minWidth: col.width, width: col.width }}>
                    <div className="flex items-center gap-1">
                      <span className="truncate">{col.label}</span>
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
              <tr><td colSpan={COLUMNS.length + 1} className="text-center py-12 text-muted-foreground">
                {search || Object.keys(columnFilters).length > 0 ? "Tidak ada baris yang cocok" : "Tidak ada data"}
              </td></tr>
            )}
            {paged.map((r, i) => {
              const absIdx = (page - 1) * PAGE_SIZE + i;
              const customers: any[] = (() => {
                try { return r.komponenDetail ? JSON.parse(r.komponenDetail) : []; } catch { return []; }
              })();
              const isExpanded = expandedRows.has(absIdx);
              return (
                <React.Fragment key={r.id}>
                  <tr className={cn("transition-colors", customers.length > 0 ? "cursor-pointer hover:bg-secondary/20" : "hover:bg-secondary/10", isExpanded && "bg-secondary/10")}
                    onClick={() => customers.length > 0 && toggleExpand(absIdx)}>
                    <td className="px-2 py-2 text-muted-foreground">
                      {customers.length > 0 ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
                    </td>
                    {COLUMNS.map(col => (
                      <td key={col.field}
                        className={cn("px-2 py-2", col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "", col.field === "achRate" && num(r.achRate) >= 1 ? "text-green-600 font-bold" : col.field === "achRate" && num(r.achRate) >= 0.8 ? "text-orange-500 font-bold" : col.field === "achRate" && num(r.achRate) > 0 ? "text-red-600 font-bold" : "")}>
                        {col.field === "statusWarna" ? (
                          <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                            r.statusWarna === "hijau" ? "text-green-700 bg-green-50 border-green-200" :
                            r.statusWarna === "oranye" ? "text-orange-700 bg-orange-50 border-orange-200" :
                            "text-red-700 bg-red-50 border-red-200")}>{r.statusWarna?.toUpperCase()}</span>
                        ) : (
                          <span className={cn("truncate block", col.align === "right" ? "tabular-nums" : "")}>{formatVal(col, (r as any)[col.field])}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && customers.length > 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-0 py-0 bg-secondary/5">
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

      {activeFilter && (() => {
        const col = COLUMNS.find(c => c.field === activeFilter.field)!;
        const opts = col.options || dropdownOptions[activeFilter.field] || [];
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
