import { db, amFunnelTargetTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const AM_FUNNEL_TARGETS_2026 = [
  // Total, DSS, DPS per AM — from sheet "TGT AM LESA VI" kolom FY 2026
  { nikAm: "870022", tahun: 2026, targetValue: 30_550_846_344, targetValueDss: 11_909_818_462, targetValueDps: 18_641_027_882 }, // HAVEA PERTIWI
  { nikAm: "910017", tahun: 2026, targetValue: 29_986_552_880, targetValueDss: 29_344_075_455, targetValueDps:    642_477_425 }, // SAFIRINA FEBRYANTI
  { nikAm: "910024", tahun: 2026, targetValue: 20_271_671_597, targetValueDss:  8_041_920_083, targetValueDps: 12_229_751_515 }, // VIVIN VIOLITA
  { nikAm: "920064", tahun: 2026, targetValue: 18_168_530_766, targetValueDss:    863_020_198, targetValueDps: 17_305_510_568 }, // ERVINA HANDAYANI
  { nikAm: "896661", tahun: 2026, targetValue: 16_919_356_769, targetValueDss:  3_409_123_144, targetValueDps: 13_510_233_625 }, // NI MADE NOVI WIRANA
  { nikAm: "980067", tahun: 2026, targetValue: 15_051_479_565, targetValueDss:  8_575_435_009, targetValueDps:  6_476_044_556 }, // HANDIKA DAGNA NEVANDA
  { nikAm: "404429", tahun: 2026, targetValue: 12_150_696_868, targetValueDss: 10_277_746_766, targetValueDps:  1_872_950_102 }, // WILDAN ARIEF
  { nikAm: "401431", tahun: 2026, targetValue: 10_517_836_089, targetValueDss:  2_564_608_222, targetValueDps:  7_953_227_867 }, // NYARI KUSUMANINGRUM
  { nikAm: "403613", tahun: 2026, targetValue:  9_265_052_740, targetValueDss:              0, targetValueDps:  9_265_052_740 }, // NADYA ZAHROTUL HAYATI (pure DPS)
  { nikAm: "405690", tahun: 2026, targetValue:  9_232_103_467, targetValueDss:  1_018_147_097, targetValueDps:  8_213_956_370 }, // CAESAR RIO ANGGINA TORUAN
  { nikAm: "402478", tahun: 2026, targetValue:  2_386_441_454, targetValueDss:  1_921_132_954, targetValueDps:    465_308_500 }, // ANA RUKMANA
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
        .set({
          targetValue: t.targetValue,
          updatedAt: new Date(),
        })
        .where(eq(amFunnelTargetTable.id, existing[0].id));
      console.log(`    [am-funnel-targets] Updated: NIK ${t.nikAm} tahun ${t.tahun}`);
    }
  }

  console.log("  [am-funnel-targets] Done.");
}
