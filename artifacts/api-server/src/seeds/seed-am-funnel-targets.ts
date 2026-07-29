import { db, amFunnelTargetTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const AM_FUNNEL_TARGETS_2026 = [
  { nikAm: "870022", tahun: 2026, targetValue: 30_550_846_344 }, // HAVEA PERTIWI
  { nikAm: "910017", tahun: 2026, targetValue: 29_986_552_880 }, // SAFIRINA FEBRYANTI
  { nikAm: "910024", tahun: 2026, targetValue: 20_271_671_597 }, // VIVIN VIOLITA
  { nikAm: "920064", tahun: 2026, targetValue: 18_168_530_766 }, // ERVINA HANDAYANI
  { nikAm: "896661", tahun: 2026, targetValue: 16_919_356_769 }, // NI MADE NOVI WIRANA
  { nikAm: "980067", tahun: 2026, targetValue: 15_051_479_565 }, // HANDIKA DAGNA NEVANDA
  { nikAm: "404429", tahun: 2026, targetValue: 12_150_696_868 }, // WILDAN ARIEF
  { nikAm: "401431", tahun: 2026, targetValue: 10_517_836_089 }, // NYARI KUSUMANINGRUM
  { nikAm: "403613", tahun: 2026, targetValue:  9_265_052_740 }, // NADYA ZAHROTUL HAYATI
  { nikAm: "405690", tahun: 2026, targetValue:  9_232_103_467 }, // CAESAR RIO ANGGINA TORUAN
  { nikAm: "402478", tahun: 2026, targetValue:  2_386_441_454 }, // ANA RUKMANA
];

export async function seedAmFunnelTargets(opts: { truncate?: boolean } = {}) {
  if (opts.truncate) {
    console.log("  [am-funnel-targets] Truncating am_funnel_target...");
    await db.delete(amFunnelTargetTable);
  }

  console.log(`  [am-funnel-targets] Seeding ${AM_FUNNEL_TARGETS_2026.length} target(s)...`);
  for (const t of AM_FUNNEL_TARGETS_2026) {
    const existing = await db
      .select({ id: amFunnelTargetTable.id })
      .from(amFunnelTargetTable)
      .where(and(eq(amFunnelTargetTable.nikAm, t.nikAm), eq(amFunnelTargetTable.tahun, t.tahun)))
      .limit(1);

    if (existing.length === 0 || opts.truncate) {
      await db.insert(amFunnelTargetTable).values(t);
      console.log(`    [am-funnel-targets] Inserted: NIK ${t.nikAm} tahun ${t.tahun}`);
    } else {
      await db.update(amFunnelTargetTable)
        .set({ targetValue: t.targetValue, updatedAt: new Date() })
        .where(eq(amFunnelTargetTable.id, existing[0].id));
      console.log(`    [am-funnel-targets] Updated: NIK ${t.nikAm} tahun ${t.tahun}`);
    }
  }

  console.log("  [am-funnel-targets] Done.");
}
