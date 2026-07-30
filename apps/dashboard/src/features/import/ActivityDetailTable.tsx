import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Loader2, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
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
  nipnas: string | null;
  caName: string | null;
  activityType: string | null;
  label: string | null;
  lopid: string | null;
  activityEndDate: string | null;
  activityNotes: string | null;
  snapshotDate: string | null;
  importId: number | null;
  createdAt: string | null;
}

type EditCell = { rowId: number; field: string } | null;
type SortDir = "asc" | "desc" | null;

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
  { field: "nipnas", label: "NIPNAS", width: "100px" },
  { field: "caName", label: "CA Name", width: "140px" },
  { field: "activityType", label: "Tipe Aktivitas", width: "130px", categorical: true, options: ACTIVITY_TYPES },
  { field: "label", label: "Label", width: "140px", categorical: true },
  { field: "lopid", label: "LOP ID", width: "90px" },
  { field: "activityEndDate", label: "Tgl Aktivitas", width: "110px" },
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
  onClose,
}: {
  field: string;
  options: string[];
  selected: Set<string>;
  onToggle: (val: string) => void;
  onClear: () => void;
  onSelectAll: () => void;
  onClose: () => void;
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

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl w-64 overflow-hidden z-50"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <span className="text-xs font-semibold text-foreground">{COLUMNS.find(c => c.field === field)?.label}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
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
      <div className="flex gap-1 px-2 py-1.5 border-b border-border/50">
        <button
          onMouseDown={e => { e.stopPropagation(); onSelectAll(); }}
          className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground"
        >
          Select All
        </button>
        <button
          onMouseDown={e => { e.stopPropagation(); onClear(); }}
          className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70 transition-colors text-muted-foreground"
        >
          Clear
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground">Tidak ada hasil</div>
        )}
        {filtered.map(opt => (
          <label
            key={opt}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-secondary/30 cursor-pointer text-xs"
            onMouseDown={e => e.stopPropagation()}
          >
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
      <div className="px-3 py-1.5 border-t border-border/50 text-[10px] text-muted-foreground bg-secondary/10">
        {selected.size} dipilih dari {options.length} nilai
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ActivityDetailTable({ rows, importId, search, onSearchChange }: { rows: ActivityRow[]; importId: number; search?: string; onSearchChange?: (v: string) => void }) {
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [activeFilterField, setActiveFilterField] = useState<string | null>(null);
  const [editCell, setEditCell] = useState<EditCell>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [localRows, setLocalRows] = useState(rows);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const currentSearch = search ?? "";

  useEffect(() => { setLocalRows(rows); }, [rows]);

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
    let result = localRows;
    const q = currentSearch.trim().toLowerCase();
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
  }, [localRows, currentSearch, columnFilters]);

  const sorted = useMemo(() => {
    if (!sortField || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortField] || "";
      const bv = (b as any)[sortField] || "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [columnFilters, sortField, sortDir]);

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

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : d === "desc" ? null : "asc");
      if (sortDir === "desc") setSortField(null);
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField, sortDir]);

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
      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-secondary/50 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide">
              <th className="px-3 py-2.5 w-12 text-center border-r border-border/40">#</th>
              {COLUMNS.map(col => {
                const hasFilter = (columnFilters[col.field]?.size ?? 0) > 0;
                const isFilterActive = activeFilterField === col.field;
                const opts = col.options || dropdownOptions[col.field] || [];
                const isSorted = sortField === col.field;
                const canSort = true;
                const canFilter = opts.length > 0;

                return (
                  <th
                    key={col.field}
                    className="px-2 py-2.5 relative group"
                    style={{ minWidth: col.width, width: col.width }}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => canSort && handleSort(col.field)}
                        className={cn(
                          "flex items-center gap-0.5 truncate transition-colors",
                          isSorted ? "text-foreground" : "hover:text-foreground text-muted-foreground"
                        )}
                        title={canSort ? `Sortir ${col.label}` : undefined}
                      >
                        <span>{col.label}</span>
                        {canSort && (
                          <span className="shrink-0">
                            {isSorted
                              ? sortDir === "asc"
                                ? <ChevronUp className="w-3 h-3" />
                                : sortDir === "desc"
                                  ? <ChevronDown className="w-3 h-3" />
                                  : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                              : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                            }
                          </span>
                        )}
                      </button>
                      {canFilter && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFilterField(isFilterActive ? null : col.field);
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
                          {isFilterActive && (
                            <ColumnFilterPopup
                              field={col.field}
                              options={opts}
                              selected={columnFilters[col.field] || new Set()}
                              onToggle={(val) => handleFilterToggle(col.field, val)}
                              onClear={() => handleFilterClear(col.field)}
                              onSelectAll={() => handleFilterSelectAll(col.field)}
                              onClose={() => setActiveFilterField(null)}
                            />
                          )}
                        </div>
                      )}
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
