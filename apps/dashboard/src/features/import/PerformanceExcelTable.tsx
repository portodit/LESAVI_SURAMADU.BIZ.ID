import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const PAGE_SIZE = 50;

export interface PerfExcelRow {
  nik: string | null;
  namaAm: string | null;
  levelAm: string | null;
  divisiAm: string | null;
  witelAm: string | null;
  nip: string | null;
  pelanggan: string | null;
  groupName: string | null;
  industri: string | null;
  lsegmen: string | null;
  ssegmen: string | null;
  witelCc: string | null;
  telda: string | null;
  regional: string | null;
  divisiCc: string | null;
  kawasan: string | null;
  proporsi: number | null;
  layanan: string | null;
  targetReguler: number | null;
  realReguler: number | null;
  targetSustain: number | null;
  realSustain: number | null;
  targetScaling: number | null;
  realScaling: number | null;
  targetNgtma: number | null;
  realNgtma: number | null;
  targetTotal: number | null;
  realTotal: number | null;
  revenueBase: number | null;
  revenueBillcom: number | null;
  a_rev: number | null;
  a_ngtma: number | null;
  a_scaling: number | null;
  a_sustain: number | null;
  achRate: number | null;
  statusWarna: string | null;
}

interface Column {
  key: keyof PerfExcelRow;
  label: string;
  width: string;
  align?: "left" | "center" | "right";
  format?: (v: any) => string;
  sortable?: boolean;
  sticky?: boolean;
}

const COLUMNS: Column[] = [
  { key: "nik", label: "NIK", width: "80px", align: "left", sortable: true },
  { key: "namaAm", label: "Nama AM", width: "150px", align: "left", sortable: true },
  { key: "levelAm", label: "Level AM", width: "80px", align: "center", sortable: true },
  { key: "divisiAm", label: "Divisi AM", width: "80px", align: "center", sortable: true },
  { key: "witelAm", label: "Witel AM", width: "110px", align: "left", sortable: true },
  { key: "nip", label: "NIP NAS", width: "90px", align: "left", sortable: true },
  { key: "pelanggan", label: "Nama Pelanggan", width: "180px", align: "left", sortable: true },
  { key: "groupName", label: "Group", width: "150px", align: "left", sortable: true },
  { key: "industri", label: "Industri", width: "140px", align: "left", sortable: true },
  { key: "lsegmen", label: "L. Segmen", width: "150px", align: "left", sortable: true },
  { key: "ssegmen", label: "S. Segmen", width: "120px", align: "left", sortable: true },
  { key: "witelCc", label: "Witel CC", width: "100px", align: "left", sortable: true },
  { key: "telda", label: "Telda", width: "110px", align: "left", sortable: true },
  { key: "regional", label: "Regional", width: "90px", align: "left", sortable: true },
  { key: "divisiCc", label: "Divisi CC", width: "80px", align: "center", sortable: true },
  { key: "kawasan", label: "Kawasan", width: "110px", align: "left", sortable: true },
  { key: "proporsi", label: "Proporsi (%)", width: "90px", align: "right", sortable: true, format: (v) => v != null ? `${Number(v).toFixed(2)}%` : "–" },
  { key: "layanan", label: "Layanan", width: "90px", align: "left", sortable: true },
  { key: "targetReguler", label: "Target Reguler", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "realReguler", label: "Real Reguler", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "targetSustain", label: "Target Sustain", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "realSustain", label: "Real Sustain", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "targetScaling", label: "Target Scaling", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "realScaling", label: "Real Scaling", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "targetNgtma", label: "Target NGTMA", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "realNgtma", label: "Real NGTMA", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "targetTotal", label: "Target Total", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "realTotal", label: "Real Total", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "revenueBase", label: "Revenue Base", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "revenueBillcom", label: "Revenue Billcom", width: "130px", align: "right", sortable: true, format: (v) => fmtRupiah(v) },
  { key: "a_rev", label: "a. Rev (%)", width: "80px", align: "right", sortable: true, format: (v) => fmtPct(v) },
  { key: "a_ngtma", label: "a. NGTMA (%)", width: "90px", align: "right", sortable: true, format: (v) => fmtPct(v) },
  { key: "a_scaling", label: "a. Scaling (%)", width: "90px", align: "right", sortable: true, format: (v) => fmtPct(v) },
  { key: "a_sustain", label: "a. Sustain (%)", width: "90px", align: "right", sortable: true, format: (v) => fmtPct(v) },
  { key: "achRate", label: "Ach (%)", width: "80px", align: "right", sortable: true, format: (v) => fmtPct(v) },
  { key: "statusWarna", label: "Status", width: "70px", align: "center", sortable: true },
];

function fmtRupiah(v: any): string {
  if (v == null || v === "" || isNaN(Number(v))) return "–";
  return Number(v).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v: any): string {
  if (v == null || v === "" || isNaN(Number(v))) return "–";
  return `${(Number(v) * 100).toFixed(2)}%`;
}

function fmtCell(col: Column, val: any): React.ReactNode {
  if (val == null || val === "" || val === undefined) return "–";
  if (col.format) return col.format(val);
  return String(val);
}

export default function PerformanceExcelTable({ rows }: { rows: PerfExcelRow[] }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof PerfExcelRow>("nik");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: keyof PerfExcelRow) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      COLUMNS.some(col => {
        const v = (r as any)[col.key];
        return typeof v === "string" && v.toLowerCase().includes(q);
      })
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return sortDir === "asc" ? 1 : -1;
      if (bv == null) return sortDir === "asc" ? -1 : 1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-xs text-muted-foreground">
          {filtered.length !== rows.length
            ? <span><strong className="text-foreground">{filtered.length.toLocaleString("id-ID")}</strong> dari <strong className="text-foreground">{rows.length.toLocaleString("id-ID")}</strong> baris</span>
            : <span><strong className="text-foreground">{rows.length.toLocaleString("id-ID")}</strong> baris</span>
          }
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari semua kolom..."
            className="pl-8 pr-3 h-8 text-xs border border-border rounded-lg bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all w-56" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-secondary/60 text-muted-foreground font-semibold text-[10px] uppercase tracking-wide border-b border-border">
              {COLUMNS.map(col => (
                <th key={col.key}
                  className={cn("px-2 py-2.5 whitespace-nowrap", col.sticky && "sticky left-0 bg-secondary/60 z-10")}
                  style={{ minWidth: col.width, width: col.width }}>
                  {col.sortable ? (
                    <button onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <span>{col.label}</span>
                      {sortKey === col.key ? (
                        sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </button>
                  ) : (
                    <span>{col.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paged.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-12 text-muted-foreground">
                  {search ? "Tidak ada baris yang cocok" : "Tidak ada data"}
                </td>
              </tr>
            )}
            {paged.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/15 transition-colors">
                {COLUMNS.map(col => (
                  <td key={col.key}
                    className={cn("px-2 py-1.5 whitespace-nowrap",
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "",
                      col.sticky && "sticky left-0 bg-white z-10",
                      col.key === "achRate" && r.achRate != null && Number(r.achRate) >= 1 ? "text-green-600 font-bold" :
                        col.key === "achRate" && r.achRate != null && Number(r.achRate) >= 0.8 ? "text-orange-500 font-bold" :
                          col.key === "achRate" && r.achRate != null && Number(r.achRate) > 0 ? "text-red-500 font-bold" : "",
                      col.align === "right" ? "tabular-nums" : "",
                    )}>
                    {col.key === "statusWarna" ? (
                      <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                        r.statusWarna === "hijau" ? "text-green-700 bg-green-50 border-green-200" :
                          r.statusWarna === "oranye" ? "text-orange-700 bg-orange-50 border-orange-200" :
                            "text-red-700 bg-red-50 border-red-200"
                      )}>{r.statusWarna?.toUpperCase()}</span>
                    ) : (
                      <span className="truncate block">{fmtCell(col, (r as any)[col.key])}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Halaman {page} dari {totalPages.toLocaleString("id-ID")} ({rows.length.toLocaleString("id-ID")} baris)</span>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-secondary transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
            return p <= totalPages ? (
              <button key={p} onClick={() => setPage(p)}
                className={cn("px-2.5 py-1 border rounded text-xs", p === page ? "bg-primary text-white border-primary" : "hover:bg-secondary transition-colors")}>
                {p.toLocaleString("id-ID")}
              </button>
            ) : null;
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-secondary transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
