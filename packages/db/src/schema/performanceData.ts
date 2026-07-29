<<<<<<< HEAD
import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
=======
import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const performanceDataTable = pgTable("performance_data", {
  id: serial("id").primaryKey(),
  nik: text("nik").notNull(),
  namaAm: text("nama_am").notNull(),
<<<<<<< HEAD
  divisi: text("divisi").notNull(),  // DIVISI_AM value (DES/DPS/DGS)
  divisiCc: text("divisi_cc"),  // DIVISI_CC value (DPS/DSS) - kategori customer
=======
  divisi: text("divisi").notNull(),
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  witelAm: text("witel_am"),
  levelAm: text("level_am"),
  tahun: integer("tahun").notNull(),
  bulan: integer("bulan").notNull(),
<<<<<<< HEAD
  targetRevenue: numeric("target_revenue", { precision: 20, scale: 4 }).notNull().default(0),
  realRevenue: numeric("real_revenue", { precision: 20, scale: 4 }).notNull().default(0),
  targetReguler: numeric("target_reguler", { precision: 20, scale: 4 }).default(0),
  realReguler: numeric("real_reguler", { precision: 20, scale: 4 }).default(0),
  targetSustain: numeric("target_sustain", { precision: 20, scale: 4 }).default(0),
  realSustain: numeric("real_sustain", { precision: 20, scale: 4 }).default(0),
  targetScaling: numeric("target_scaling", { precision: 20, scale: 4 }).default(0),
  realScaling: numeric("real_scaling", { precision: 20, scale: 4 }).default(0),
  targetNgtma: numeric("target_ngtma", { precision: 20, scale: 4 }).default(0),
  realNgtma: numeric("real_ngtma", { precision: 20, scale: 4 }).default(0),
  achRate: numeric("ach_rate", { precision: 10, scale: 6 }).notNull().default(0),
  achRateYtd: numeric("ach_rate_ytd", { precision: 10, scale: 6 }).notNull().default(0),
=======
  targetRevenue: real("target_revenue").notNull().default(0),
  realRevenue: real("real_revenue").notNull().default(0),
  targetReguler: real("target_reguler").default(0),
  realReguler: real("real_reguler").default(0),
  targetSustain: real("target_sustain").default(0),
  realSustain: real("real_sustain").default(0),
  targetScaling: real("target_scaling").default(0),
  realScaling: real("real_scaling").default(0),
  targetNgtma: real("target_ngtma").default(0),
  realNgtma: real("real_ngtma").default(0),
  achRate: real("ach_rate").notNull().default(0),
  achRateYtd: real("ach_rate_ytd").notNull().default(0),
>>>>>>> 3fd35a8c4fc9178e0fdcba46f48d6a9e10ae8829
  rankAch: integer("rank_ach").notNull().default(0),
  statusWarna: text("status_warna").notNull().default("merah"),
  komponenDetail: text("komponen_detail"),
  snapshotDate: text("snapshot_date"),
  importId: integer("import_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPerformanceDataSchema = createInsertSchema(performanceDataTable).omit({ id: true, createdAt: true });
export type InsertPerformanceData = z.infer<typeof insertPerformanceDataSchema>;
export type PerformanceData = typeof performanceDataTable.$inferSelect;
