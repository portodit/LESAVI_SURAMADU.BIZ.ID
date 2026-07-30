import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const performanceDataTable = pgTable("performance_data", {
  id: serial("id").primaryKey(),
  nik: text("nik").notNull(),
  namaAm: text("nama_am").notNull(),
  divisi: text("divisi").notNull(),  // DIVISI_AM value (DPS/DSS/DGS)
  divisiCc: text("divisi_cc"),       // DIVISI_CC value — kategori customer (DPS/DSS)
  witelAm: text("witel_am"),
  levelAm: text("level_am"),
  tahun: integer("tahun").notNull(),
  bulan: integer("bulan").notNull(),

  // Revenue total
  targetRevenue: numeric("target_revenue", { precision: 24, scale: 10 }).notNull().default(0),
  realRevenue: numeric("real_revenue", { precision: 24, scale: 10 }).notNull().default(0),

  // Revenue per komponen
  targetReguler: numeric("target_reguler", { precision: 24, scale: 10 }).default(0),
  realReguler: numeric("real_reguler", { precision: 24, scale: 10 }).default(0),
  targetSustain: numeric("target_sustain", { precision: 24, scale: 10 }).default(0),
  realSustain: numeric("real_sustain", { precision: 24, scale: 10 }).default(0),
  targetScaling: numeric("target_scaling", { precision: 24, scale: 10 }).default(0),
  realScaling: numeric("real_scaling", { precision: 24, scale: 10 }).default(0),
  targetNgtma: numeric("target_ngtma", { precision: 24, scale: 10 }).default(0),
  realNgtma: numeric("real_ngtma", { precision: 24, scale: 10 }).default(0),

  // ── New: billing sub-components (per-row, from RAW file) ──────────────────
  revenueBase: numeric("revenue_base", { precision: 24, scale: 10 }),
  revenueBillcom: numeric("revenue_billcom", { precision: 24, scale: 10 }),

  // ── New: achievement rates per komponen (from RAW file, raw precision) ───
  aRev: numeric("a_rev", { precision: 24, scale: 16 }),
  aNgtma: numeric("a_ngtma", { precision: 24, scale: 16 }),
  aScaling: numeric("a_scaling", { precision: 24, scale: 16 }),
  aSustain: numeric("a_sustain", { precision: 24, scale: 16 }),

  // Aggregate achievement
  achRate: numeric("ach_rate", { precision: 24, scale: 16 }).notNull().default(0),
  achRateYtd: numeric("ach_rate_ytd", { precision: 24, scale: 16 }).notNull().default(0),
  rankAch: integer("rank_ach").notNull().default(0),
  statusWarna: text("status_warna").notNull().default("merah"),

  // Per-customer breakdown JSON
  // Fields per customer: nip, pelanggan, proporsi, group, industri,
  // lsegmen, ssegmen, witelCc, telda, regional, divisiCc, kawasan,
  // Reguler, Sustain, Scaling, NGTMA, targetTotal, realTotal,
  // revenueBase, revenueBillcom
  komponenDetail: text("komponen_detail"),
  snapshotDate: text("snapshot_date"),
  importId: integer("import_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPerformanceDataSchema = createInsertSchema(performanceDataTable).omit({ id: true, createdAt: true });
export type InsertPerformanceData = z.infer<typeof insertPerformanceDataSchema>;
export type PerformanceData = typeof performanceDataTable.$inferSelect;
