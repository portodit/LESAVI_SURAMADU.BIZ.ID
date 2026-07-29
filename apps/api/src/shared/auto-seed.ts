import { ensureDefaultSeed } from "./seed";
import { seedFunnelApr22Json } from "../seeds/seed-funnel-apr22-json.js";

export async function ensureFullSeed(): Promise<void> {
  await ensureDefaultSeed();
  // JSON-based seed: reads pre-built 4.5MB JSON (not 53MB Excel) → no OOM risk
  await seedFunnelApr22Json();
}
