import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(value: number | null | undefined): string {
  const v = value ?? 0;
  if (!Number.isFinite(v)) return "Rp 0";
  const absV = Math.abs(v);
  let formatted: string;
  if (absV >= 1e12) {
    formatted = `${(absV / 1e12).toFixed(2).replace(".", ",")} T`;
  } else if (absV >= 1e9) {
    formatted = `${(absV / 1e9).toFixed(2).replace(".", ",")} M`;
  } else if (absV >= 1e6) {
    formatted = `${(absV / 1e6).toFixed(2).replace(".", ",")} Jt`;
  } else {
    formatted = absV.toLocaleString("id-ID");
  }
  return v < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatPercent(value: number | null | undefined): string {
  const v = value ?? 0;
  if (!Number.isFinite(v)) return "0%";
  const pct = v > 1 ? v : v * 100;
  return `${pct.toFixed(2).replace(".", ",")}%`;
}

export function formatRupiahFull(value: number | null | undefined): string {
  const raw = value ?? 0;
  const v = Number(raw);
  if (!Number.isFinite(v)) return "Rp 0";
  const absV = Math.abs(v);
  const formatted = absV.toLocaleString("id-ID");
  return v < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatRupiahShort(value: number | null | undefined): string {
  const v = value ?? 0;
  if (!Number.isFinite(v)) return "Rp0";
  const absV = Math.abs(v);
  let formatted: string;
  if (absV >= 1e12) {
    formatted = `${(absV / 1e12).toFixed(2)}T`;
  } else if (absV >= 1e9) {
    formatted = `${(absV / 1e9).toFixed(2)}M`;
  } else if (absV >= 1e6) {
    formatted = `${(absV / 1e6).toFixed(2)}Jt`;
  } else {
    formatted = absV.toLocaleString("id-ID");
  }
  return v < 0 ? `-Rp${formatted}` : `Rp${formatted}`;
}

export function getAchPct(value: number | null | undefined): number {
  const v = value ?? 0;
  if (!Number.isFinite(v)) return 0;
  return v > 1 ? v : v * 100;
}

export function getStatusColor(statusWarna: string | null | undefined) {
  const s = (statusWarna ?? "").toLowerCase();
  if (s === "hijau" || s === "green") return "bg-success/15 text-success border-success/30";
  if (s === "oranye" || s === "orange" || s === "kuning" || s === "yellow") return "bg-warning/15 text-warning border-warning/30";
  if (s === "merah" || s === "red") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

// ─── Period conversion (yyyyMM string ↔ year/month sets) ─────────────────────
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

export function periodToYearMonth(periodStr: string): { year: string; month: string } | null {
  if (!periodStr || periodStr.length !== 6) return null;
  return { year: periodStr.slice(0, 4), month: periodStr.slice(4, 6) };
}

export function periodToLabel(periodStr: string): string {
  const { year, month } = periodToYearMonth(periodStr) ?? { year: periodStr.slice(0, 4), month: periodStr.slice(4, 6) };
  const m = parseInt(month, 10);
  return `${MONTHS_SHORT[m - 1] ?? month} ${year}`;
}

export function yearMonthToPeriod(year: string, month: string): string {
  return `${year}${month}`;
}

// Convert selectedPeriodes (Set<"yyyyMM">) to year/month filter sets
export function periodSetToYearMonth(
  selectedPeriodes: Set<string>
): { filterYears: Set<string>; filterMonths: Set<string> } {
  const filterYears = new Set<string>();
  const filterMonths = new Set<string>();
  for (const p of selectedPeriodes) {
    const { year, month } = periodToYearMonth(p) ?? { year: p.slice(0, 4), month: p.slice(4, 6) };
    filterYears.add(year);
    filterMonths.add(month);
  }
  return { filterYears, filterMonths };
}

// Convert year/month filter sets to Set<"yyyyMM"> periods
export function yearMonthToPeriodSet(
  filterYears: Set<string>,
  filterMonths: Set<string>,
  allPeriodes: string[]
): Set<string> {
  if (filterYears.size === 0) return new Set();
  if (filterYears.size === 1 && filterMonths.size === 0) {
    const yr = [...filterYears][0];
    return new Set(allPeriodes.filter(p => p.startsWith(yr)));
  }
  return new Set(
    allPeriodes.filter(p => {
      const { year, month } = periodToYearMonth(p) ?? { year: p.slice(0, 4), month: p.slice(4, 6) };
      return filterYears.has(year) && (filterMonths.size === 0 || filterMonths.has(month));
    })
  );
}
