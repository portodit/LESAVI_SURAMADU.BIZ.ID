import React, { useState, useMemo, useRef, useEffect, createPortal } from "react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import prognosaDataRaw from "./prognosa-data.json";

type Row = {
  PERIODE: number; NIK: number; NAMA_AM: string; LEVEL_AM: string; POSITION: string;
  WITEL_AM: string; DIVISI_AM: string; NIP_NAS_GROUP: string; NIP_NAS: string;
  STANDARD_NAME: string; GROUP: string; INDUSTRI: string; LSEGMEN: string; SSEGMEN: string;
  WITEL_CC: string; TELDA: string; REGIONAL: string; DIVISI_CC: string; KAWASAN: string;
  PROPORSI: number; LAYANAN: number; TEMP: number;
  TARGET_REVENUE: number; TARGET_SUSTAIN: number; TARGET_SCALING: number; TARGET_NGTMA: number;
  REAL_REVENUE: number; "F3-F4": number; F5: number; REAL_NGTMA: number;
  REVENUE_BASE: number; REVENUE_BILLCOM: number;
};
const data = prognosaDataRaw as Row[];

type ComputedRow = {
  nik: string; namaAm: string; divisiCc: string;
  target: number; real: number; base: number; qlop: number; f5: number;
  before: number; exc: number; inc: number;
  achBefore: number; achExc: number; achInc: number;
};
export const prognosaDataDefault = data as Row[];
const MONTHS_LABEL = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
export { MONTHS_LABEL };

function fmtRupiahFS(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  const absV = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (absV >= 1e12) return `${sign}Rp${(absV / 1e12).toFixed(2)}T`;
  if (absV >= 1e9) return `${sign}Rp${(absV / 1e9).toFixed(2)}M`;
  if (absV >= 1e6) return `${sign}Rp${(absV / 1e6).toFixed(1)}M`;
  if (absV >= 1e3) return `${sign}Rp${(absV / 1e3).toFixed(1)}K`;
  return `${sign}Rp${Math.round(absV)}`;
}

function fmtPct(v: number): string {
  return (v * 100).toFixed(1).replace(".", ",") + "%";
}

// ─── Reusable Filter Dropdown (matches reference styling) ─────────────────────
function FilterDropdown({ label, value, onChange, options, disabled, className }: {
  label?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = () => {
    if (!disabled) {
      if (triggerRef.current) {
        const r = triggerRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, left: r.left });
      }
      setOpen(v => !v);
    }
  };
  const current = options.find(o => o.value === value);
  return (
    <div className={cn("flex flex-col gap-1", className)} ref={triggerRef}>
      {label && <label className="text-xs font-display font-bold text-foreground uppercase tracking-wide">{label}</label>}
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={cn(
          "h-9 px-3 bg-secondary/50 border border-border rounded-lg text-sm flex items-center gap-1.5 w-full disabled:opacity-40 transition-colors",
          open && "border-primary/50 ring-2 ring-primary/20"
        )}
      >
        <span className="flex-1 text-left truncate font-medium text-foreground">{current?.label ?? value}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-popover border border-border rounded-xl shadow-xl min-w-[140px] max-h-64 overflow-y-auto py-1"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center gap-2",
                opt.value === value ? "font-semibold text-primary bg-primary/5" : "text-foreground"
              )}
            >
              {opt.value === value && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
              {opt.value !== value && <span className="w-1.5 shrink-0" />}
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Checkbox Filter Dropdown ─────────────────────────────────────────────────
function CheckboxFilterDropdown({ label, options, selected, onChange, placeholder, summaryLabel, className }: {
  label: string; options: string[]; selected: Set<string>; onChange: (n: Set<string>) => void;
  placeholder?: string; summaryLabel?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggleOpen = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(v => !v);
  };
  const toggleItem = (item: string) => {
    const n = new Set(selected);
    if (n.has(item)) n.delete(item);
    else n.add(item);
    onChange(n);
  };
  const displayText = selected.size === 0
    ? (placeholder ?? "Semua")
    : selected.size === 1 ? [...selected][0]
    : `${selected.size} ${summaryLabel ?? ""} dipilih`;
  return (
    <div className={cn("flex flex-col gap-1", className)} ref={triggerRef}>
      <label className="text-xs font-display font-bold text-foreground uppercase tracking-wide">{label}</label>
      <button
        type="button"
        onClick={toggleOpen}
        disabled={options.length === 0}
        className={cn(
          "h-9 px-3 bg-secondary/50 border border-border rounded-lg text-sm flex items-center gap-1.5 w-full disabled:opacity-40 transition-colors",
          open && "border-primary/50 ring-2 ring-primary/20"
        )}
      >
        <span className="flex-1 text-left truncate font-medium text-foreground">{displayText}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-popover border border-border rounded-xl shadow-xl min-w-[200px] max-w-[260px] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
            <div className="flex gap-1.5">
              <button onClick={() => onChange(new Set(options))} className="text-[11px] text-primary font-semibold hover:underline">Semua</button>
              <span className="text-muted-foreground text-[11px]">·</span>
              <button onClick={() => onChange(new Set())} className="text-[11px] text-muted-foreground font-semibold hover:underline">Kosongkan</button>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => toggleItem(opt)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-secondary flex items-center gap-2 transition-colors",
                  selected.has(opt) ? "font-semibold text-primary bg-primary/5" : "text-foreground"
                )}
              >
                <span className={cn(
                  "w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center",
                  selected.has(opt) ? "bg-primary border-primary" : "border-border"
                )}>
                  {selected.has(opt) && <span className="text-white text-[8px] font-black">✓</span>}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ArcGauge({ value, color = "#3b82f6" }: { value: number; color?: string }) {
  const cx = 80, cy = 75, r = 54;
  const startAngle = -210, endAngle = 30, totalDeg = endAngle - startAngle;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcPath = (start: number, end: number, radius: number) => {
    const s = toRad(start), e = toRad(end);
    const x1 = cx + radius * Math.cos(s), y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e), y2 = cy + radius * Math.sin(e);
    const large = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };
  const fillDeg = Math.min(value, 1.3) / 1.3 * totalDeg;

  return (
    <svg width="160" height="108" viewBox="0 0 160 115">
      <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round"/>
      {value > 0 && <path d={arcPath(startAngle, startAngle + fillDeg, r)} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"/>}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="800"
        fill={color} fontFamily="ui-monospace,monospace">{fmtPct(value)}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#6b7280" fontWeight="600">CAPAIAN</text>
    </svg>
  );
}

export type ScenarioKey = "all" | "before" | "exc" | "inc";
export const SCENARIOS: { id: ScenarioKey; label: string; shortLabel: string }[] = [
  { id: "all", label: "Semua", shortLabel: "SEMUA" },
  { id: "before", label: "Before LOP", shortLabel: "BEFORE LOP" },
  { id: "exc", label: "Exclude F5", shortLabel: "EXCLUDE F5" },
  { id: "inc", label: "Include F5", shortLabel: "INCLUDE F5" },
];

export type TipeRankKey = "Ach CM" | "Ach YTD";
export const TIPE_RANK_OPTIONS: { value: TipeRankKey; label: string }[] = [
  { value: "Ach CM", label: "Ach CM" },
  { value: "Ach YTD", label: "Ach YTD" },
];

export type TipeRevenueKey = "Reguler" | "Sustain" | "Scaling" | "NGTMA";
export const TIPE_REVENUE_OPTIONS: { value: TipeRevenueKey; label: string }[] = [
  { value: "Reguler", label: "Reguler" },
  { value: "Sustain", label: "Sustain" },
  { value: "Scaling", label: "Scaling" },
  { value: "NGTMA", label: "NGTMA" },
];

type OverallData = {
  target: number; real: number; base: number;
  qlop: number; f5: number;
  before: number; exc: number; inc: number;
};

export default function PrognosaSlide({
  visible = true,
  scenario,
  setScenario,
  selectedPeriodes,
  setSelectedPeriodes,
  selectedDivisi,
  setSelectedDivisi,
  selectedAmNames,
  setSelectedAmNames,
  tipeRank,
  setTipeRank,
  tipeRevenue,
  setTipeRevenue,
}: {
  visible?: boolean;
  scenario?: ScenarioKey;
  setScenario?: (s: ScenarioKey) => void;
  selectedPeriodes?: Set<string>;
  setSelectedPeriodes?: (s: Set<string>) => void;
  selectedDivisi?: Set<string>;
  setSelectedDivisi?: (s: Set<string>) => void;
  selectedAmNames?: Set<string>;
  setSelectedAmNames?: (s: Set<string>) => void;
  tipeRank?: TipeRankKey;
  setTipeRank?: (v: TipeRankKey) => void;
  tipeRevenue?: TipeRevenueKey;
  setTipeRevenue?: (v: TipeRevenueKey) => void;
}) {
  const _tipeRank = tipeRank ?? "Ach CM";
  const _setTipeRank = setTipeRank ?? (() => {});
  const _tipeRevenue = tipeRevenue ?? "Reguler";
  const _setTipeRevenue = setTipeRevenue ?? (() => {});
  const [expandedNik, setExpandedNik] = useState<string | null>(null);

  const _scenario = scenario ?? "all";
  const _setScenario = setScenario ?? (() => {});
  const _selectedPeriodes = selectedPeriodes ?? new Set<string>();
  const _setSelectedPeriodes = setSelectedPeriodes ?? (() => {});
  const _selectedDivisi = selectedDivisi ?? new Set<string>();
  const _setSelectedDivisi = setSelectedDivisi ?? (() => {});
  const _selectedAmNames = selectedAmNames ?? new Set<string>();
  const _setSelectedAmNames = setSelectedAmNames ?? (() => {});

  const allPeriodes = useMemo(() => {
    const p = new Set<number>();
    for (const r of data) { p.add(r.PERIODE); }
    return [...p].sort().map(String);
  }, []);

  const computed = useMemo(() => {
    const filtered = data
      .filter(r => r.WITEL_AM === "SURAMADU")
      .filter(r => _selectedDivisi.size === 0 || (_selectedDivisi.has(r.DIVISI_CC) || _selectedDivisi.has(r.DIVISI_AM)))
      .filter(r => _selectedAmNames.size === 0 || _selectedAmNames.has(r.NAMA_AM));

    // Group by AM
    const byAm = new Map<string, ComputedRow>();
    for (const r of filtered) {
      const existing = byAm.get(r.NAMA_AM);
      if (existing) {
        existing.target += r.TARGET_REVENUE;
        existing.real += r.REAL_REVENUE;
        existing.base += r["F3-F4"];
        existing.qlop += r.REVENUE_BASE;
        existing.f5 += r.F5;
      } else {
        byAm.set(r.NAMA_AM, {
          nik: String(r.NIK),
          namaAm: r.NAMA_AM,
          divisiCc: r.DIVISI_CC,
          target: r.TARGET_REVENUE,
          real: r.REAL_REVENUE,
          base: r["F3-F4"],
          qlop: r.REVENUE_BASE,
          f5: r.F5,
          before: 0, exc: 0, inc: 0,
          achBefore: 0, achExc: 0, achInc: 0,
        });
      }
    }
    for (const r of byAm.values()) {
      r.before = r.real + r.base;
      r.exc = r.before + r.qlop;
      r.inc = r.exc + r.f5;
      r.achBefore = r.target > 0 ? r.before / r.target : 0;
      r.achExc = r.target > 0 ? r.exc / r.target : 0;
      r.achInc = r.target > 0 ? r.inc / r.target : 0;
    }
    const rows = [...byAm.values()].sort((a, b) => b.achBefore - a.achBefore);

    const t = rows.reduce((a, r) => ({
      target: a.target + r.target, real: a.real + r.real, base: a.base + r.base,
      qlop: a.qlop + r.qlop, f5: a.f5 + r.f5,
    }), { target: 0, real: 0, base: 0, qlop: 0, f5: 0 });
    const before = t.real + t.base;
    const exc = before + t.qlop;
    const inc = exc + t.f5;

    // Monthly aggregates for line chart
    const monthsMap = new Map<number, { target: number; real: number; base: number }>();
    for (const r of filtered) {
      const p = r.PERIODE;
      const cur = monthsMap.get(p) ?? { target: 0, real: 0, base: 0 };
      cur.target += r.TARGET_REVENUE;
      cur.real += r.REAL_REVENUE;
      cur.base += r["F3-F4"];
      monthsMap.set(p, cur);
    }
    const months = [...monthsMap.entries()].sort(([a], [b]) => a - b)
      .map(([p, v]) => ({ periode: p, target: v.target, real: v.real, base: v.base }));

    return {
      rows,
      overall: { ...t, before, exc, inc },
      months,
      topBefore: rows[0],
      topExc: [...rows].sort((a, b) => b.achExc - a.achExc)[0],
      topInc: [...rows].sort((a, b) => b.achInc - a.achInc)[0],
    };
  }, [_selectedDivisi, _selectedAmNames]);

  const o = computed.overall as OverallData;
  const achMap: Record<Exclude<ScenarioKey, "all">, number> = {
    before: o.target > 0 ? o.before / o.target : 0,
    exc: o.target > 0 ? o.exc / o.target : 0,
    inc: o.target > 0 ? o.inc / o.target : 0,
  };

  const totalPipeline = o.real + o.base + o.qlop + o.f5;
  const totalUnrealized = o.qlop + o.f5;

  // Chart 1: Komposisi Seluruh Outlook — red/yellow/blue
  const pipeData = [
    { name: "Real YTD", value: o.real, color: "#ef4444" },
    { name: "Base+BC", value: o.base, color: "#fbbf24" },
    { name: "Qualified LOP", value: o.qlop, color: "#3b82f6" },
    { name: "LOP F5", value: o.f5, color: "#1d4ed8" },
  ];

  // Chart 2: Dominasi Pipeline — red/yellow/blue (exclude real & base)
  const domData = [
    { name: "Qualified LOP", value: o.qlop, color: "#fbbf24" },
    { name: "LOP F5", value: o.f5, color: "#3b82f6" },
  ];

  const AM_ACTIVE = [
    "Handika", "Ana", "Ni Made Novi", "Nyari Kusuma", "Vivin",
    "Wildan", "Safirina", "Nadya Zahro", "Havea", "Ervina", "Caesar",
  ];

  const barData = computed.rows
    .filter(r => AM_ACTIVE.some(a => r.namaAm.toLowerCase().startsWith(a.toLowerCase())))
    .map(r => ({
    name: r.namaAm.split(' ').map((part, i) => i === 0 ? part : part[0].toUpperCase() + '.').join(' '),
    fullName: r.namaAm,
    before: r.before,
    qlop: r.qlop,
    f5: r.f5,
    target: r.target,
    nik: r.nik,
    beforeAch: r.target > 0 ? r.before / r.target : 0,
    exc: r.exc,
    inc: r.inc,
  }));

  const lineData = computed.months.map((m) => ({
    bulan: MONTHS_LABEL[(m.periode % 100) - 1] ?? String(m.periode),
    target: m.target,
    real: m.real,
    base: m.base,
  }));

  const scenarioColor = (ach: number) => ach >= 1 ? "#10b981" : ach >= 0.8 ? "#f59e0b" : "#ef4444";

  return (
    <>
      {visible && (
      <div className="p-4 space-y-4">

        {/* ── KPI Cards ── */}
        {_scenario === "all" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm min-w-0">
                <h3 className="text-base font-display font-bold text-foreground mb-2 flex items-center gap-2">
                  Capaian Outlook Dasar
                  <span className="text-xs font-black px-2.5 py-0.5 rounded bg-blue-100 text-blue-700">BEFORE LOP</span>
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="shrink-0 mx-auto">
                    <ArcGauge value={achMap.before} color={scenarioColor(achMap.before)} />
                  </div>
                  <div className="flex-1 w-full min-w-0 overflow-hidden space-y-1.5" style={{ fontSize: "clamp(9px, 1.05vw, 12px)" }}>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Real Pipeline</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.real)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Base Revenue</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.base)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Target Revenue</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.target)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-border flex justify-between items-baseline gap-1">
                      <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">Kekurangan</span>
                      <span className={"font-bold tabular-nums truncate text-right ml-1 text-red-600 dark:text-red-400"}>
                        {o.target - o.before >= 0 ? "-" : "+"}{fmtRupiahFS(Math.abs(o.target - o.before))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm min-w-0">
                <h3 className="text-base font-display font-bold text-foreground mb-2 flex items-center gap-2">
                  Capaian Outlook Pipeline
                  <span className="text-xs font-black px-2.5 py-0.5 rounded bg-blue-100 text-blue-700">EXCLUDE F5</span>
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="shrink-0 mx-auto">
                    <ArcGauge value={achMap.exc} color={scenarioColor(achMap.exc)} />
                  </div>
                  <div className="flex-1 w-full min-w-0 overflow-hidden space-y-1.5" style={{ fontSize: "clamp(9px, 1.05vw, 12px)" }}>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Outlook Before LOP</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.before)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Qualified LOP</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.qlop)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Target Revenue</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.target)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-border flex justify-between items-baseline gap-1">
                      <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">Kekurangan</span>
                      <span className={"font-bold tabular-nums truncate text-right ml-1 text-red-600 dark:text-red-400"}>
                        {o.target - o.exc >= 0 ? "-" : "+"}{fmtRupiahFS(Math.abs(o.target - o.exc))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm min-w-0">
                <h3 className="text-base font-display font-bold text-foreground mb-2 flex items-center gap-2">
                  Capaian Outlook Menyeluruh
                  <span className="text-xs font-black px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-700">INCLUDE F5</span>
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="shrink-0 mx-auto">
                    <ArcGauge value={achMap.inc} color={scenarioColor(achMap.inc)} />
                  </div>
                  <div className="flex-1 w-full min-w-0 overflow-hidden space-y-1.5" style={{ fontSize: "clamp(9px, 1.05vw, 12px)" }}>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Outlook Exclude F5</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.exc)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">LOP F5</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.f5)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Target Revenue</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.target)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-border flex justify-between items-baseline gap-1">
                      <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">Kekurangan</span>
                      <span className={"font-bold tabular-nums truncate text-right ml-1 text-red-600 dark:text-red-400"}>
                        {o.target - o.inc >= 0 ? "-" : "+"}{fmtRupiahFS(Math.abs(o.target - o.inc))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {(() => {
              const scenarioKey = _scenario as Exclude<ScenarioKey, "all">;
              const topAm = scenarioKey === "before" ? computed.topBefore : scenarioKey === "exc" ? computed.topExc : computed.topInc;
              const scenarioLabel = scenarioKey === "before" ? "Before LOP" : scenarioKey === "exc" ? "Exclude F5" : "Include F5";
              if (!topAm) return null;
              const topAch = scenarioKey === "before" ? topAm.achBefore : scenarioKey === "exc" ? topAm.achExc : topAm.achInc;
              const topOutlook = scenarioKey === "before" ? topAm.real : scenarioKey === "exc" ? topAm.before : topAm.exc;
              return (
            <>
            {/* 2-column side-by-side: Capaian + TOP AM */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Capaian KPI — left column */}
            {scenarioKey === "before" && (
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm min-w-0">
                <h3 className="text-base font-display font-bold text-foreground mb-2 flex items-center gap-2">
                  Capaian Outlook Dasar
                  <span className="text-xs font-black px-2.5 py-0.5 rounded bg-blue-100 text-blue-700">BEFORE LOP</span>
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="shrink-0 mx-auto">
                    <ArcGauge value={achMap.before} color={scenarioColor(achMap.before)} />
                  </div>
                  <div className="flex-1 w-full min-w-0 overflow-hidden space-y-1.5" style={{ fontSize: "clamp(9px, 1.05vw, 12px)" }}>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Real Pipeline</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.real)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Base Revenue</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.base)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Target Revenue</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.target)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-border flex justify-between items-baseline gap-1">
                      <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">Kekurangan</span>
                      <span className="font-bold tabular-nums truncate text-right ml-1 text-red-600 dark:text-red-400">
                        {o.target - o.before >= 0 ? "-" : "+"}{fmtRupiahFS(Math.abs(o.target - o.before))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {scenarioKey === "exc" && (
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm min-w-0">
                <h3 className="text-base font-display font-bold text-foreground mb-2 flex items-center gap-2">
                  Capaian Outlook Pipeline
                  <span className="text-xs font-black px-2.5 py-0.5 rounded bg-blue-100 text-blue-700">EXCLUDE F5</span>
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="shrink-0 mx-auto">
                    <ArcGauge value={achMap.exc} color={scenarioColor(achMap.exc)} />
                  </div>
                  <div className="flex-1 w-full min-w-0 overflow-hidden space-y-1.5" style={{ fontSize: "clamp(9px, 1.05vw, 12px)" }}>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Outlook Before LOP</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.before)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Qualified LOP</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.qlop)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Target Revenue</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.target)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-border flex justify-between items-baseline gap-1">
                      <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">Kekurangan</span>
                      <span className="font-bold tabular-nums truncate text-right ml-1 text-red-600 dark:text-red-400">
                        {o.target - o.exc >= 0 ? "-" : "+"}{fmtRupiahFS(Math.abs(o.target - o.exc))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {scenarioKey === "inc" && (
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm min-w-0">
                <h3 className="text-base font-display font-bold text-foreground mb-2 flex items-center gap-2">
                  Capaian Outlook Menyeluruh
                  <span className="text-xs font-black px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-700">INCLUDE F5</span>
                </h3>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="shrink-0 mx-auto">
                    <ArcGauge value={achMap.inc} color={scenarioColor(achMap.inc)} />
                  </div>
                  <div className="flex-1 w-full min-w-0 overflow-hidden space-y-1.5" style={{ fontSize: "clamp(9px, 1.05vw, 12px)" }}>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Outlook Exclude F5</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.exc)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">LOP F5</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.f5)}</span>
                    </div>
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-muted-foreground whitespace-nowrap shrink-0">Target Revenue</span>
                      <span className="font-bold text-foreground tabular-nums truncate text-right ml-1">{fmtRupiahFS(o.target)}</span>
                    </div>
                    <div className="pt-1.5 border-t border-border flex justify-between items-baseline gap-1">
                      <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">Kekurangan</span>
                      <span className="font-bold tabular-nums truncate text-right ml-1 text-red-600 dark:text-red-400">
                        {o.target - o.inc >= 0 ? "-" : "+"}{fmtRupiahFS(Math.abs(o.target - o.inc))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* TOP AM — right column */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 min-w-0 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold uppercase tracking-wider leading-tight text-amber-700 dark:text-amber-400">TOP AM by Revenue ({scenarioLabel})</p>
                </div>
                <span className="text-3xl leading-none shrink-0 mt-0.5" style={{ color: "#d97706" }}>★</span>
              </div>
              <p className="font-bold text-[15px] text-amber-900 dark:text-amber-100 uppercase tracking-wide truncate leading-tight mb-3" title={topAm.namaAm}>{topAm.namaAm}</p>
              {/* Percentage left, 2 mini stats right — same row */}
              <div className="flex items-start gap-3 mb-3">
                <p className="text-5xl font-bold tabular-nums leading-none shrink-0" style={{ color: "#16a34a" }}>{fmtPct(topAch)}</p>
                <div className="flex-1 min-w-0">
                  <div className="rounded-xl px-3 py-2 border border-amber-200 dark:border-amber-700 mb-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 text-amber-600 dark:text-amber-400">
                      {scenarioKey === "before" ? "Real" : scenarioKey === "exc" ? "Outlook Before LOP" : "LOP F5"}
                    </p>
                    <p className="text-[13px] font-bold text-amber-900 dark:text-amber-100 truncate">{fmtRupiahFS(topOutlook)}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2 border border-amber-200 dark:border-amber-700">
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 text-amber-600 dark:text-amber-400">Target</p>
                    <p className="text-[13px] font-bold text-amber-900 dark:text-amber-100 truncate">{fmtRupiahFS(topAm.target)}</p>
                  </div>
                </div>
              </div>
            </div>
            </div>
            </>
              );
            })()}
          </div>
        )}

        {/* ── Komposisi + Dominasi + Outlook vs Target — 1 ROW ── */}
        <div className="flex gap-4">

          {/* Komposisi Seluruh Outlook */}
          <div className="w-52 shrink-0 bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-display font-bold text-foreground tracking-tight">Komposisi Seluruh Outlook</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Seberapa besar outlook sudah di tangan vs masih proyeksi</p>
            </div>
            <div className="flex flex-col items-center gap-2 px-4 pb-4">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pipeData} cx="50%" cy="50%" innerRadius={36} outerRadius={60} paddingAngle={2} dataKey="value">
                    {pipeData.map((entry, index) => (
                      <Cell key={"cell1-" + index} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [fmtRupiahFS(value)]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontWeight: "700", fontSize: "11px", color: "hsl(var(--foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-1.5">
                {pipeData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-semibold text-foreground truncate flex-1">{item.name}</span>
                    <span className="text-xs font-bold text-foreground tabular-nums shrink-0">
                      {totalPipeline > 0 ? (item.value / totalPipeline * 100).toFixed(0) : "0"}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dominasi Pipeline */}
          <div className="w-52 shrink-0 bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-sm font-display font-bold text-foreground tracking-tight">Dominasi Pipeline</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Dari yang belum terealisasi (exclude real & base): masih nego vs sudah menang</p>
            </div>
            <div className="flex flex-col items-center gap-2 px-4 pb-4">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={domData} cx="50%" cy="50%" innerRadius={36} outerRadius={60} paddingAngle={2} dataKey="value">
                    {domData.map((entry, index) => (
                      <Cell key={"cell2-" + index} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [fmtRupiahFS(value)]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontWeight: "700", fontSize: "11px", color: "hsl(var(--foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-1.5">
                {domData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-semibold text-foreground truncate flex-1">{item.name}</span>
                    <span className="text-xs font-bold text-foreground tabular-nums shrink-0">
                      {totalUnrealized > 0 ? (item.value / totalUnrealized * 100).toFixed(0) : "0"}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Komposisi Outlook terhadap Target (per AM) — HORIZONTAL STACKED BAR */}
          <div className="flex-1 min-w-0 bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-display font-bold text-foreground tracking-tight">Komposisi Outlook terhadap Target (per AM)</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">1 Batang = 1 AM · Real+Base · Qualified LOP · LOP F5</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-red-500" />
                    <span className="text-xs font-bold text-foreground">Real+Base</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-amber-500" />
                    <span className="text-xs font-bold text-foreground">QLOP</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-600" />
                    <span className="text-xs font-bold text-foreground">F5</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 8, left: 8 }} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis type="category" dataKey="name" tick={{ fontSize: 9, fontWeight: "700", fill: "hsl(var(--foreground))" }} axisLine={{ stroke: "hsl(var(--foreground))" }} interval={0} />
                  <YAxis type="number" tickFormatter={(v) => fmtRupiahFS(v)} tick={{ fontSize: 10, fontWeight: "700", fill: "hsl(var(--foreground))" }} axisLine={{ stroke: "hsl(var(--foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontWeight: "700", fontSize: "12px", color: "hsl(var(--foreground))" }}
                    labelStyle={{ fontWeight: "900", fontSize: "13px", color: "hsl(var(--foreground))" }}
                    formatter={(value: number, name: string) => [fmtRupiahFS(value), name === "before" ? "Real+Base" : name === "qlop" ? "Qualified LOP" : "LOP F5"]}
                    labelFormatter={(_, payload) => payload && payload[0] ? (payload[0] as any).payload.fullName : ""}
                  />
                  <Bar dataKey="before" stackId="a" name="before" radius={[0, 0, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={"cell-before-" + index} fill={entry.beforeAch >= 1 ? "#ef4444" : entry.beforeAch >= 0.8 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                  <Bar dataKey="qlop" stackId="a" name="qlop" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="f5" stackId="a" name="f5" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Revenue Bulanan ── */}
        <div className="bg-card border border-border rounded-xl px-4 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-display font-bold text-foreground tracking-tight">Revenue Bulanan</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Real (solid) vs Proyeksi Base (putus-putus) vs Target</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 rounded" style={{ backgroundColor: "#16a34a" }} />
                <span className="text-xs font-bold text-foreground">Real</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 rounded" style={{ backgroundColor: "#d97706", backgroundImage: "repeating-linear-gradient(90deg,#d97706 0,#d97706 4px,transparent 4px,transparent 8px)" }} />
                <span className="text-xs font-bold text-foreground">Proyeksi Base</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 rounded" style={{ backgroundColor: "#2563eb" }} />
                <span className="text-xs font-bold text-foreground">Target</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData} margin={{ top: 8, right: 24, bottom: 4, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="bulan"
                tick={{ fontSize: 11, fontWeight: "800", fill: "hsl(var(--foreground))" }}
                axisLine={{ stroke: "hsl(var(--foreground))" }}
              />
              <YAxis
                tickFormatter={(v) => fmtRupiahFS(v)}
                tick={{ fontSize: 10, fontWeight: "700", fill: "hsl(var(--foreground))" }}
                axisLine={{ stroke: "hsl(var(--foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontWeight: "700",
                  fontSize: "12px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value: number, name: string) => [
                  fmtRupiahFS(value),
                  name === "real" ? "Real" : name === "target" ? "Target" : "Proyeksi Base",
                ]}
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: "#2563eb", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="real"
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={{ fill: "#16a34a", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="base"
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* ── Tabel Pivot Prognosa ── */}
        <div className="p-3">
          <div className="border border-border rounded overflow-hidden" style={{ boxShadow: "rgba(0, 0, 0, 0.1) 0px 2px 4px" }}>

            {/* ── Single scrollable table with sticky header ── */}
            <div className="overflow-auto" style={{ maxHeight: "calc(-280px + 100svh)" }}>
              <table style={{ minWidth: 960, tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
                <colgroup>
                  <col style={{ width: 28 }} />
                  <col style={{ width: 200 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  {_scenario === "all" && <col style={{ width: 100 }} />}
                  {_scenario === "all" && <col style={{ width: 80 }} />}
                  {_scenario === "all" && <col style={{ width: 100 }} />}
                  {_scenario === "all" && <col style={{ width: 80 }} />}
                  {_scenario === "all" && <col style={{ width: 100 }} />}
                  {_scenario === "all" && <col style={{ width: 80 }} />}
                  {_scenario === "exc" && <col style={{ width: 100 }} />}
                  {_scenario === "exc" && <col style={{ width: 80 }} />}
                  {_scenario === "inc" && <col style={{ width: 100 }} />}
                  {_scenario === "inc" && <col style={{ width: 80 }} />}
                  {_scenario === "inc" && <col style={{ width: 100 }} />}
                  {_scenario === "inc" && <col style={{ width: 80 }} />}
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: "rgb(185, 28, 28)", position: "sticky", top: 0, zIndex: 10 }}>
                    <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "0" }}></th>
                    <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nama AM</th>
                    <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Revenue</th>
                    <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>Real PMS YTD</th>
                    <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>Base Revenue</th>
                    <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>BC (16 Agu '26)</th>
                    <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Outlook<br/>(before LOP)</th>
                    <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Ach<br/>(before LOP)</th>
                    {_scenario === "all" && <th title="Qualified LOP = Base Conversion Revenue ((F3-F4) x Conversion Rate)" style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "help" }}>Qualified LOP</th>}
                    {_scenario === "all" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>LOP F5</th>}
                    {_scenario === "all" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Outlook<br/>(Exc F5)</th>}
                    {_scenario === "all" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Ach<br/>Exc F5</th>}
                    {_scenario === "all" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Outlook<br/>(Inc F5)</th>}
                    {_scenario === "all" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Ach<br/>Inc F5</th>}
                    {_scenario === "exc" && <th title="Qualified LOP = Base Conversion Revenue ((F3-F4) x Conversion Rate)" style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "help" }}>Qualified LOP</th>}
                    {_scenario === "exc" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Ach<br/>Exc F5</th>}
                    {_scenario === "inc" && <th title="Qualified LOP = Base Conversion Revenue ((F3-F4) x Conversion Rate)" style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "help" }}>Qualified LOP</th>}
                    {_scenario === "inc" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>LOP F5</th>}
                    {_scenario === "inc" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Outlook<br/>(Inc F5)</th>}
                    {_scenario === "inc" && <th style={{ backgroundColor: "rgb(185, 28, 28)", padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "0.05em", textDecoration: "underline", textUnderlineOffset: 2 }}>Ach<br/>Inc F5</th>}
                  </tr>
                </thead>
                <tbody>
                  {computed.rows.map((am, idx) => {
                    const isOpen = expandedNik === am.nik;
                    const rowBg = "#ffffff";
                    const achColor = (ach: number) => ach >= 1 ? "rgb(22, 163, 74)" : ach >= 0.8 ? "rgb(234, 88, 12)" : "rgb(220, 38, 38)";
                    const divisiBadges = [...new Set(
                      data.filter(r => r.NAMA_AM === am.namaAm).map(r => r.DIVISI_CC)
                    )];
                    const amRows = data.filter(r => r.NAMA_AM === am.namaAm).sort((a, b) => a.PERIODE - b.PERIODE);
                    return (
                      <React.Fragment key={am.nik}>

                        {/* ── AM header row ── */}
                        <tr
                          className="select-none transition-colors cursor-pointer hover:bg-secondary/30"
                          style={{ borderBottom: isOpen ? "2px solid hsl(var(--border))" : "1px solid hsl(var(--border))", backgroundColor: rowBg }}
                          onClick={() => setExpandedNik(isOpen ? null : am.nik)}
                        >
                          <td style={{ padding: "10px 8px", width: 28, backgroundColor: rowBg }}>
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </td>
                          <td style={{ padding: "10px 16px", backgroundColor: rowBg }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.03em" }}>{am.namaAm}</span>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {divisiBadges.map(d => (
                                  <span key={d} style={{
                                    fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                                    backgroundColor: d === "DPS" ? "rgb(219, 234, 254)" : "rgb(209, 250, 229)",
                                    color: d === "DPS" ? "rgb(29, 78, 216)" : "rgb(6, 95, 70)",
                                  }}>{d}</span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.target)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.real)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.base)}</td>
                          <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.f5)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.before)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: achColor(am.achBefore), backgroundColor: rowBg }}>{fmtPct(am.achBefore)}</td>
                          {_scenario === "all" && <>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.qlop)}</td>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.f5)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.exc)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: achColor(am.achExc), backgroundColor: rowBg }}>{fmtPct(am.achExc)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.inc)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: achColor(am.achInc), backgroundColor: rowBg }}>{fmtPct(am.achInc)}</td>
                          </>}
                          {_scenario === "exc" && <>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.qlop)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: achColor(am.achExc), backgroundColor: rowBg }}>{fmtPct(am.achExc)}</td>
                          </>}
                          {_scenario === "inc" && <>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.qlop)}</td>
                            <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.f5)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: rowBg }}>{fmtRupiahFS(am.inc)}</td>
                            <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: achColor(am.achInc), backgroundColor: rowBg }}>{fmtPct(am.achInc)}</td>
                          </>}
                        </tr>

                        {/* ── Expanded: wrapper + sub-header + detail ── */}
                        {isOpen && (
                          <tr>
                            <td colSpan={14} className="px-0 pb-3 pt-0" style={{ padding: 0 }}>
                              <div style={{ margin: "4px 12px 4px 12px", border: "2px solid rgb(254, 205, 211)", borderRadius: 8, overflow: "hidden", boxShadow: "rgba(0,0,0,0.05) 0px 1px 2px" }}>
                                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                                  <thead>
                                    <tr style={{ backgroundColor: "rgb(255, 231, 235)" }}>
                                      <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Periode</th>
                                      <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Standard Name</th>
                                      <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Divisi</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Revenue</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Sustain</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Scaling</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target NGTMA</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Real Revenue</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>F3-F4</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>F5</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Real NGTMA</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Revenue Base</th>
                                      <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 900, color: "rgb(225, 29, 72)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Revenue Billcom</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {amRows.map((r, ri) => {
                                      const tgtVal = r.TARGET_REVENUE ?? 0;
                                      const realVal = r.REAL_REVENUE ?? 0;
                                      return (
                                        <tr key={ri} style={{ borderTop: "1px solid rgba(254, 205, 211, 0.5)", backgroundColor: ri % 2 === 0 ? "#ffffff" : "rgb(255, 241, 242)" }}>
                                          <td style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "rgb(225, 29, 72)", backgroundColor: "transparent" }}>{r.PERIODE}</td>
                                          <td style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "hsl(var(--foreground))", backgroundColor: "transparent" }}>
                                            <div>{r.STANDARD_NAME}</div>
                                            {r.NIP_NAS && <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}>{r.NIP_NAS}</div>}
                                          </td>
                                          <td style={{ padding: "6px 12px", textAlign: "center", backgroundColor: "transparent" }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, backgroundColor: r.DIVISI_CC === "DPS" ? "rgb(219, 234, 254)" : "rgb(209, 250, 229)", color: r.DIVISI_CC === "DPS" ? "rgb(29, 78, 216)" : "rgb(6, 95, 70)" }}>{r.DIVISI_CC}</span>
                                          </td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.TARGET_REVENUE)}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.TARGET_SUSTAIN)}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.TARGET_SCALING)}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.TARGET_NGTMA)}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.REAL_REVENUE)}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r["F3-F4"])}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.F5)}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.REAL_NGTMA)}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.REVENUE_BASE)}</td>
                                          <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, fontWeight: 800, fontVariantNumeric: "tabular-nums", backgroundColor: "transparent" }}>{fmtRupiahFS(r.REVENUE_BILLCOM)}</td>
                                        </tr>
                                      );
                                    })}
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

          </div>
        </div>


      </div>
      )}
    </>
  );
}
