import app from "./app";
import { logger } from "./shared/logger";
import { ensureDefaultAdmin } from "./shared/auth";
import { ensureDefaultSeed } from "./shared/seed";
import { ensureFullSeed } from "./shared/auto-seed";
import { pool } from "@workspace/db";
import { startTelegramPoller } from "./features/telegram/poller";
import { startGSheetsScheduler } from "./features/gsheets/scheduler";
import { startGDriveScheduler } from "./features/gdrive/scheduler";
import { startTelegramWeeklyFunnelScheduler } from "./features/telegram/scheduler";

async function ensureSessionTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      sid VARCHAR NOT NULL COLLATE "default",
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL,
      CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
    ) WITH (OIDS=FALSE);
    CREATE INDEX IF NOT EXISTS IDX_session_expire ON user_sessions (expire);
  `);
}

async function patchNullTahunAnggaran(): Promise<void> {
  const result = await pool.query(`
    UPDATE sales_funnel
    SET tahun_anggaran = COALESCE(
      CASE WHEN snapshot_date IS NOT NULL AND snapshot_date ~ '^[0-9]{4}'
        THEN EXTRACT(YEAR FROM snapshot_date::date)::integer
      END,
      CASE WHEN report_date IS NOT NULL AND report_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        THEN EXTRACT(YEAR FROM report_date::date)::integer
      END
    )
    WHERE tahun_anggaran IS NULL;
  `);
  const count = result.rowCount ?? 0;
  if (count > 0) {
    logger.info({ count }, "Patched NULL tahun_anggaran rows from snapshot/report_date");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureSessionTable()
  .then(() => logger.info("Session table ensured"))
  .catch(err => logger.error({ err }, "Failed to ensure session table"));

ensureDefaultAdmin()
  .then(() => logger.info("Default admin user ensured"))
  .catch(err => logger.error({ err }, "Failed to ensure default admin"));

ensureDefaultSeed()
  .then(() => logger.info("Default seed data ensured"))
  .catch(err => logger.error({ err }, "Failed to ensure default seed data"));

ensureFullSeed()
  .then(() => logger.info("Full seed check complete"))
  .catch(err => logger.error({ err }, "Failed full seed check"));

patchNullTahunAnggaran()
  .then(() => logger.info("Tahun anggaran patch complete"))
  .catch(err => logger.error({ err }, "Failed to patch tahun anggaran"));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startTelegramPoller(15000);
  startGSheetsScheduler();
  startGDriveScheduler();
  startTelegramWeeklyFunnelScheduler();
});
