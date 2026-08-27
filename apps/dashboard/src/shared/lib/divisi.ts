// NOTE: "LESA" is a group label (DPS+DSS from divisi_cc), not a DB value.
// The actual DB values in performance_data.divisi_cc are: DPS, DSS
// LESA = DPS + DSS combined
// Filter logic uses matchesDivisiPerforma() to expand LESA -> [DPS, DSS]
export const DIVISI_OPTIONS = [
  { value: "LESA", label: "LESA (All)" },
  { value: "DPS",  label: "DPS" },
  { value: "DSS",  label: "DSS" },
];

export const DIVISI_OPTIONS_WITH_ALL = [
  { value: "all",  label: "Semua Divisi" },
  { value: "LESA", label: "LESA" },
  { value: "DPS",  label: "DPS" },
  { value: "DSS",  label: "DSS" },
];

export const DEFAULT_DIVISI = "all";

/** Expands LESA → ["DPS","DSS"], else → [d] */
export function expandDivisi(d: string): string[] {
  if (d === "LESA") return ["DPS", "DSS"];
  return [d];
}

/** Returns true if recordDivisi matches the selected filter */
export function matchesDivisi(
  recordDivisi: string | null | undefined,
  filter: string
): boolean {
  if (!filter || filter === "all") return true;
  return expandDivisi(filter).includes(recordDivisi ?? "");
}

/**
 * Performa-specific: LESA → ["DPS","DSS"], else → [d].
 * Uses divisi_cc values (DPS/DSS/DGS from cost center).
 * Checks both divisi and divisi_cc to handle historical data where
 * DPS/DSS AMs have divisi='DES' but divisi_cc='DPS'/'DSS'.
 */
export function expandDivisiPerforma(d: string): string[] {
  if (d === "LESA") return ["DPS", "DSS"];
  return [d];
}

/** Returns true if record matches the selected performa filter (LESA includes DPS+DSS) */
export function matchesDivisiPerforma(
  recordDivisi: string | null | undefined,
  filter: string,
  recordDivisiCc?: string | null | undefined
): boolean {
  if (!filter || filter === "all") return true;
  // LESA is a meta-category that includes DPS, DSS (and historical DES)
  if (filter === "LESA") {
    // Match if record is DPS, DSS, or DES (historical LESA code)
    if (recordDivisiCc === "DPS" || recordDivisiCc === "DSS" || recordDivisiCc === "DGS") return true;
    if (recordDivisi === "DPS" || recordDivisi === "DSS" || recordDivisi === "DES" || recordDivisi === "DGS") return true;
    return false;
  }
  // For specific filters (DPS, DSS, DGS), check divisi_cc first (authoritative)
  const expanded = expandDivisiPerforma(filter);
  if (recordDivisiCc && expanded.includes(recordDivisiCc)) return true;
  return expanded.includes(recordDivisi ?? "");
}

/** Human-readable label for a divisi filter value */
export function divisiFilterLabel(d: string): string {
  if (d === "LESA") return "LESA (All)";
  if (!d || d === "all") return "Semua Divisi";
  return d;
}
