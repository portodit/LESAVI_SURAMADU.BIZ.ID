import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useListImportHistory } from "@workspace/api-client-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowLeft, Loader2, Database } from "lucide-react";
import ActivityDetailTable from "./ActivityDetailTable";
import PerformanceDetailTable from "./PerformanceDetailTable";
import FunnelDetailTable from "./FunnelDetailTable";

async function apiFetch(path: string, opts?: RequestInit) {
  const base = (import.meta.env.BASE_URL || "").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw d; }
  return res.json();
}

function formatSnapshotTitle(createdAt: string, type: string, snapshotDate?: string | null): string {
  const dateStr = snapshotDate || createdAt;
  const date = format(new Date(dateStr), "d MMMM yyyy", { locale: id });
  const upper = date.toUpperCase();
  if (type === "performance") return `SNAPSHOT PERFORMANSI AM WITEL SURAMADU (${upper})`;
  if (type === "funnel") return `SNAPSHOT SALES FUNNEL WITEL SURAMADU (${upper})`;
  return `SNAPSHOT SALES ACTIVITY WITEL SURAMADU (${upper})`;
}

function formatPeriod(period: string) {
  const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [y, m] = period.split("-");
  return `${MONTHS[parseInt(m, 10) - 1] || m} ${y}`;
}

// ─── Main Detail Page ──────────────────────────────────────────────────────────
export default function ImportDetail({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const importId = parseInt(params.id, 10);
  const { data: history } = useListImportHistory();

  const [dataRows, setDataRows] = useState<any[] | null>(null);
  const [dataType, setDataType] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const imp = (history as any[] | undefined)?.find((h: any) => h.id === importId);

  useEffect(() => {
    if (!importId) return;
    setLoading(true);
    setError(null);
    apiFetch(`/api/import/${importId}/data`)
      .then((d: any) => {
        setDataRows(d.rows || []);
        setDataType(d.type || "");
      })
      .catch((e: any) => setError(e?.message || "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [importId]);

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={() => navigate("/import")}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Import Data
      </button>

      {/* Snapshot header card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Versi Snapshot</p>
            {imp ? (
              <>
                <h1 className="text-base font-display font-bold text-foreground leading-snug">
                  {formatSnapshotTitle(imp.createdAt, imp.type, imp.snapshotDate)}
                </h1>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Import ID: <strong className="text-foreground">#{imp.id}</strong></span>
                  <span>Tipe: <strong className="text-foreground">{imp.type === "performance" ? "Performa AM" : imp.type === "funnel" ? "Sales Funnel" : "Sales Activity"}</strong></span>
                  <span>Periode: <strong className="text-foreground">{formatPeriod(imp.period)}</strong></span>
                  <span>Total baris: <strong className="text-foreground">{imp.rowsImported?.toLocaleString("id-ID")} baris</strong></span>
                  <span>Diimport: <strong className="text-foreground">{format(new Date(imp.createdAt), "dd MMMM yyyy, HH:mm:ss", { locale: id })} WIB</strong></span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Memuat metadata snapshot...</p>
            )}
          </div>
        </div>
      </div>

      {/* Data table card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-sm font-display font-bold text-foreground">
            Data Hasil Import
            {dataRows !== null && <span className="ml-2 text-xs font-normal text-muted-foreground">({dataRows.length} baris tersimpan)</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Memuat data...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600 text-sm">{error}</div>
        ) : !dataRows?.length ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Tidak ada data untuk import ini</div>
        ) : dataType === "performance" ? (
          <PerformanceDetailTable rows={dataRows} />
        ) : dataType === "funnel" ? (
          <FunnelDetailTable rows={dataRows} />
        ) : (
          <ActivityDetailTable rows={dataRows} importId={importId} />
        )}
      </div>
    </div>
  );
}
