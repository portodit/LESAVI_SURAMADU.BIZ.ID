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
