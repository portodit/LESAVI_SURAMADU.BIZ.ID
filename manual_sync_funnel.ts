
import { runDriveImport } from "./apps/api/src/features/gdrive/importer";
import { db, appSettingsTable } from "@workspace/db";

async function manualSync() {
  const [settings] = await db.select().from(appSettingsTable);
  if (!settings) throw new Error("Settings not found");
  
  console.log("Starting manual sync for file: 1qGutsuq0RSj33GGbqI6apVYF0n_D47Tu");
  const result = await runDriveImport(
    "funnel",
    "1qGutsuq0RSj33GGbqI6apVYF0n_D47Tu",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "TREG3_SALES_FUNNEL_20260601.xlsx",
    "AIzaSyBHMj9LSM_4CbtY2zs9U9AHJtHL0_36jNQ",
    "2026-06-01"
  );
  console.log("Sync Result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

manualSync().catch(err => {
  console.error("Sync Failed:", err);
  process.exit(1);
});
