import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

async function apiFetch(path: string, opts?: RequestInit) {
  const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw d; }
  return res.json();
}

const PAGE_SIZE = 50;

const ACTIVITY_TYPES = ["Kunjungan", "Administrasi", "Follow-up", "Penawaran", "Koordinasi", "Negosiasi"];
const DIVISI_OPTIONS = ["DPS", "DSS"];

export interface ActivityRow {
  id: number;
  nik: string | null;
  fullname: string | null;
  divisi: string | null;
  segmen: string | null;
  regional: string | null;
  witel: string | null;
  nipnas: string | null;
  caName: string | null;
  activityType: string | null;
  label: string | null;
  lopid: string | null;
  createdatActivity: string | null;
  activityStartDate: string | null;
  activityEndDate: string | null;
  picName: string | null;
  picJobtitle: string | null;
  picRole: string | null;
  picPhone: string | null;
  activityNotes: string | null;
  snapshotDate: string | null;
  importId: number | null;
  createdAt: string | null;
}

type EditCell = { rowId: number; field: string } | null;

interface FilterCol {
  field: string;
  label: string;
  width: string;
  categorical?: boolean;
  options?: string[];
  isTextarea?: boolean;
}

const COLUMNS: FilterCol[] = [
  { field: "nik", label: "NIK", width: "100px" },
  { field: "fullname", label: "Nama AM", width: "140px" },
  { field: "divisi", label: "Divisi", width: "70px", categorical: true, options: DIVISI_OPTIONS },
  { field: "segmen", label: "Segmen", width: "90px", categorical: true },
  { field: "regional", label: "Regional", width: "90px", categorical: true },
  { field: "witel", label: "Witel", width: "90px", categorical: true },
  { field: "nipnas", label: "NIPNAS", width: "100px" },
  { field: "caName", label: "CA Name", width: "140px" },
  { field: "activityType", label: "Tipe Aktivitas", width: "130px", categorical: true, options: ACTIVITY_TYPES },
  { field: "label", label: "Label", width: "140px", categorical: true },
  { field: "lopid", label: "LOP ID", width: "90px" },
  { field: "createdatActivity", label: "Tgl Aktivitas", width: "110px" },
  { field: "activityStartDate", label: "Start Date", width: "100px" },
  { field: "activityEndDate", label: "End Date", width: "100px" },
  { field: "picName", label: "PIC Name", width: "120px" },
  { field: "picJobtitle", label: "PIC Jobtitle", width: "120px" },
  { field: "picRole", label: "PIC Role", width: "110px", categorical: true },
  { field: "picPhone", label: "PIC Phone", width: "110px" },
  { field: "activityNotes", label: "Catatan", width: "180px", isTextarea: true },
  { field: "snapshotDate", label: "Snapshot Date", width: "100px" },
];

// ─── Column Filter Popup ──────────────────────────────────────────────────────
function ColumnFilterPopup({
  field,
  options,
  selected,
  onToggle,
  onClear,
  onSelectAll,
  anchorRect,
  onClose,
}: {
  field: string;
  options: string[];
  selected: Set<string>;
  onToggle: (val: string) => void;
  onClear: () => void;
  onSelectAll: () => void;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  // Close on outside click
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
    <div
      ref={ref}
      style={style}
      className="bg-card border border-border rounded-xl shadow-2xl w-64 overflow-hidden"
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <span className="text-xs font-semibold text-foreground">{COLUMNS.find(c => c.field === field)?.label}</span>
        <button onMouseDown={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Search */}
      <div className="px-2 py-1.5 border-b border-border/50">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari..."
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
          onMouseDown={e => e.stopPropagation()}
        />
      </div>
      {/* Actions */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-border/50">
        <button onMouseDown={e => { e.stopPropagation(); onSelectAll(); }} className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground">Select All</button>
        <button onMouseDown={e => { e.stopPropagation(); onClear(); }} className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground">Clear</button>
      </div>
      {/* Options */}
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground">Tidak ada hasil</div>
        )}
        {filtered.map(opt => (
          <label key={opt} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-secondary/30 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={selected.has(opt)}
              onChange={() => onToggle(opt)}
              className="w-3.5 h-3.5 rounded accent-primary"
            />
            <span className="truncate flex-1">{opt || <em className="text-muted-foreground">[Kosong]</em>}</span>
          </label>
        ))}
      </div>
      {/* Count */}
      <div className="px-3 py-1.5 border-t border-border/50 text-[10px] text-muted-foreground bg-secondary/10">
        {selected.size} dipilih dari {options.length} nilai
      </div>
    </div>,
    document.body
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ActivityDetailTable({ rows, importId }: { rows: ActivityRow[]; importId: number }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [activeFilter, setActiveFilter] = useState<{ field: string; rect: DOMRect } | null>(null);
  const [editCell, setEditCell] = useState<EditCell>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowCount, setRowCount] = useState(rows.length);
  const [localRows, setLocalRows] = useState(rows);

  // Sync when rows prop changes (e.g. re-fetch)
  useEffect(() => { setLocalRows(rows); setRowCount(rows.length); }, [rows]);

  // Build dropdown options per column from data
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

  // Filter by search + column filters
  const filtered = useMemo(() => {
    let result = localRows;
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
  }, [localRows, search, columnFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, columnFilters]);

  const handleSave = useCallback(async () => {
    if (!editCell) return;
    const { rowId, field } = editCell;
    setSaving(true);
    try {
      await apiFetch(`/api/import/${importId}/rows/${rowId}`, {
        method: "PATCH",
        body: JSON.stringify({ field, value: editValue }),
      });
      setLocalRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: editValue } : r));
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

  // ─── Render a cell ───────────────────────────────────────────────────────────
  function renderCell(row: ActivityRow, col: FilterCol) {
    const isEditing = editCell?.rowId === row.id && editCell?.field === col.field;
    const value: string = (row as any)[col.field] || "";

    if (isEditing) {
      if (col.categorical && (col.options || dropdownOptions[col.field] || []).length > 0) {
        const opts = col.options || dropdownOptions[col.field] || [];
        return (
          <select
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={() => { if (editValue !== originalValue) handleSave(); else setEditCell(null); }}
            className="w-full h-7 px-1 bg-white border-2 border-primary rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">— kosong —</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      }
      if (col.isTextarea) {
        return (
          <textarea
            autoFocus
            rows={2}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={() => { if (editValue !== originalValue) handleSave(); else setEditCell(null); }}
            className="w-full px-1 bg-white border-2 border-primary rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
        );
      }
      return (
        <input
          autoFocus
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={() => { if (editValue !== originalValue) handleSave(); else setEditCell(null); }}
          className="w-full h-7 px-1 bg-white border-2 border-primary rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      );
    }

    return (
      <span
        className="px-1 truncate block cursor-default"
        title={value}
      >
        {value || <span className="text-muted-foreground/40">—</span>}
      </span>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-xs text-muted-foreground">
          {filtered.length !== rowCount
            ? <span><strong className="text-foreground">{filtered.length}</strong> dari {rowCount} baris</span>
            : <span><strong className="text-foreground">{rowCount}</strong> baris</span>
          }
          {Object.keys(columnFilters).length > 0 && (
            <button
              onClick={() => setColumnFilters({})}
              className="ml-3 text-[10px] px-2 py-0.5 rounded border border-border hover:bg-secondary transition-colors text-muted-foreground"
            >
              Reset filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari semua kolom..."
              className="pl-8 pr-3 h-8 text-xs border border-border rounded-lg bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all w-56"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-secondary/50 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">
              <th className="px-3 py-2.5 w-12 text-center border-r border-border/40">#</th>
              {COLUMNS.map(col => {
                const hasFilter = (columnFilters[col.field]?.size ?? 0) > 0;
                const isActive = activeFilter?.field === col.field;
                return (
                  <th
                    key={col.field}
                    className="px-2 py-2.5 relative group"
                    style={{ minWidth: col.width, width: col.width }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate">{col.label}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget).getBoundingClientRect();
                          setActiveFilter(isActive ? null : { field: col.field, rect });
                        }}
                        className={cn(
                          "shrink-0 p-0.5 rounded transition-colors",
                          hasFilter ? "text-primary bg-primary/10" : "text-muted-foreground/40 hover:text-muted-foreground",
                        )}
                        title={`Filter ${col.label}`}
                      >
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
              <tr>
                <td colSpan={COLUMNS.length + 1} className="text-center py-12 text-muted-foreground">
                  {search || Object.keys(columnFilters).length > 0 ? "Tidak ada baris yang cocok dengan filter" : "Tidak ada data"}
                </td>
              </tr>
            )}
            {paged.map((row, idx) => {
              const absIdx = (page - 1) * PAGE_SIZE + idx + 1;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-secondary/10 transition-colors",
                    editCell?.rowId === row.id && "bg-primary/5"
                  )}
                >
                  <td className="px-3 py-1.5 text-center text-muted-foreground/50 font-mono text-[10px] border-r border-border/40">
                    {absIdx}
                  </td>
                  {COLUMNS.map(col => (
                    <td
                      key={col.field}
                      className="px-1 py-1.5 relative"
                      style={{ minWidth: col.width, maxWidth: col.width }}
                      onDoubleClick={() => handleCellDoubleClick(row.id, col.field, (row as any)[col.field] || "")}
                    >
                      {renderCell(row, col)}
                      {editCell?.rowId !== row.id && (
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="absolute right-1 top-1/2 -translate-y-1/2">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/30">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </div>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Halaman {page} dari {totalPages}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn("px-2.5 py-1 border rounded text-xs", p === page ? "bg-primary text-white border-primary" : "hover:bg-secondary transition-colors")}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active filter popup */}
      {activeFilter && (() => {
        const col = COLUMNS.find(c => c.field === activeFilter.field)!;
        const opts = col.options || dropdownOptions[activeFilter.field] || [];
        if (opts.length === 0) return null;
        return (
          <ColumnFilterPopup
            field={activeFilter.field}
            options={opts}
            selected={columnFilters[activeFilter.field] || new Set()}
            onToggle={(val) => handleFilterToggle(activeFilter.field, val)}
            onClear={() => handleFilterClear(activeFilter.field)}
            onSelectAll={() => handleFilterSelectAll(activeFilter.field)}
            anchorRect={activeFilter.rect}
            onClose={() => setActiveFilter(null)}
          />
        );
      })()}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-6 right-6 bg-card border border-border rounded-xl shadow-xl px-4 py-3 flex items-center gap-2 z-50">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs">Menyimpan...</span>
        </div>
      )}
    </div>
  );
}
